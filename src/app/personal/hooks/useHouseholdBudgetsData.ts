import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  HouseholdBudgetService,
  type HouseholdBudgetDTO,
} from '@/services/HouseholdBudgetService';

export type HouseholdBudgetRow = HouseholdBudgetDTO;

export function useHouseholdBudgetsData() {
  const queryClient = useQueryClient();

  const budgetsQuery = useQuery({
    queryKey: ['household-budgets'],
    queryFn: () => HouseholdBudgetService.getAll(),
  });

  const budgets = useMemo<HouseholdBudgetRow[]>(() => {
    if (!Array.isArray(budgetsQuery.data)) {
      return [];
    }
    return budgetsQuery.data;
  }, [budgetsQuery.data]);

  const createBudget = useMutation({
    mutationFn: (
      payload: Omit<
        HouseholdBudgetDTO,
        'id' | 'createdAt' | 'updatedAt' | 'accountName'
      >
    ) => HouseholdBudgetService.create(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['household-budgets'] });
    },
  });

  const updateBudget = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<HouseholdBudgetDTO>;
    }) => HouseholdBudgetService.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['household-budgets'] });
    },
  });

  const deleteBudget = useMutation({
    mutationFn: (id: string) => HouseholdBudgetService.deleteById(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['household-budgets'] });
    },
  });

  const isSaving =
    createBudget.isPending || updateBudget.isPending || deleteBudget.isPending;

  return {
    budgets,
    isLoading: budgetsQuery.isLoading,
    isFetching: budgetsQuery.isFetching,
    isSaving,
    createBudget: createBudget.mutateAsync,
    updateBudget: updateBudget.mutateAsync,
    deleteBudget: deleteBudget.mutateAsync,
  } as const;
}
