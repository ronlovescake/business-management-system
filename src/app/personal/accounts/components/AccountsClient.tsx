'use client';

import React from 'react';
import { Stack } from '@mantine/core';
import {
  AccountFormDialog,
  type PersonalAccountDraft,
} from './AccountFormDialog';
import { AccountsTable, type PersonalAccountRow } from './AccountsTable';

const EMPTY_DRAFT: PersonalAccountDraft = {
  name: '',
  type: 'CASH',
  institution: '',
  accountNumberLast4: '',
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

export function AccountsClient() {
  const [search, setSearch] = React.useState('');
  const [accounts, setAccounts] = React.useState<PersonalAccountRow[]>([
    {
      id: newId(),
      name: 'Cash Wallet',
      type: 'CASH',
      institution: '',
      accountNumberLast4: '',
      isActive: true,
    },
    {
      id: newId(),
      name: 'GCash - Ron',
      type: 'EWALLET',
      institution: 'GCash',
      accountNumberLast4: '',
      isActive: true,
    },
  ]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<PersonalAccountDraft>(EMPTY_DRAFT);

  const filtered = React.useMemo(() => {
    const q = normalize(search);
    if (!q) {
      return accounts;
    }
    return accounts.filter((a) => {
      const hay = [a.name, a.type, a.institution, a.accountNumberLast4]
        .filter(Boolean)
        .join(' ');
      return normalize(hay).includes(q);
    });
  }, [accounts, search]);

  const openAdd = React.useCallback(() => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback(
    (id: string) => {
      const acc = accounts.find((a) => a.id === id);
      if (!acc) {
        return;
      }
      setEditingId(id);
      setDraft({
        name: acc.name,
        type: acc.type,
        institution: acc.institution,
        accountNumberLast4: acc.accountNumberLast4,
      });
      setDialogOpen(true);
    },
    [accounts]
  );

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
  }, []);

  const onSave = React.useCallback(() => {
    const name = draft.name.trim();
    if (!name) {
      return;
    }

    if (editingId) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === editingId
            ? {
                ...a,
                name,
                type: draft.type,
                institution: draft.institution.trim(),
                accountNumberLast4: draft.accountNumberLast4.trim(),
              }
            : a
        )
      );
    } else {
      setAccounts((prev) => [
        {
          id: newId(),
          name,
          type: draft.type,
          institution: draft.institution.trim(),
          accountNumberLast4: draft.accountNumberLast4.trim(),
          isActive: true,
        },
        ...prev,
      ]);
    }

    setDialogOpen(false);
  }, [draft, editingId]);

  return (
    <Stack gap="md">
      <AccountsTable
        accounts={filtered}
        search={search}
        onSearchChange={setSearch}
        onAdd={openAdd}
        onEdit={openEdit}
      />

      <AccountFormDialog
        opened={dialogOpen}
        onClose={closeDialog}
        title={editingId ? 'EDIT PERSONAL ACCOUNT' : 'ADD PERSONAL ACCOUNT'}
        description={
          editingId
            ? 'Update this account’s details.'
            : 'Add an account to track where money lives (cash, bank, e-wallet, etc.).'
        }
        initial={draft}
        onChange={setDraft}
        onSave={onSave}
      />
    </Stack>
  );
}
