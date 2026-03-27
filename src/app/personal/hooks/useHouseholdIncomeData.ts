import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { exportToCSV } from '@/components/expenses';
import { queryKeys } from '@/lib/queryKeys';
import type { PersonalIncomeDraft } from '@/app/personal/income/components/IncomeFormDialog';
import type { PersonalIncomeRow } from '@/app/personal/income/components/IncomeListTable';
import {
  HouseholdIncomeService,
  type HouseholdIncomeDTO,
} from '@/services/HouseholdIncomeService';
import {
  HouseholdAccountService,
  type HouseholdAccountDTO,
} from '@/services/HouseholdAccountService';
import type { HouseholdAccountOption } from './useHouseholdAccountsData';

function mapIncome(dto: HouseholdIncomeDTO): PersonalIncomeRow {
  return {
    id: dto.id,
    date: dto.date,
    type: dto.type as PersonalIncomeRow['type'],
    amount: Number(dto.amount || 0),
    account: dto.account ?? '',
    accountId: dto.accountId ?? null,
    notes: dto.notes ?? '',
  } satisfies PersonalIncomeRow;
}

function mapAccountOptions(
  data: HouseholdAccountDTO[]
): HouseholdAccountOption[] {
  return data
    .filter((a) => a && typeof a.id === 'string' && typeof a.name === 'string')
    .filter((a) => a.isActive !== false)
    .map((a) => ({ value: a.id, label: a.name }));
}

export function useHouseholdIncomeData() {
  const queryClient = useQueryClient();
  const incomeQueryKey = queryKeys.household.income.list();
  const accountsQueryKey = queryKeys.household.accounts.list();

  const incomeQuery = useQuery({
    queryKey: incomeQueryKey,
    queryFn: () => HouseholdIncomeService.getAll(),
  });

  const accountsQuery = useQuery({
    queryKey: accountsQueryKey,
    queryFn: () => HouseholdAccountService.getAll(),
  });

  const income = useMemo<PersonalIncomeRow[]>(() => {
    if (!Array.isArray(incomeQuery.data)) {
      return [];
    }
    return incomeQuery.data.map(mapIncome);
  }, [incomeQuery.data]);

  const accountOptions = useMemo<HouseholdAccountOption[]>(() => {
    if (!Array.isArray(accountsQuery.data)) {
      return [];
    }
    return mapAccountOptions(accountsQuery.data);
  }, [accountsQuery.data]);

  const createIncome = useMutation({
    mutationFn: (draft: PersonalIncomeDraft) =>
      HouseholdIncomeService.create({
        date: draft.date,
        type: draft.type,
        amount: draft.amount,
        account: draft.account,
        accountId: draft.accountId ?? null,
        notes: draft.notes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: incomeQueryKey });
    },
  });

  const updateIncome = useMutation({
    mutationFn: ({ id, draft }: { id: string; draft: PersonalIncomeDraft }) =>
      HouseholdIncomeService.update(id, {
        date: draft.date,
        type: draft.type,
        amount: draft.amount,
        account: draft.account,
        accountId: draft.accountId ?? null,
        notes: draft.notes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: incomeQueryKey });
    },
  });

  const deleteIncome = useMutation({
    mutationFn: (id: string) => HouseholdIncomeService.deleteById(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: incomeQueryKey });
    },
  });

  const exportIncomeCSV = useCallback(() => {
    exportToCSV(
      income,
      ['date', 'type', 'amount', 'account', 'notes'],
      'personal-income',
      (r) => [r.date, r.type, r.amount, r.account, r.notes]
    );
  }, [income]);

  const isSaving =
    createIncome.isPending || updateIncome.isPending || deleteIncome.isPending;

  return {
    income,
    accountOptions,
    isLoading: incomeQuery.isLoading || accountsQuery.isLoading,
    isFetching: incomeQuery.isFetching || accountsQuery.isFetching,
    isSaving,
    createIncome: createIncome.mutateAsync,
    updateIncome: updateIncome.mutateAsync,
    deleteIncome: deleteIncome.mutateAsync,
    exportIncomeCSV,
  } as const;
}
