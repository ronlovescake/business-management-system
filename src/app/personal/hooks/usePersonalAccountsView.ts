import { useCallback, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { confirmTripleDelete } from '@/utils/confirmTripleDelete';
import { normalizeText } from '@/utils/text';
import { downloadCsvTemplate, parseCSVLine } from '@/components/expenses';
import { useHouseholdAccountsData } from './useHouseholdAccountsData';
import type {
  PersonalAccountDraft,
  PersonalAccountType,
} from '@/app/personal/accounts/components/AccountFormDialog';
import type { PersonalAccountRow } from '@/app/personal/accounts/components/AccountsListTable';

const MAX_CSV_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_CSV_ROWS = 1000;

const ACCOUNT_TYPE_NORMALIZATION: Record<string, PersonalAccountType> = {
  CASH: 'CASH',
  BANK: 'BANK',
  EWALLET: 'EWALLET',
  EWALLETACCOUNT: 'EWALLET',
  CREDITCARD: 'CREDIT_CARD',
  CARD: 'CREDIT_CARD',
  LOAN: 'LOAN',
};

const VALID_ACCOUNT_TYPES = new Set<PersonalAccountType>([
  'CASH',
  'BANK',
  'EWALLET',
  'CREDIT_CARD',
  'LOAN',
]);

function normalizeAccountType(value: string): PersonalAccountType | null {
  const raw = value.trim().toUpperCase();
  if (!raw) {
    return null;
  }
  const compact = raw.replace(/[^A-Z]/g, '');
  const mapped =
    ACCOUNT_TYPE_NORMALIZATION[raw] ??
    ACCOUNT_TYPE_NORMALIZATION[compact] ??
    null;
  if (mapped && VALID_ACCOUNT_TYPES.has(mapped)) {
    return mapped;
  }
  if (VALID_ACCOUNT_TYPES.has(raw as PersonalAccountType)) {
    return raw as PersonalAccountType;
  }
  return null;
}

function isValidLast4(value: string): boolean {
  if (!value) {
    return true;
  }
  return /^\d{4}$/.test(value);
}

function normalizeCsvHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function firstHeaderIndex(
  normalizedHeaders: string[],
  candidates: string[]
): number {
  for (const c of candidates) {
    const idx = normalizedHeaders.indexOf(normalizeCsvHeader(c));
    if (idx >= 0) {
      return idx;
    }
  }
  return -1;
}

export function usePersonalAccountsView() {
  const {
    accounts,
    createAccount,
    createAccounts,
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
      void Swal.fire({
        icon: 'warning',
        title: 'Missing account name',
        text: 'Please enter an account name before saving.',
      });
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

      if (_file.size > MAX_CSV_SIZE_BYTES) {
        await Swal.fire({
          icon: 'error',
          title: 'File too large',
          text: 'Please upload a CSV file smaller than 5MB.',
        });
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

        const dataRows = lines.length - 1;
        if (dataRows > MAX_CSV_ROWS) {
          await Swal.fire({
            icon: 'error',
            title: 'Too many rows',
            text: `Please limit the CSV to ${MAX_CSV_ROWS} rows or fewer.`,
          });
          return;
        }

        const rawHeaders = parseCSVLine(lines[0]);
        const headers = rawHeaders.map(normalizeCsvHeader);

        const idxName = firstHeaderIndex(headers, ['name', 'accountname']);
        const idxType = firstHeaderIndex(headers, ['type', 'accounttype']);
        const idxInstitution = firstHeaderIndex(headers, [
          'institution',
          'bank',
          'provider',
        ]);
        const idxLast4 = firstHeaderIndex(headers, [
          'last4',
          'acctlast4',
          'accountlast4',
          'accountnumberlast4',
          'accountnumber',
        ]);

        const missing = [
          idxName < 0 ? 'name' : null,
          idxType < 0 ? 'type' : null,
          idxInstitution < 0 ? 'institution' : null,
          idxLast4 < 0 ? 'last4' : null,
        ].filter(Boolean);

        if (missing.length > 0) {
          await Swal.fire({
            icon: 'error',
            title: 'Invalid CSV',
            text: `Missing columns: ${missing.join(', ')}`,
          });
          return;
        }

        let imported = 0;
        let skipped = 0;
        let skippedInvalidType = 0;
        let skippedInvalidLast4 = 0;
        let skippedServerError = 0;

        const pendingCreates: PersonalAccountDraft[] = [];

        for (const line of lines.slice(1)) {
          const cols = parseCSVLine(line);
          if (cols.length === 0) {
            continue;
          }

          const name = (cols[idxName] || '').trim();
          const typeRaw = (cols[idxType] || '').trim();
          const institution = (cols[idxInstitution] || '').trim();
          const last4 = (cols[idxLast4] || '').trim();

          if (!name) {
            skipped += 1;
            continue;
          }

          const normalizedType = normalizeAccountType(typeRaw);
          if (!normalizedType) {
            skipped += 1;
            skippedInvalidType += 1;
            continue;
          }

          if (!isValidLast4(last4)) {
            skipped += 1;
            skippedInvalidLast4 += 1;
            continue;
          }

          pendingCreates.push({
            name,
            type: normalizedType,
            institution,
            accountNumberLast4: last4,
          });
        }

        if (pendingCreates.length > 0) {
          try {
            const result = await createAccounts(pendingCreates);
            imported += result.count;
          } catch (error) {
            // Fallback: try row-by-row so we can still import partial data.
            for (const draft of pendingCreates) {
              try {
                await createAccount(draft);
                imported += 1;
              } catch {
                skipped += 1;
                skippedServerError += 1;
              }
            }
          }
        }

        await Swal.fire({
          icon: 'success',
          title: 'Import complete',
          text: `Imported ${imported} rows. Skipped ${skipped}${
            skippedInvalidType || skippedInvalidLast4 || skippedServerError
              ? ` (invalid type: ${skippedInvalidType}, invalid last4: ${skippedInvalidLast4}, server errors: ${skippedServerError})`
              : ''
          }.`,
        });
      } finally {
        setIsImporting(false);
      }
    },
    [createAccount, createAccounts]
  );

  const handleExportCSV = useCallback(() => {
    exportAccountsCSV();
  }, [exportAccountsCSV]);

  const handleDownloadCSVTemplate = useCallback(() => {
    downloadCsvTemplate(
      ['name', 'type', 'institution', 'accountNumberLast4'],
      'personal-accounts'
    );
  }, []);

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
    handleDownloadCSVTemplate,
  } as const;
}
