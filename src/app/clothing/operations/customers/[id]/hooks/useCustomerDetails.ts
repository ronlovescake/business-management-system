'use client';

import { useState, useEffect, useMemo } from 'react';
import { notifications } from '@mantine/notifications';
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
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<Partial<CustomerData>>({});

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const loadCustomerData = async () => {
    try {
      setLoading(true);

      // Load customer details
      const customerRes = await fetch(`/api/customers/${customerId}`, {
        next: { revalidate: 30 } as RequestInit['next'],
      });
      if (!customerRes.ok) {
        throw new Error('Customer not found');
      }
      const customerData = (await customerRes.json()) as CustomerData;
      setCustomer(customerData);
      setEditForm(customerData);

      // Load orders
      const ordersRes = await fetch(`/api/customers/${customerId}/orders`, {
        next: { revalidate: 30 } as RequestInit['next'],
      });
      if (ordersRes.ok) {
        const ordersData = (await ordersRes.json()) as Order[];
        setOrders(ordersData);
      }

      // Load transactions
      const transactionsRes = await fetch(
        `/api/customers/${customerId}/transactions`,
        {
          next: { revalidate: 30 } as RequestInit['next'],
        }
      );
      if (transactionsRes.ok) {
        const transactionsData =
          (await transactionsRes.json()) as Transaction[];
        setTransactions(transactionsData);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load customer details',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) {
      void loadCustomerData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  // ============================================================================
  // UPDATE CUSTOMER
  // ============================================================================

  const handleUpdateCustomer = async () => {
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        throw new Error('Failed to update customer');
      }

      const updatedCustomer = (await res.json()) as CustomerData;
      setCustomer(updatedCustomer);
      setEditModalOpen(false);

      notifications.show({
        title: '✅ Customer Updated Successfully!',
        message: `${updatedCustomer['Customer Name'] || 'Customer'} information has been saved`,
        color: 'green',
        autoClose: 4000,
      });
    } catch (error) {
      console.error('Error updating customer:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to update customer',
        color: 'red',
      });
    }
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
    const processingOrders = orders.filter((order) =>
      ['pending', 'processing', 'shipped'].includes(order.status)
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
      processingOrders,
    };
  }, [transactions, orders]);

  return {
    customer,
    orders,
    transactions,
    stats,
    loading,
    editModalOpen,
    editForm,
    setEditModalOpen,
    setEditForm,
    handleUpdateCustomer,
    refetchData: loadCustomerData,
  };
}
