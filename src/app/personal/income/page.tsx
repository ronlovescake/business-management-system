'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import Swal from 'sweetalert2';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  IncomeFormDialog,
  type PersonalIncomeDraft,
} from './components/IncomeFormDialog';
import {
  IncomeListTable,
  type PersonalIncomeRow,
} from './components/IncomeListTable';
import { IncomeControls } from './components/IncomeControls';
import { IncomeStatsCards } from './components/IncomeStatsCards';
import { IncomeAnalyticsTable } from './components/IncomeAnalyticsTable';

const EMPTY_DRAFT: PersonalIncomeDraft = {
  date: '',
  type: 'BUSINESS_DRAW',
  amount: 0,
  account: '',
  accountId: null,
  notes: '',
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatCurrencyPhp(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function parseYmd(date: string): Date | null {
  const match = /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (!match) {
    return null;
  }
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

type HouseholdIncomeApiRow = {
  id: string;
  date: string;
  type: PersonalIncomeRow['type'];
  amount: number;
  account: string | null;
  accountId: string | null;
  notes: string | null;
};

type HouseholdAccountOption = { value: string; label: string };

async function fetchHouseholdAccountOptions(): Promise<
  HouseholdAccountOption[]
> {
  const res = await fetch('/api/household/accounts', { cache: 'no-store' });
  const payload = (await res.json()) as unknown;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (payload as any)?.data ?? payload;
  if (!Array.isArray(data)) {
    return [];
  }

  return (data as Array<{ id: string; name: string; isActive?: boolean }>)
    .filter((a) => a && typeof a.id === 'string' && typeof a.name === 'string')
    .filter((a) => a.isActive !== false)
    .map((a) => ({ value: a.id, label: a.name }));
}

async function fetchHouseholdIncome(): Promise<PersonalIncomeRow[]> {
  const res = await fetch('/api/household/income', { cache: 'no-store' });
  const payload = (await res.json()) as unknown;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (payload as any)?.data ?? payload;
  if (!Array.isArray(data)) {
    return [];
  }

  return (data as HouseholdIncomeApiRow[]).map((row) => ({
    id: row.id,
    date: row.date,
    type: row.type,
    amount: Number(row.amount || 0),
    account: row.account ?? '',
    accountId: row.accountId ?? null,
    notes: row.notes ?? '',
  }));
}

async function createHouseholdIncome(
  draft: PersonalIncomeDraft
): Promise<void> {
  await fetch('/api/household/income', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: draft.date,
      type: draft.type,
      amount: draft.amount,
      account: draft.account,
      accountId: draft.accountId ?? null,
      notes: draft.notes,
    }),
  });
}

async function updateHouseholdIncome(
  id: string,
  draft: PersonalIncomeDraft
): Promise<void> {
  await fetch('/api/household/income', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      date: draft.date,
      type: draft.type,
      amount: draft.amount,
      account: draft.account,
      accountId: draft.accountId ?? null,
      notes: draft.notes,
    }),
  });
}

async function deleteHouseholdIncome(id: string): Promise<void> {
  const res = await fetch(
    `/api/household/income?id=${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to delete income (HTTP ${res.status})`);
  }
}

async function confirmTripleDeleteIncome(): Promise<boolean> {
  const step1 = await Swal.fire({
    title: 'Delete income record?',
    text: 'This will permanently delete this income entry.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Continue',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    allowOutsideClick: false,
  });

  if (!step1.isConfirmed) {
    return false;
  }

  const step2 = await Swal.fire({
    title: 'Are you absolutely sure?',
    text: 'Deleting will also affect your linked account balance.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Yes, continue',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    allowOutsideClick: false,
  });

  if (!step2.isConfirmed) {
    return false;
  }

  const step3 = await Swal.fire({
    title: 'Final confirmation',
    text: 'Type DELETE to confirm.',
    icon: 'warning',
    input: 'text',
    inputPlaceholder: 'DELETE',
    inputAttributes: { autocapitalize: 'off' },
    showCancelButton: true,
    confirmButtonText: 'Delete',
    cancelButtonText: 'Cancel',
    reverseButtons: true,
    allowOutsideClick: false,
    inputValidator: (value) => {
      if ((value || '').trim().toUpperCase() !== 'DELETE') {
        return 'Please type DELETE to confirm.';
      }
      return undefined;
    },
  });

  return step3.isConfirmed;
}

