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
  notes: '',
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayYmd(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function IncomeClient() {
  const [search, setSearch] = React.useState('');
  const [income, setIncome] = React.useState<PersonalIncomeRow[]>([
    {
      id: newId(),
      date: todayYmd(),
      type: 'BUSINESS_DRAW',
      amount: 1500,
      account: 'Cash Wallet',
      notes: 'Owner draw',
    },
    {
      id: newId(),
      date: todayYmd(),
      type: 'REFUND',
      amount: 300,
      account: 'GCash - Ron',
      notes: 'Returned item refund',
    },
  ]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<PersonalIncomeDraft>({
    ...EMPTY_DRAFT,
    date: todayYmd(),
  });

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

    if (editingId) {
      setIncome((prev) =>
        prev.map((r) =>
          r.id === editingId
            ? {
                ...r,
                date,
                type: draft.type,
                amount,
                account: draft.account.trim(),
                notes: draft.notes.trim(),
              }
            : r
        )
      );
    } else {
      setIncome((prev) => [
        {
          id: newId(),
          date,
          type: draft.type,
          amount,
          account: draft.account.trim(),
          notes: draft.notes.trim(),
        },
        ...prev,
      ]);
    }

    setDialogOpen(false);
  }, [draft, editingId]);

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
      />
    </Stack>
  );
}
