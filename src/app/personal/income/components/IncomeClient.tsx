'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import { IncomeFormDialog, type PersonalIncomeDraft } from './IncomeFormDialog';
import { IncomeTable, type PersonalIncomeRow } from './IncomeTable';

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

type HouseholdIncomeApiRow = {
  id: string;
  date: string;
  type: PersonalIncomeDraft['type'];
  amount: number;
  account: string | null;
  accountId: string | null;
  notes: string | null;
};

type HouseholdAccountOption = { value: string; label: string };

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function IncomeClient() {
  const [search, setSearch] = React.useState('');
  const [income, setIncome] = React.useState<PersonalIncomeRow[]>([]);
  const [accountOptions, setAccountOptions] = React.useState<
    HouseholdAccountOption[]
  >([]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<PersonalIncomeDraft>({
    ...EMPTY_DRAFT,
    date: todayYmd(),
  });

  const reloadIncome = React.useCallback(async () => {
    const res = await fetch('/api/household/income', { cache: 'no-store' });
    const payload = (await res.json()) as unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (payload as any)?.data ?? payload;
    if (!Array.isArray(data)) {
      setIncome([]);
      return;
    }
    const rows = (data as HouseholdIncomeApiRow[]).map((row) => ({
      id: row.id,
      date: row.date,
      type: row.type,
      amount: Number(row.amount || 0),
      account: row.account ?? '',
      accountId: row.accountId ?? null,
      notes: row.notes ?? '',
    }));
    setIncome(rows);
  }, []);

  const reloadAccounts = React.useCallback(async () => {
    const res = await fetch('/api/household/accounts', { cache: 'no-store' });
    const payload = (await res.json()) as unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (payload as any)?.data ?? payload;
    if (!Array.isArray(data)) {
      setAccountOptions([]);
      return;
    }
    const options = (
      data as Array<{ id: string; name: string; isActive?: boolean }>
    )
      .filter(
        (a) => a && typeof a.id === 'string' && typeof a.name === 'string'
      )
      .filter((a) => a.isActive !== false)
      .map((a) => ({ value: a.id, label: a.name }));
    setAccountOptions(options);
  }, []);

  React.useEffect(() => {
    void reloadIncome();
    void reloadAccounts();
  }, [reloadIncome, reloadAccounts]);

  const filtered = React.useMemo(() => {
    const q = normalize(search);
    if (!q) {
      return income;
    }
    return income.filter((row) => {
      const hay = [
        row.date,
        row.type,
        row.account,
        String(row.amount),
        row.notes,
      ]
        .filter(Boolean)
        .join(' ');
      return normalize(hay).includes(q);
    });
  }, [income, search]);

  const openAdd = React.useCallback(() => {
    setEditingId(null);
    setDraft({ ...EMPTY_DRAFT, date: todayYmd() });
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback(
    (id: string) => {
      const row = income.find((r) => r.id === id);
      if (!row) {
        return;
      }
      setEditingId(id);
      setDraft({
        date: row.date,
        type: row.type,
        amount: row.amount,
        account: row.account,
        accountId: row.accountId ?? null,
        notes: row.notes,
      });
      setDialogOpen(true);
    },
    [income]
  );

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
  }, []);

  const onSave = React.useCallback(() => {
    const date = draft.date.trim();
    const amount = Number(draft.amount);

    if (!date) {
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    void (async () => {
      const payload = {
        date,
        type: draft.type,
        amount,
        accountId: draft.accountId ?? null,
        notes: draft.notes.trim(),
      };

      if (editingId) {
        await fetch('/api/household/income', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...payload }),
        });
      } else {
        await fetch('/api/household/income', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      await reloadIncome();
      setDialogOpen(false);
    })();
  }, [draft, editingId, reloadIncome]);

  return (
    <Stack gap="md">
      <IncomeTable
        income={filtered}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        onEdit={openEdit}
      />

      <IncomeFormDialog
        opened={dialogOpen}
        onClose={closeDialog}
        title={editingId ? 'EDIT PERSONAL INCOME' : 'ADD PERSONAL INCOME'}
        description={
          editingId
            ? 'Update this income record.'
            : 'Add money coming into your household (business draw, salary, refund, etc.).'
        }
        initial={draft}
        onChange={setDraft}
        onSave={onSave}
        accountOptions={accountOptions}
      />
    </Stack>
  );
}
