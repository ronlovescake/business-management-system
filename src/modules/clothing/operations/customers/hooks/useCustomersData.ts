'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import type { CustomerData, CustomerStats } from '../types/customer.types';
import { CustomerService } from '../services/CustomerService';

/**
 * Custom hook for managing customers data
 * Handles data fetching, search, filtering, and statistics
 */
export function useCustomersData() {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');

  /**
   * Load customers using React Query
   */
  const {
    data: customers = [],
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.customers.lists(),
    queryFn: async () => {
      try {
        return await CustomerService.loadCustomers();
      } catch (error) {
        logger.error('Failed to load customers:', error);
        throw error;
      }
    },
    staleTime: 30 * 1000,
  });

  const error = queryError ? 'Failed to load customers' : null;

  // Filtered customers based on search
  const filteredCustomers = useMemo(() => {
    return CustomerService.searchCustomers(customers, searchQuery);
  }, [customers, searchQuery]);

  // Debounced filtered customers for smoother typing
  const [debouncedFilteredCustomers, setDebouncedFilteredCustomers] =
    useState(filteredCustomers);

  // Debounce filtered customers with 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilteredCustomers(filteredCustomers);
    }, 300);

    return () => {
      return clearTimeout(timer);
    };
  }, [filteredCustomers]);

  // Pre-compute search index for faster search
  const customersWithSearchIndex = useMemo(() => {
    return CustomerService.createSearchIndex(customers);
  }, [customers]);

  // Calculate statistics using debounced data
  const stats = useMemo<CustomerStats>(() => {
    return CustomerService.calculateStats(
      customers,
      debouncedFilteredCustomers
    );
  }, [customers, debouncedFilteredCustomers]);

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  /**
   * Add customer mutation
   */
  const addCustomerMutation = useMutation({
    mutationFn: async (newCustomer: CustomerData) => {
      return await CustomerService.addCustomer(newCustomer);
    },
    onMutate: async (newCustomer) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.customers.lists(),
      });

      // Snapshot previous value
      const previousCustomers = queryClient.getQueryData<CustomerData[]>(
        queryKeys.customers.lists()
      );

      // Optimistically update
      if (previousCustomers) {
        queryClient.setQueryData<CustomerData[]>(queryKeys.customers.lists(), [
          newCustomer,
          ...previousCustomers,
        ]);
      }

      return { previousCustomers };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(
          queryKeys.customers.lists(),
          context.previousCustomers
        );
      }
      logger.error('Failed to add customer:', _error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() });
    },
  });

  /**
   * Bulk update customers mutation
   */
  const bulkUpdateCustomersMutation = useMutation({
    mutationFn: async (newCustomers: CustomerData[]) => {
      return await CustomerService.bulkUpdateCustomers(newCustomers);
    },
    onMutate: async (newCustomers) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.customers.lists(),
      });

      // Snapshot previous value
      const previousCustomers = queryClient.getQueryData<CustomerData[]>(
        queryKeys.customers.lists()
      );

      // Optimistically update
      queryClient.setQueryData<CustomerData[]>(
        queryKeys.customers.lists(),
        newCustomers
      );

      return { previousCustomers };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        queryClient.setQueryData(
          queryKeys.customers.lists(),
          context.previousCustomers
        );
      }
      logger.error('Failed to bulk update customers:', _error);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.lists() });
    },
  });

  // Wrapper functions to maintain API compatibility
  const addCustomer = useCallback(
    async (newCustomer: CustomerData): Promise<void> => {
      await addCustomerMutation.mutateAsync(newCustomer);
    },
    [addCustomerMutation]
  );

  const bulkUpdateCustomers = useCallback(
    async (
      newCustomers: CustomerData[]
    ): Promise<{
      created: number;
      updated: number;
      skipped: number;
      skippedDetails?: Array<{
        row: number;
        customerName: string;
        issues: Record<string, string>;
      }>;
    }> => {
      return await bulkUpdateCustomersMutation.mutateAsync(newCustomers);
    },
    [bulkUpdateCustomersMutation]
  );

  const replaceAllCustomers = useCallback(
    async (
      newCustomers: CustomerData[]
    ): Promise<{
      created: number;
      updated: number;
      skipped: number;
      skippedDetails?: Array<{
        row: number;
        customerName: string;
        issues: Record<string, string>;
      }>;
    }> => {
      return await bulkUpdateCustomers(newCustomers);
    },
    [bulkUpdateCustomers]
  );

  return {
    customers,
    filteredCustomers,
    debouncedFilteredCustomers,
    searchQuery,
    stats,
    isLoading,
    error,
    customersWithSearchIndex,
    handleSearch,
    addCustomer,
    bulkUpdateCustomers,
    replaceAllCustomers,
  };
}
