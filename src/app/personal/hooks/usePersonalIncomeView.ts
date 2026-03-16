import { useCallback, useMemo, useState } from 'react';
import {
  showLoading,
  closeAlert,
  showSuccess,
  showError,
  showInfo,
} from '@/lib/alerts';
import { confirmTripleDelete } from '@/utils/confirmTripleDelete';
import { normalizeText } from '@/utils/text';
import { parseCSVLine, validateCSVHeaders } from '@/components/expenses';
import { useHouseholdIncomeData } from './useHouseholdIncomeData';
import type {
  PersonalIncomeDraft,
  PersonalIncomeType,
} from '@/app/personal/income/components/IncomeFormDialog';
import type { PersonalIncomeRow } from '@/app/personal/income/components/IncomeListTable';

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseYmd(date: string): Date | null {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (!match) {
    return null;
  }
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function usePersonalIncomeView() {
  const {
    income,
    accountOptions,
    createIncome,
    updateIncome,
    deleteIncome,
    exportIncomeCSV,
  } = useHouseholdIncomeData();

  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<PersonalIncomeType | null>(null);
  const [filterAccount, setFilterAccount] = useState<string | null>(null);

  const currentYear = String(new Date().getFullYear());
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const [filterMonth, setFilterMonth] = useState<string>(currentMonth);
  const [filterYear, setFilterYear] = useState<string>(currentYear);

  const yearOptions = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => String(Number(currentYear) - 1 + i)),
    [currentYear]
  );

  const monthOptions = useMemo(
    () => [
      { value: '01', label: 'January' },
      { value: '02', label: 'February' },
      { value: '03', label: 'March' },
      { value: '04', label: 'April' },
      { value: '05', label: 'May' },
      { value: '06', label: 'June' },
      { value: '07', label: 'July' },
      { value: '08', label: 'August' },
      { value: '09', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' },
    ],
    []
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<PersonalIncomeRow | null>(
    null
  );
  const [draft, setDraft] = useState<PersonalIncomeDraft>({
    date: todayYmd(),
    type: 'BUSINESS_DRAW',
    amount: 0,
    account: '',
    accountId: null,
    notes: '',
  });
  const [isImporting, setIsImporting] = useState(false);

  const types = useMemo(() => {
    const unique = new Set(income.map((r) => r.type));
    return Array.from(unique) as PersonalIncomeType[];
  }, [income]);

  const accounts = useMemo(() => {
    const unique = new Set(
      income.map((r) => r.account).filter((x) => x.trim().length > 0)
    );
    return Array.from(unique);
  }, [income]);

  const filteredIncome = useMemo(() => {
    const q = normalizeText(searchQuery);
    return income.filter((r) => {
      if (q) {
        const hay = [r.date, r.type, r.account, String(r.amount), r.notes]
          .filter(Boolean)
          .join(' ');
        if (!normalizeText(hay).includes(q)) {
          return false;
        }
      }

      if (filterType && r.type !== filterType) {
        return false;
      }

      if (
        filterAccount &&
        normalizeText(r.account) !== normalizeText(filterAccount)
      ) {
        return false;
      }

      if (filterMonth && r.date.slice(5, 7) !== filterMonth) {
        return false;
      }

      if (filterYear && r.date.slice(0, 4) !== filterYear) {
        return false;
      }

      return true;
    });
  }, [filterAccount, filterMonth, filterType, filterYear, income, searchQuery]);

  const totalIncome = filteredIncome.reduce(
    (sum, r) => sum + (r.amount || 0),
    0
  );
  const incomeCount = filteredIncome.length;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30 = new Date(now);
  last30.setDate(now.getDate() - 30);

  const thisMonthIncome = filteredIncome.reduce((sum, r) => {
    const d = parseYmd(r.date);
    if (!d) {
      return sum;
    }
    return d >= startOfMonth ? sum + (r.amount || 0) : sum;
  }, 0);

  const last30DaysIncome = filteredIncome.reduce((sum, r) => {
    const d = parseYmd(r.date);
    if (!d) {
      return sum;
    }
    return d >= last30 ? sum + (r.amount || 0) : sum;
  }, 0);

  const handleAddIncome = useCallback(() => {
    setEditingIncome(null);
    setDraft({
      date: todayYmd(),
      type: 'BUSINESS_DRAW',
      amount: 0,
      account: '',
      accountId: null,
      notes: '',
    });
    setIsModalOpen(true);
  }, []);

  const handleEditIncome = useCallback((row: PersonalIncomeRow) => {
    setEditingIncome(row);
    setDraft({
      date: row.date,
      type: row.type,
      amount: row.amount,
      account: row.account,
      accountId: row.accountId ?? null,
      notes: row.notes,
    });
    setIsModalOpen(true);
  }, []);

  const handleDeleteIncome = useCallback(
    (id: string) => {
      void (async () => {
        const confirmed = await confirmTripleDelete({
          title: 'Delete income record?',
          warning: 'This will permanently delete this income entry.',
          secondaryWarning:
            'Deleting will also affect your linked account balance.',
          finalPrompt: 'Type DELETE to confirm.',
        });
        if (!confirmed) {
          return;
        }

        try {
          await showLoading('Deleting...');

          await deleteIncome(id);

          await closeAlert();
          await showSuccess('Income record deleted successfully.', 'Deleted');
        } catch (error) {
          await closeAlert();
          await showError(
            error instanceof Error
              ? error.message
              : 'Unable to delete income record.',
            'Delete failed'
          );
        }
      })();
    },
    [deleteIncome]
  );

  const handleSaveIncome = useCallback(() => {
    const date = draft.date.trim();
    const amount = Number(draft.amount);

    if (!date) {
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    void (async () => {
      const payload: PersonalIncomeDraft = {
        ...draft,
        date,
        amount,
        account: draft.account.trim(),
        accountId: draft.accountId ?? null,
        notes: draft.notes.trim(),
      };

      try {
        if (editingIncome) {
          await updateIncome({ id: editingIncome.id, draft: payload });
        } else {
          await createIncome(payload);
        }

        setIsModalOpen(false);
      } catch (error) {
        await showError(
          error instanceof Error
            ? error.message
            : 'Unable to save income record.',
          'Save failed'
        );
      }
    })();
  }, [createIncome, draft, editingIncome, updateIncome]);

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
          await showInfo('The CSV file is empty.', 'No data');
          return;
        }

        const headers = parseCSVLine(lines[0]).map((h) =>
          h.trim().toLowerCase()
        );
        const required = ['date', 'type', 'amount', 'account', 'notes'];
        const missing = validateCSVHeaders(headers, required);
        if (missing.length > 0) {
          await showError(
            `Missing columns: ${missing.join(', ')}`,
            'Invalid CSV'
          );
          return;
        }

        const idx = (name: string) => headers.indexOf(name);
        const idxDate = idx('date');
        const idxType = idx('type');
        const idxAmount = idx('amount');
        const idxAccount = idx('account');
        const idxNotes = idx('notes');

        let imported = 0;
        let skipped = 0;

        for (const line of lines.slice(1)) {
          const cols = parseCSVLine(line);
          if (cols.length === 0) {
            continue;
          }

          const date = (cols[idxDate] || '').trim();
          const type = (cols[idxType] || '')
            .trim()
            .toUpperCase() as PersonalIncomeType;
          const amount = Number((cols[idxAmount] || '').trim());
          const account = (cols[idxAccount] || '').trim();
          const notes = (cols[idxNotes] || '').trim();

          if (!date || !Number.isFinite(amount) || amount <= 0) {
            skipped += 1;
            continue;
          }

          try {
            await createIncome({
              date,
              type,
              amount,
              account,
              accountId: null,
              notes,
            });
            imported += 1;
          } catch (error) {
            skipped += 1;
            // continue to next row
            // eslint-disable-next-line no-continue
            continue;
          }
        }

        await showSuccess(
          `Imported ${imported} rows. Skipped ${skipped}.`,
          'Import complete'
        );
      } finally {
        setIsImporting(false);
      }
    },
    [createIncome]
  );

  const handleExportCSV = useCallback(() => {
    exportIncomeCSV();
  }, [exportIncomeCSV]);

  return {
    income,
    filteredIncome,
    accountOptions,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    filterAccount,
    setFilterAccount,
    filterMonth,
    setFilterMonth,
    filterYear,
    setFilterYear,
    monthOptions,
    yearOptions,
    isModalOpen,
    setIsModalOpen,
    editingIncome,
    setEditingIncome,
    draft,
    setDraft,
    isImporting,
    setIsImporting,
    types,
    accounts,
    totals: {
      totalIncome,
      incomeCount,
      thisMonthIncome,
      last30DaysIncome,
    },
    handleAddIncome,
    handleEditIncome,
    handleDeleteIncome,
    handleSaveIncome,
    handleImportCSV,
    handleExportCSV,
  } as const;
}
