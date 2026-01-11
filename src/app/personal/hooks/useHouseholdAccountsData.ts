import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exportToCSV } from '@/components/expenses';
import type { PersonalAccountDraft } from '@/app/personal/accounts/components/AccountFormDialog';
import type { PersonalAccountRow } from '@/app/personal/accounts/components/AccountsListTable';
import {
  HouseholdAccountService,
  type HouseholdAccountDTO,
} from '@/services/HouseholdAccountService';

export type HouseholdAccountOption = { value: string; label: string };

function mapDtoToRow(dto: HouseholdAccountDTO): PersonalAccountRow {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type as PersonalAccountRow['type'],
    institution: dto.institution ?? '',
    accountNumberLast4: dto.accountNumberLast4 ?? '',
    isActive: dto.isActive !== false,
    balance: Number(dto.balance || 0),
  } satisfies PersonalAccountRow;
}

export function useHouseholdAccountsData() {
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: ['household-accounts'],
    queryFn: () => HouseholdAccountService.getAll(),
  });

  const accounts = useMemo<PersonalAccountRow[]>(() => {
    if (!Array.isArray(accountsQuery.data)) {
      return [];
    }
    return accountsQuery.data.map(mapDtoToRow);
  }, [accountsQuery.data]);

  const accountOptions = useMemo<HouseholdAccountOption[]>(() => {
    return accounts
      .filter((a) => a.isActive)
      .map((a) => ({ value: a.id, label: a.name }));
  }, [accounts]);

  const createAccount = useMutation({
    mutationFn: (draft: PersonalAccountDraft) =>
      HouseholdAccountService.create({
        name: draft.name.trim(),
        type: draft.type,
        institution: draft.institution.trim(),
        accountNumberLast4: draft.accountNumberLast4.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['household-accounts'] });
    },
  });

  const updateAccount = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: PersonalAccountDraft }) =>
      HouseholdAccountService.update(id, {
        name: draft.name.trim(),
        type: draft.type,
        institution: draft.institution.trim(),
        accountNumberLast4: draft.accountNumberLast4.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['household-accounts'] });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: (id: string) => HouseholdAccountService.deleteById(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['household-accounts'] });
    },
  });

  const exportAccountsCSV = useCallback(() => {
    exportToCSV(
      accounts,
      ['name', 'type', 'institution', 'last4', 'status', 'balance'],
      'personal-accounts',
      (a) => [
        a.name,
        a.type,
        a.institution,
        a.accountNumberLast4,
        a.isActive ? 'active' : 'inactive',
        a.balance,
      ]
    );
  }, [accounts]);

  const isSaving =
    createAccount.isPending ||
    updateAccount.isPending ||
    deleteAccount.isPending;

  return {
    accounts,
    accountOptions,
    isLoading: accountsQuery.isLoading,
    isFetching: accountsQuery.isFetching,
    isSaving,
    createAccount: createAccount.mutateAsync,
    updateAccount: updateAccount.mutateAsync,
    deleteAccount: deleteAccount.mutateAsync,
    exportAccountsCSV,
  } as const;
}
