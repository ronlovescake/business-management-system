import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { HouseholdRecurringPaymentService } from '@/services/HouseholdRecurringPaymentService';
import { useHouseholdExpenses } from './useHouseholdExpenses';

export function usePersonalExpensesView() {
  const [recurringSearchQuery, setRecurringSearchQuery] = useState('');
  const [recurringAddOpened, setRecurringAddOpened] = useState(false);
  const [lastRecurringGenerateResult, setLastRecurringGenerateResult] =
    useState<{ month: string; created: number; skipped: number } | null>();

  const queryClient = useQueryClient();
  const householdExpensesQueryKey = queryKeys.household.expenses.list();

  const generateRecurringMutation = useMutation({
    mutationFn: () => HouseholdRecurringPaymentService.generate(),
    onSuccess: async (result) => {
      setLastRecurringGenerateResult(result);
      await queryClient.invalidateQueries({
        queryKey: householdExpensesQueryKey,
      });
    },
  });

  const expensesState = useHouseholdExpenses();

  const accountLabelById = useMemo(() => {
    return new Map(
      expensesState.accountOptions.map((opt) => [opt.value, opt.label])
    );
  }, [expensesState.accountOptions]);

  const getAccountLabel = (accountId: string | null | undefined) => {
    if (!accountId) {
      return '—';
    }
    return accountLabelById.get(accountId) || '—';
  };

  return {
    recurringSearchQuery,
    setRecurringSearchQuery,
    recurringAddOpened,
    setRecurringAddOpened,
    lastRecurringGenerateResult,
    generateRecurringMutation,
    getAccountLabel,
    accountLabelById,
    ...expensesState,
  } as const;
}
