'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import Swal from 'sweetalert2';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  AccountFormDialog,
  type PersonalAccountDraft,
} from './components/AccountFormDialog';
import {
  AccountsListTable,
  type PersonalAccountRow,
} from './components/AccountsListTable';
import { AccountsControls } from './components/AccountsControls';
import { AccountsStatsCards } from './components/AccountsStatsCards';
import { AccountsAnalyticsTable } from './components/AccountsAnalyticsTable';

const EMPTY_DRAFT: PersonalAccountDraft = {
  name: '',
  type: 'CASH',
  institution: '',
  accountNumberLast4: '',
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function formatCurrencyPhp(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

type HouseholdAccountApiRow = {
  id: string;
  name: string;
  type: PersonalAccountRow['type'];
  institution: string | null;
  accountNumberLast4: string | null;
  isActive: boolean;
  balance: number;
};

async function fetchHouseholdAccounts(): Promise<PersonalAccountRow[]> {
  const res = await fetch('/api/household/accounts', { cache: 'no-store' });
  const payload = (await res.json()) as unknown;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (payload as any)?.data ?? payload;
  if (!Array.isArray(data)) {
    return [];
  }

  return (data as HouseholdAccountApiRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    institution: row.institution ?? '',
    accountNumberLast4: row.accountNumberLast4 ?? '',
    isActive: !!row.isActive,
    balance: Number(row.balance || 0),
  }));
}

async function createHouseholdAccount(
  draft: PersonalAccountDraft
): Promise<void> {
  await fetch('/api/household/accounts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: draft.name,
      type: draft.type,
      institution: draft.institution,
      accountNumberLast4: draft.accountNumberLast4,
    }),
  });
}

async function updateHouseholdAccount(
  id: string,
  draft: PersonalAccountDraft
): Promise<void> {
  await fetch('/api/household/accounts', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      name: draft.name,
      type: draft.type,
      institution: draft.institution,
      accountNumberLast4: draft.accountNumberLast4,
    }),
  });
}

async function deleteHouseholdAccount(id: string): Promise<void> {
  const res = await fetch(
    `/api/household/accounts?id=${encodeURIComponent(id)}`,
    {
      method: 'DELETE',
    }
  );

  if (!res.ok) {
    throw new Error(`Failed to delete account (HTTP ${res.status})`);
  }
}

async function confirmTripleDeleteAccount(): Promise<boolean> {
  const step1 = await Swal.fire({
    title: 'Delete account?',
    text: 'This will permanently delete this account record.',
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
    text: 'If this account is linked to income/expenses, deletion may fail.',
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

export default function PersonalAccountsPage() {
  const [accounts, setAccounts] = React.useState<PersonalAccountRow[]>([]);

  const [activeTab, setActiveTab] = React.useState<string | null>('list');

  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<string | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<string | null>(null);
  const [filterInstitution, setFilterInstitution] = React.useState<
    string | null
  >(null);

  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] =
    React.useState<PersonalAccountRow | null>(null);
  const [draft, setDraft] = React.useState<PersonalAccountDraft>(EMPTY_DRAFT);
  const [isImporting, setIsImporting] = React.useState(false);

  const types = React.useMemo(() => {
    const unique = new Set(accounts.map((a) => a.type));
    return Array.from(unique);
  }, [accounts]);

  const institutions = React.useMemo(() => {
    const unique = new Set(
      accounts.map((a) => a.institution).filter((x) => x.trim().length > 0)
    );
    return Array.from(unique);
  }, [accounts]);

  const filteredAccounts = React.useMemo(() => {
    const q = normalize(searchQuery);
    return accounts.filter((a) => {
      if (q) {
        const hay = [a.name, a.type, a.institution, a.accountNumberLast4]
          .filter(Boolean)
          .join(' ');
        if (!normalize(hay).includes(q)) {
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
        if (normalize(a.institution) !== normalize(filterInstitution)) {
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

  const handleAddAccount = React.useCallback(() => {
    setEditingAccount(null);
    setDraft(EMPTY_DRAFT);
    setIsModalOpen(true);
  }, []);

  const handleEditAccount = React.useCallback((account: PersonalAccountRow) => {
    setEditingAccount(account);
    setDraft({
      name: account.name,
      type: account.type,
      institution: account.institution,
      accountNumberLast4: account.accountNumberLast4,
    });
    setIsModalOpen(true);
  }, []);

  const handleDeleteAccount = React.useCallback((id: string) => {
    void (async () => {
      const confirmed = await confirmTripleDeleteAccount();
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

        await deleteHouseholdAccount(id);
        const next = await fetchHouseholdAccounts();
        setAccounts(next);

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
  }, []);

  const handleSaveAccount = React.useCallback(() => {
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

      if (editingAccount) {
        await updateHouseholdAccount(editingAccount.id, payload);
      } else {
        await createHouseholdAccount(payload);
      }

      const next = await fetchHouseholdAccounts();
      setAccounts(next);
      setIsModalOpen(false);
    })();
  }, [draft, editingAccount]);

  React.useEffect(() => {
    let active = true;

    void fetchHouseholdAccounts()
      .then((data) => {
        if (active) {
          setAccounts(data);
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
    const header = [
      'name',
      'type',
      'institution',
      'last4',
      'status',
      'balance',
    ];
    const rows = accounts.map((a) => [
      a.name,
      a.type,
      a.institution,
      a.accountNumberLast4,
      a.isActive ? 'active' : 'inactive',
      String(a.balance || 0),
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
    link.download = 'personal-accounts.csv';
    link.click();
    URL.revokeObjectURL(url);
  }, [accounts]);

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <AccountsStatsCards
          totalAccounts={totalAccounts}
          activeAccounts={activeAccounts}
          totalBalance={totalBalance}
          thisMonthChange={thisMonthChange}
          formatCurrency={formatCurrencyPhp}
        />

        <AccountsControls
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterType={filterType}
          onTypeFilterChange={setFilterType}
          filterStatus={filterStatus}
          onStatusFilterChange={setFilterStatus}
          filterInstitution={filterInstitution}
          onInstitutionFilterChange={setFilterInstitution}
          types={types}
          institutions={institutions}
          onImportCSV={handleImportCSV}
          onExportCSV={handleExportCSV}
          onAddAccount={handleAddAccount}
          isImporting={isImporting}
        />

        {activeTab === 'list' ? (
          <AccountsListTable
            accounts={accounts}
            filteredAccounts={filteredAccounts}
            formatCurrency={formatCurrencyPhp}
            onEdit={handleEditAccount}
            onDelete={handleDeleteAccount}
          />
        ) : (
          <AccountsAnalyticsTable
            accounts={filteredAccounts}
            formatCurrency={formatCurrencyPhp}
          />
        )}
      </Stack>

      <AccountFormDialog
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingAccount ? 'EDIT PERSONAL ACCOUNT' : 'ADD PERSONAL ACCOUNT'
        }
        description={
          editingAccount
            ? 'Update this account’s details.'
            : 'Add an account to track where money lives (cash, bank, e-wallet, etc.).'
        }
        initial={draft}
        onChange={setDraft}
        onSave={handleSaveAccount}
      />
    </PageLayout>
  );
}
