import { useCallback, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { confirmTripleDelete } from '@/utils/confirmTripleDelete';
import { normalizeText } from '@/utils/text';
import { parseCSVLine, validateCSVHeaders } from '@/components/expenses';
import { useHouseholdAccountsData } from './useHouseholdAccountsData';
import type {
  PersonalAccountDraft,
  PersonalAccountType,
} from '@/app/personal/accounts/components/AccountFormDialog';
import type { PersonalAccountRow } from '@/app/personal/accounts/components/AccountsListTable';

export function usePersonalAccountsView() {
  const {
    accounts,
    createAccount,
    updateAccount,
    deleteAccount,
    exportAccountsCSV,
  } = useHouseholdAccountsData();

  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<PersonalAccountType | null>(
    null
  );
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterInstitution, setFilterInstitution] = useState<string | null>(
    null
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<PersonalAccountRow | null>(null);
  const [draft, setDraft] = useState<PersonalAccountDraft>({
    name: '',
    type: 'CASH',
    institution: '',
    accountNumberLast4: '',
  });
  const [isImporting, setIsImporting] = useState(false);

  const types = useMemo(() => {
    const unique = new Set(accounts.map((a) => a.type));
    return Array.from(unique) as PersonalAccountType[];
  }, [accounts]);

  const institutions = useMemo(() => {
    const unique = new Set(
      accounts.map((a) => a.institution).filter((x) => x.trim().length > 0)
    );
    return Array.from(unique);
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    const q = normalizeText(searchQuery);
    return accounts.filter((a) => {
      if (q) {
        const hay = [a.name, a.type, a.institution, a.accountNumberLast4]
          .filter(Boolean)
          .join(' ');
        if (!normalizeText(hay).includes(q)) {
          return false;
        }
      }

      if (filterType && a.type !== filterType) {
        return false;
      }

      if (filterStatus) {
        const isActive = a.isActive;
        if (filterStatus === 'active' && !isActive) {
          return false;
        }
        if (filterStatus === 'inactive' && isActive) {
          return false;
        }
      }

      if (filterInstitution) {
        if (normalizeText(a.institution) !== normalizeText(filterInstitution)) {
          return false;
        }
      }

      return true;
    });
  }, [accounts, filterInstitution, filterStatus, filterType, searchQuery]);

  const totalAccounts = accounts.length;
  const activeAccounts = accounts.filter((a) => a.isActive).length;
  const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const thisMonthChange = 0;

  const handleAddAccount = useCallback(() => {
    setEditingAccount(null);
    setDraft({
      name: '',
      type: 'CASH',
      institution: '',
      accountNumberLast4: '',
    });
    setIsModalOpen(true);
  }, []);

  const handleEditAccount = useCallback((account: PersonalAccountRow) => {
    setEditingAccount(account);
    setDraft({
      name: account.name,
      type: account.type,
      institution: account.institution,
      accountNumberLast4: account.accountNumberLast4,
    });
    setIsModalOpen(true);
  }, []);

  const handleDeleteAccount = useCallback(
    (id: string) => {
      void (async () => {
        const confirmed = await confirmTripleDelete({
          title: 'Delete account?',
          warning: 'This will permanently delete this account record.',
          secondaryWarning:
            'If this account is linked to income/expenses, deletion may fail.',
          finalPrompt: 'Type DELETE to confirm.',
        });
        if (!confirmed) {
          return;
        }

        try {
          void Swal.fire({
            title: 'Deleting...',
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          await deleteAccount(id);

          await Swal.fire({
            icon: 'success',
            title: 'Deleted',
            text: 'Account deleted successfully.',
            timer: 1200,
            showConfirmButton: false,
          });
        } catch (error) {
          await Swal.fire({
            icon: 'error',
            title: 'Delete failed',
            text:
              error instanceof Error
                ? error.message
                : 'Unable to delete account.',
          });
        }
      })();
    },
    [deleteAccount]
  );

  const handleSaveAccount = useCallback(() => {
    const name = draft.name.trim();
    if (!name) {
      return;
    }

    void (async () => {
      const payload: PersonalAccountDraft = {
        ...draft,
        name,
        institution: draft.institution.trim(),
        accountNumberLast4: draft.accountNumberLast4.trim(),
      };

      try {
        if (editingAccount) {
          await updateAccount({ id: editingAccount.id, draft: payload });
        } else {
          await createAccount(payload);
        }

        setIsModalOpen(false);
      } catch (error) {
        await Swal.fire({
          icon: 'error',
          title: 'Save failed',
          text:
            error instanceof Error ? error.message : 'Unable to save account.',
        });
      }
    })();
  }, [createAccount, draft, editingAccount, updateAccount]);

  const handleImportCSV = useCallback(
    async (_file: File | null) => {
      if (!_file) {
        return;
      }
      setIsImporting(true);
      try {
        const text = await _file.text();
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter((l) => l.length > 0);

        if (lines.length === 0) {
          await Swal.fire({
            icon: 'info',
            title: 'No data',
            text: 'The CSV file is empty.',
          });
          return;
        }

        const headers = parseCSVLine(lines[0]).map((h) =>
          h.trim().toLowerCase()
        );
        const required = ['name', 'type', 'institution', 'last4'];
        const missing = validateCSVHeaders(headers, required);
        if (missing.length > 0) {
          await Swal.fire({
            icon: 'error',
            title: 'Invalid CSV',
            text: `Missing columns: ${missing.join(', ')}`,
          });
          return;
        }

        const idx = (name: string) => headers.indexOf(name);
        const idxName = idx('name');
        const idxType = idx('type');
        const idxInstitution = idx('institution');
        const idxLast4 = idx('last4');

        let imported = 0;
        let skipped = 0;

        for (const line of lines.slice(1)) {
          const cols = parseCSVLine(line);
          if (cols.length === 0) {
            continue;
          }

          const name = (cols[idxName] || '').trim();
          const type = (cols[idxType] || '').trim().toUpperCase();
          const institution = (cols[idxInstitution] || '').trim();
          const last4 = (cols[idxLast4] || '').trim();

          if (!name) {
            skipped += 1;
            continue;
          }

          try {
            await createAccount({
              name,
              type: type as PersonalAccountType,
              institution,
              accountNumberLast4: last4,
            });
            imported += 1;
          } catch (error) {
            skipped += 1;
            // eslint-disable-next-line no-continue
            continue;
          }
        }

        await Swal.fire({
          icon: 'success',
          title: 'Import complete',
          text: `Imported ${imported} rows. Skipped ${skipped}.`,
        });
      } finally {
        setIsImporting(false);
      }
    },
    [createAccount]
  );

  const handleExportCSV = useCallback(() => {
    exportAccountsCSV();
  }, [exportAccountsCSV]);

  return {
    accounts,
    filteredAccounts,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    filterStatus,
    setFilterStatus,
    filterInstitution,
    setFilterInstitution,
    isModalOpen,
    setIsModalOpen,
    editingAccount,
    setEditingAccount,
    draft,
    setDraft,
    isImporting,
    setIsImporting,
    types,
    institutions,
    totals: {
      totalAccounts,
      activeAccounts,
      totalBalance,
      thisMonthChange,
    },
    handleAddAccount,
    handleEditAccount,
    handleDeleteAccount,
    handleSaveAccount,
    handleImportCSV,
    handleExportCSV,
  } as const;
}
