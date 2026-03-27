import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  HouseholdExpenseService,
  type HouseholdExpenseDTO,
} from '@/services/ExpenseService';

export function useHouseholdExpenseData() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.household.expenses.list();

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => HouseholdExpenseService.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (newItem: Partial<HouseholdExpenseDTO>) =>
      HouseholdExpenseService.create(newItem),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string | number;
      data: Partial<HouseholdExpenseDTO>;
    }) => HouseholdExpenseService.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => HouseholdExpenseService.deleteById(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (newData: HouseholdExpenseDTO[]) =>
      HouseholdExpenseService.bulkUpdate(newData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (newData: Partial<HouseholdExpenseDTO>[]) =>
      HouseholdExpenseService.bulkCreate(newData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    data,
    isLoading,
    error,
    refetch,
    create: createMutation.mutate,
    update: updateMutation.mutate,
    delete: deleteMutation.mutate,
    bulkUpdate: bulkUpdateMutation.mutate,
    bulkCreate: bulkCreateMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,
  };
}
