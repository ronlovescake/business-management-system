import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  CustomerService,
  ProductService,
  TransactionService,
  ShipmentService,
  PriceService,
  ExpenseService,
  TruckingExpenseService,
  HouseholdExpenseService,
} from '../services';
import type {
  CustomerDTO,
  ProductDTO,
  TransactionDTO,
  ShipmentDTO,
  PriceDTO,
  ExpenseDTO,
} from '../types';
import type { HouseholdExpenseDTO } from '@/services/ExpenseService';

/**
 * Customer Data Hook
 */
export function useCustomerData() {
  const queryClient = useQueryClient();
  const queryKey = ['customers'];

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => CustomerService.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (newItem: Partial<CustomerDTO>) =>
      CustomerService.create(newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // Also invalidate dispatch page customer cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.withShopee(),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string | number;
      data: Partial<CustomerDTO>;
    }) => CustomerService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // Also invalidate dispatch page customer cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.withShopee(),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => CustomerService.deleteById(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // Also invalidate dispatch page customer cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.withShopee(),
      });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (newData: CustomerDTO[]) => CustomerService.bulkUpdate(newData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // Also invalidate dispatch page customer cache
      queryClient.invalidateQueries({
        queryKey: queryKeys.customers.withShopee(),
      });
    },
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
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,
  };
}

/**
 * Product Data Hook
 */
export function useProductData() {
  const queryClient = useQueryClient();
  const queryKey = ['products'];

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => ProductService.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (newItem: Partial<ProductDTO>) =>
      ProductService.create(newItem),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (newData: ProductDTO[]) => ProductService.bulkUpdate(newData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    data,
    isLoading,
    error,
    refetch,
    create: createMutation.mutate,
    bulkUpdate: bulkUpdateMutation.mutate,
    isCreating: createMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,
  };
}

/**
 * Transaction Data Hook
 */
export function useTransactionData() {
  const queryClient = useQueryClient();
  const queryKey = ['transactions'];

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => TransactionService.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string | number;
      data: Partial<TransactionDTO>;
    }) => TransactionService.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousTransactions =
        queryClient.getQueryData<TransactionDTO[]>(queryKey);

      // Optimistically update to the new value
      queryClient.setQueryData<TransactionDTO[]>(queryKey, (old = []) => {
        return old.map((transaction) =>
          transaction.id === id ? { ...transaction, ...data } : transaction
        );
      });

      // Return context with the previous value
      return { previousTransactions };
    },
    onError: (_err, _variables, context) => {
      // If the mutation fails, rollback to the previous value
      if (context?.previousTransactions) {
        queryClient.setQueryData(queryKey, context.previousTransactions);
      }
    },
    // Removed onSettled - optimistic updates are sufficient for single edits
    // Only refetch on error (handled by onError rollback)
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (newData: TransactionDTO[]) =>
      TransactionService.bulkUpdate(newData),
    onMutate: async (newData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousTransactions =
        queryClient.getQueryData<TransactionDTO[]>(queryKey);

      // Create a map for quick lookups
      const updateMap = new Map(newData.map((t) => [t.id, t]));

      // Optimistically update transactions
      queryClient.setQueryData<TransactionDTO[]>(queryKey, (old = []) => {
        return old.map((transaction) => {
          const update = updateMap.get(transaction.id);
          return update ? { ...transaction, ...update } : transaction;
        });
      });

      return { previousTransactions };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousTransactions) {
        queryClient.setQueryData(queryKey, context.previousTransactions);
      }
    },
    // Removed onSettled - optimistic updates are sufficient for bulk edits
    // Only refetch on error (handled by onError rollback)
  });

  return {
    data,
    isLoading,
    error,
    refetch,
    update: updateMutation.mutate,
    bulkUpdate: bulkUpdateMutation.mutate,
    isUpdating: updateMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,
  };
}

/**
 * Shipment Data Hook
 */
