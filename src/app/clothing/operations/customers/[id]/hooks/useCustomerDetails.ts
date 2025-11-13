'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showNotification } from '@mantine/notifications';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { CustomerData, Order, Transaction, CustomerStats } from '../types';

// ============================================================================
// CUSTOMER DETAILS HOOK
// ============================================================================

interface UseCustomerDetailsReturn {
  // Data
  customer: CustomerData | null;
  orders: Order[];
  transactions: Transaction[];
  stats: CustomerStats;

  // State
  loading: boolean;
  editModalOpen: boolean;
  editForm: Partial<CustomerData>;

  // Actions
  setEditModalOpen: (open: boolean) => void;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<CustomerData>>>;
  handleUpdateCustomer: () => Promise<void>;
  refetchData: () => Promise<void>;
}

export function useCustomerDetails(
  customerId: string
): UseCustomerDetailsReturn {
  const queryClient = useQueryClient();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CustomerData>>({});

  // ============================================================================
  // DATA FETCHING WITH REACT QUERY
  // ============================================================================

  // Fetch customer details
  const {
    data: customer,
    isLoading: customerLoading,
    refetch: refetchCustomer,
  } = useQuery({
    queryKey: queryKeys.customers.detail(customerId),
    queryFn: async (): Promise<CustomerData> => {
      return api.get<CustomerData>(`/api/customers/${customerId}`);
    },
    enabled: !!customerId,
    staleTime: 30 * 1000,
  });

  // Fetch orders
  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: [...queryKeys.customers.detail(customerId), 'orders'],
    queryFn: async (): Promise<Order[]> => {
      try {
        return await api.get<Order[]>(`/api/customers/${customerId}/orders`);
      } catch (error) {
        logger.error('Failed to fetch orders:', error);
        return [];
      }
    },
    enabled: !!customerId,
    staleTime: 30 * 1000,
  });

  // Fetch transactions
  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: [...queryKeys.customers.detail(customerId), 'transactions'],
    queryFn: async (): Promise<Transaction[]> => {
      try {
        return await api.get<Transaction[]>(
          `/api/customers/${customerId}/transactions`
        );
      } catch (error) {
        logger.error('Failed to fetch transactions:', error);
        return [];
      }
    },
    enabled: !!customerId,
    staleTime: 30 * 1000,
  });

  const loading = customerLoading || ordersLoading || transactionsLoading;

  // Update editForm when customer data loads
  useMemo(() => {
    if (customer && !editModalOpen) {
      setEditForm(customer);
    }
  }, [customer, editModalOpen]);

  // ============================================================================
  // UPDATE CUSTOMER MUTATION
  // ============================================================================

  const updateCustomerMutation = useMutation({
    mutationFn: async (
      updatedData: Partial<CustomerData>
    ): Promise<CustomerData> => {
      return api.put<CustomerData>(`/api/customers/${customerId}`, updatedData);
    },
    onMutate: async (updatedData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.customers.detail(customerId),
      });

      // Snapshot previous value
      const previousCustomer = queryClient.getQueryData<CustomerData>(
        queryKeys.customers.detail(customerId)
      );

      // Optimistically update to the new value
      if (previousCustomer) {
        queryClient.setQueryData<CustomerData>(
          queryKeys.customers.detail(customerId),
          { ...previousCustomer, ...updatedData }
        );
      }

      return { previousCustomer };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousCustomer) {
        queryClient.setQueryData(
          queryKeys.customers.detail(customerId),
          context.previousCustomer
        );
      }

      logger.error('Error updating customer:', error);
      showNotification({
        title: 'Error',
        message: 'Failed to update customer',
        color: 'red',
      });
    },
    onSuccess: (updatedCustomer) => {
      setEditModalOpen(false);

      showNotification({
        title: '✅ Customer Updated Successfully!',
        message: `${updatedCustomer['Customer Name'] || 'Customer'} information has been saved`,
        color: 'green',
        autoClose: 4000,
      });
    },
    onSettled: () => {
      // Invalidate and refetch
      void queryClient.invalidateQueries({
        queryKey: queryKeys.customers.detail(customerId),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.customers.all,
      });
      // Also invalidate dispatch page customer cache
      void queryClient.invalidateQueries({
        queryKey: queryKeys.customers.withShopee(),
      });

      // CRITICAL: Broadcast update to other tabs/pages (like dispatch page)
      try {
        const channel = new BroadcastChannel('customer-updates');
        channel.postMessage('customer-updated');
        channel.close();
      } catch (error) {
        // BroadcastChannel not supported in some environments, ignore
      }
    },
  });

  const handleUpdateCustomer = async (): Promise<void> => {
    await updateCustomerMutation.mutateAsync(editForm);
  };

  const refetchData = async (): Promise<void> => {
    await Promise.all([
      refetchCustomer(),
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.customers.detail(customerId), 'orders'],
      }),
      queryClient.invalidateQueries({
        queryKey: [...queryKeys.customers.detail(customerId), 'transactions'],
      }),
    ]);
  };

  // ============================================================================
  // COMPUTED STATS
  // ============================================================================

  const stats = useMemo<CustomerStats>(() => {
    // Transaction-based stats
    const totalTransactions = transactions.length;
    const totalSpent = transactions.reduce(
      (sum, t) => sum + (t.lineTotal || 0),
      0
    );
    const recentTransactions = transactions.filter(
      (t) =>
        t.orderDate &&
        new Date(t.orderDate) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;
    const cancelledTransactions = transactions.filter((t) =>
      t.orderStatus?.toLowerCase().includes('cancel')
    ).length;
    const completedTransactions = transactions.filter(
      (t) =>
        t.orderStatus?.toLowerCase().includes('shipped') ||
        t.orderStatus?.toLowerCase().includes('delivered')
    ).length;

    // Calculate rates based on transactions
    const completionRate =
      totalTransactions > 0
        ? Math.round((completedTransactions / totalTransactions) * 100)
        : 0;
    const cancellationRate =
      totalTransactions > 0
        ? Math.round((cancelledTransactions / totalTransactions) * 100)
        : 0;
    const averageTransactionValue =
      completedTransactions > 0
        ? Math.round(
            transactions
              .filter(
                (t) =>
                  t.orderStatus?.toLowerCase().includes('shipped') ||
                  t.orderStatus?.toLowerCase().includes('delivered')
              )
              .reduce((sum, t) => sum + (t.lineTotal || 0), 0) /
              completedTransactions
          )
        : 0;

    // Order-based stats (for backward compatibility)
    const totalOrders = orders.length;
    const cancelledOrders = orders.filter(
      (order) => order.status === 'cancelled'
    ).length;
    const completedOrders = orders.filter(
      (order) => order.status === 'delivered'
    ).length;
    const shippedOrders = orders.filter(
      (order) => order.status === 'shipped'
    ).length;
    const processingOrders = orders.filter((order) =>
      ['pending', 'processing'].includes(order.status)
    ).length;

    return {
      totalTransactions,
      totalSpent,
      recentTransactions,
      cancelledTransactions,
      completedTransactions,
      completionRate,
      cancellationRate,
      averageTransactionValue,
      totalOrders,
      cancelledOrders,
      completedOrders,
      shippedOrders,
      processingOrders,
    };
  }, [transactions, orders]);

  return {
    customer: customer || null,
    orders,
    transactions,
    stats,
    loading,
    editModalOpen,
    editForm,
    setEditModalOpen,
    setEditForm,
    handleUpdateCustomer,
    refetchData,
  };
}
