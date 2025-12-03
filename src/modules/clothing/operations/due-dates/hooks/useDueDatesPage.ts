import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useDueDateData } from './useDueDateData';
import { DueDateService } from '../services/DueDateService';
import type {
  DueDateItem,
  DueDateStats,
  DueDateTransaction,
} from '../types/dueDate.types';

interface CustomerRecord {
  id: number;
  'Customer Name': string;
  'Business Name': string;
  Facebook: string;
}

const HEADERS = [
  'CUSTOMER',
  'PRODUCT CODE',
  'QUANTITY',
  'UNIT PRICE',
  'LINE TOTAL',
  'INVOICE DATE',
  'DUE DATE',
  'DUE IN',
  'NOTES',
  'CONTACT BUYER',
] as const;

export interface UseDueDatesPageResult {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  isLoading: boolean;
  stats: DueDateStats;
  headers: readonly string[];
  filteredItems: DueDateItem[];
  totalItemCount: number;
  emptyStateMessage: string;
  getCustomerOrders: (customerName: string) => DueDateTransaction[];
  getFacebookLink: (customerName: string) => string;
}

export const useDueDatesPage = (): UseDueDatesPageResult => {
  const [searchQuery, setSearchQuery] = useState('');
  const { dueDateItems, stats, isLoading, transactions } = useDueDateData();

  const { data: customersData = [] } = useQuery<CustomerRecord[]>({
    queryKey: ['customers-facebook-links'],
    queryFn: async () => {
      const response = await api.get<CustomerRecord[]>('/api/customers');
      return Array.isArray(response) ? response : [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const customerFacebookMap = useMemo(() => {
    const map = new Map<string, string>();

    customersData.forEach((customer) => {
      if (!customer.Facebook) {
        return;
      }

      map.set(customer['Customer Name'].toLowerCase(), customer.Facebook);

      if (customer['Business Name']) {
        const combinedName =
          `${customer['Customer Name']} | ${customer['Business Name']}`.toLowerCase();
        map.set(combinedName, customer.Facebook);
      }
    });

    return map;
  }, [customersData]);

  const getFacebookLink = useCallback(
    (customerName: string): string => {
      if (!customerName) {
        return '';
      }
      return customerFacebookMap.get(customerName.toLowerCase()) || '';
    },
    [customerFacebookMap]
  );

  const getCustomerOrders = useCallback(
    (customerName: string) => {
      if (!transactions) {
        return [];
      }
      return DueDateService.getCustomerOrders(transactions, customerName);
    },
    [transactions]
  );

  const filteredItems = useMemo(() => {
    return DueDateService.filterDueDateItems(dueDateItems, searchQuery, null);
  }, [dueDateItems, searchQuery]);

  const emptyStateMessage = useMemo(() => {
    return searchQuery
      ? `No due dates match "${searchQuery}".`
      : 'No due dates found matching your criteria';
  }, [searchQuery]);

  const handleSearchQuery = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  return {
    searchQuery,
    setSearchQuery: handleSearchQuery,
    isLoading,
    stats,
    headers: HEADERS,
    filteredItems,
    totalItemCount: dueDateItems.length,
    emptyStateMessage,
    getCustomerOrders,
    getFacebookLink,
  };
};