export default function PersonalIncomePage() {
  const [income, setIncome] = React.useState<PersonalIncomeRow[]>([]);
  const [accountOptions, setAccountOptions] = React.useState<
    HouseholdAccountOption[]
  >([]);

  const [activeTab, setActiveTab] = React.useState<string | null>('list');

  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<string | null>(null);
  const [filterAccount, setFilterAccount] = React.useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingIncome, setEditingIncome] =
    React.useState<PersonalIncomeRow | null>(null);
  const [draft, setDraft] = React.useState<PersonalIncomeDraft>({
    ...EMPTY_DRAFT,
    date: todayYmd(),
  });
  const [isImporting, setIsImporting] = React.useState(false);

  const types = React.useMemo(() => {
    const unique = new Set(income.map((r) => r.type));
    return Array.from(unique);
  }, [income]);

  const accounts = React.useMemo(() => {
    const unique = new Set(
      income.map((r) => r.account).filter((x) => x.trim().length > 0)
    );
    return Array.from(unique);
  }, [income]);

  const filteredIncome = React.useMemo(() => {
    const q = normalize(searchQuery);
    return income.filter((r) => {
      if (q) {
        const hay = [r.date, r.type, r.account, String(r.amount), r.notes]
          .filter(Boolean)
          .join(' ');
        if (!normalize(hay).includes(q)) {
          return false;
        }
      }

      if (filterType && r.type !== filterType) {
        return false;
      }

      if (filterAccount && normalize(r.account) !== normalize(filterAccount)) {
        return false;
      }

      return true;
    });
  }, [filterAccount, filterType, income, searchQuery]);

  const totalIncome = income.reduce((sum, r) => sum + (r.amount || 0), 0);
  const incomeCount = income.length;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30 = new Date(now);
  last30.setDate(now.getDate() - 30);

  const thisMonthIncome = income.reduce((sum, r) => {
    const d = parseYmd(r.date);
    if (!d) {
      return sum;
    }
    return d >= startOfMonth ? sum + (r.amount || 0) : sum;
  }, 0);

  const last30DaysIncome = income.reduce((sum, r) => {
    const d = parseYmd(r.date);
    if (!d) {
      return sum;
    }
    return d >= last30 ? sum + (r.amount || 0) : sum;
  }, 0);

  const handleAddIncome = React.useCallback(() => {
    setEditingIncome(null);
    setDraft({ ...EMPTY_DRAFT, date: todayYmd() });
    setIsModalOpen(true);
  }, []);

  const handleEditIncome = React.useCallback((row: PersonalIncomeRow) => {
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

  const handleDeleteIncome = React.useCallback((id: string) => {
    void (async () => {
      const confirmed = await confirmTripleDeleteIncome();
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

        await deleteHouseholdIncome(id);
        const next = await fetchHouseholdIncome();
        setIncome(next);

        await Swal.fire({
          icon: 'success',
          title: 'Deleted',
          text: 'Income record deleted successfully.',
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
              : 'Unable to delete income record.',
        });
      }
    })();
  }, []);

  const handleSaveIncome = React.useCallback(() => {
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

      if (editingIncome) {
        await updateHouseholdIncome(editingIncome.id, payload);
      } else {
        await createHouseholdIncome(payload);
      }

      const next = await fetchHouseholdIncome();
      setIncome(next);
      setIsModalOpen(false);
    })();
  }, [draft, editingIncome]);

  React.useEffect(() => {
    let active = true;

    void fetchHouseholdIncome()
      .then((data) => {
        if (active) {
          setIncome(data);
        }
      })
      .catch(() => {});

    void fetchHouseholdAccountOptions()
      .then((options) => {
        if (active) {
          setAccountOptions(options);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const handleImportCSV = React.useCallback(async (_file: File | null) => {
    setIsImporting(true);
    setIsImporting(false);
  }, []);

  const handleExportCSV = React.useCallback(() => {
    const header = ['date', 'type', 'amount', 'account', 'notes'];
    const rows = income.map((r) => [
      r.date,
      r.type,
      String(r.amount || 0),
      r.account,
      r.notes,
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'personal-income.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, [income]);

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <IncomeStatsCards
          totalIncome={totalIncome}
          incomeCount={incomeCount}
          thisMonthIncome={thisMonthIncome}
          last30DaysIncome={last30DaysIncome}
          formatCurrency={formatCurrencyPhp}
        />

        <IncomeControls
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterType={filterType}
          onTypeFilterChange={setFilterType}
          filterAccount={filterAccount}
          onAccountFilterChange={setFilterAccount}
          types={types}
          accounts={accounts}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAddIncome={handleAddIncome}
          isImporting={isImporting}
        />

        {activeTab === 'list' ? (
          <IncomeListTable
            income={income}
            filteredIncome={filteredIncome}
            formatCurrency={formatCurrencyPhp}
            onEdit={handleEditIncome}
            onDelete={handleDeleteIncome}
          />
        ) : (
          <IncomeAnalyticsTable
            income={filteredIncome}
            formatCurrency={formatCurrencyPhp}
          />
        )}
      </Stack>

      <IncomeFormDialog
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingIncome ? 'EDIT PERSONAL INCOME' : 'ADD PERSONAL INCOME'}
        description={
          editingIncome
            ? 'Update this income record.'
            : 'Add money coming into your household (business draw, salary, refund, etc.).'
        }
        initial={draft}
        onChange={setDraft}
        onSave={handleSaveIncome}
        accountOptions={accountOptions}
      />
    </PageLayout>
  );
}