export function useShipmentData() {
  const queryClient = useQueryClient();
  const queryKey = ['shipments'];

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => ShipmentService.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (newData: ShipmentDTO[]) => ShipmentService.bulkUpdate(newData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    data,
    isLoading,
    error,
    refetch,
    bulkUpdate: bulkUpdateMutation.mutate,
    isBulkUpdating: bulkUpdateMutation.isPending,
  };
}

/**
 * Price Data Hook
 */
export function usePriceData() {
  const queryClient = useQueryClient();
  const queryKey = ['prices'];

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => PriceService.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (newItem: Partial<PriceDTO>) => PriceService.create(newItem),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (newData: PriceDTO[]) => PriceService.bulkUpdate(newData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    data,
    isLoading,
    error,
    refetch,
    create: createMutation.mutate,
    bulkUpdate: bulkUpdateMutation.mutate,
    isCreating: createMutation.isPending,
    isBulkUpdating: bulkUpdateMutation.isPending,
  };
}

/**
 * Expense Data Hook
 */
export function useExpenseData() {
  return useExpenseDataFactory(ExpenseService, ['expenses']);
}

export function useTruckingExpenseData() {
  return useExpenseDataFactory(TruckingExpenseService, ['trucking-expenses']);
}

export function useHouseholdExpenseData() {
  return useHouseholdExpenseDataFactory(HouseholdExpenseService, [
    'household-expenses',
  ]);
}

type ExpenseServiceClass = {
  getAll: () => Promise<ExpenseDTO[]>;
  create: (expense: Partial<ExpenseDTO>) => Promise<ExpenseDTO>;
  update: (
    id: string | number,
    expense: Partial<ExpenseDTO>
  ) => Promise<ExpenseDTO>;
  deleteById: (id: string | number) => Promise<void>;
  bulkUpdate: (expenses: ExpenseDTO[]) => Promise<{ count: number }>;
  bulkCreate: (expenses: Partial<ExpenseDTO>[]) => Promise<{ count: number }>;
};

function useExpenseDataFactory(
  service: ExpenseServiceClass,
  queryKey: QueryKey
) {
  const queryClient = useQueryClient();

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => service.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (newItem: Partial<ExpenseDTO>) => service.create(newItem),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string | number;
      data: Partial<ExpenseDTO>;
    }) => service.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => service.deleteById(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (newData: ExpenseDTO[]) => service.bulkUpdate(newData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (newData: Partial<ExpenseDTO>[]) => service.bulkCreate(newData),
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
    isBulkCreating: bulkCreateMutation.isPending,
  };
}

type HouseholdExpenseServiceClass = {
  getAll: () => Promise<HouseholdExpenseDTO[]>;
  create: (
    expense: Partial<HouseholdExpenseDTO>
  ) => Promise<HouseholdExpenseDTO>;
  update: (
    id: string | number,
    expense: Partial<HouseholdExpenseDTO>
  ) => Promise<HouseholdExpenseDTO>;
  deleteById: (id: string | number) => Promise<void>;
  bulkUpdate: (expenses: HouseholdExpenseDTO[]) => Promise<{ count: number }>;
  bulkCreate: (
    expenses: Partial<HouseholdExpenseDTO>[]
  ) => Promise<{ count: number }>;
};

function useHouseholdExpenseDataFactory(
  service: HouseholdExpenseServiceClass,
  queryKey: QueryKey
) {
  const queryClient = useQueryClient();

  const {
    data = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => service.getAll(),
    staleTime: 5 * 60 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (newItem: Partial<HouseholdExpenseDTO>) =>
      service.create(newItem),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string | number;
      data: Partial<HouseholdExpenseDTO>;
    }) => service.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string | number) => service.deleteById(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (newData: HouseholdExpenseDTO[]) => service.bulkUpdate(newData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (newData: Partial<HouseholdExpenseDTO>[]) =>
      service.bulkCreate(newData),
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
