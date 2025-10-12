'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { CustomerData, CustomerStats } from '../types/customer.types';
import { CustomerService } from '../services/CustomerService';

/**
 * Custom hook for managing customers data
 * Handles data fetching, search, filtering, and statistics
 */
export function useCustomersData() {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerData[]>(
    []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounced filtered customers for smoother typing
  const [debouncedFilteredCustomers, setDebouncedFilteredCustomers] =
    useState(filteredCustomers);

  // Debounce filtered customers with 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilteredCustomers(filteredCustomers);
    }, 300);

    return () => clearTimeout(timer);
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

  // Load customers on mount
  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await CustomerService.loadCustomers();
        if (isMounted) {
          setCustomers(data);
          setFilteredCustomers(data);
        }
      } catch (e) {
        if (isMounted) {
          setError('Failed to load customers');
          console.error('Failed to load customers', e);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  // Handle search
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      const filtered = CustomerService.searchCustomers(customers, query);
      setFilteredCustomers(filtered);
    },
    [customers]
  );

  // Add new customer
  const addCustomer = useCallback(
    async (newCustomer: CustomerData): Promise<void> => {
      const nextCustomers = [newCustomer, ...customers];
      setCustomers(nextCustomers);

      // Update filtered customers if search is active
      if (searchQuery.trim()) {
        const filtered = CustomerService.searchCustomers(
          nextCustomers,
          searchQuery
        );
        setFilteredCustomers(filtered);
      } else {
        setFilteredCustomers(nextCustomers);
      }

      // Persist to backend
      try {
        await CustomerService.addCustomer(newCustomer);
      } catch (error) {
        throw error;
      }
    },
    [customers, searchQuery]
  );

  // Bulk update customers (for CSV import or paste mode)
  const bulkUpdateCustomers = useCallback(
    async (newCustomers: CustomerData[]): Promise<void> => {
      setCustomers(newCustomers);

      // Update filtered customers if search is active
      if (searchQuery.trim()) {
        const filtered = CustomerService.searchCustomers(
          newCustomers,
          searchQuery
        );
        setFilteredCustomers(filtered);
      } else {
        setFilteredCustomers(newCustomers);
      }

      // Persist to backend
      try {
        await CustomerService.bulkUpdateCustomers(newCustomers);
      } catch (error) {
        throw error;
      }
    },
    [searchQuery]
  );

  // Replace all customers (for CSV import)
  const replaceAllCustomers = useCallback(
    async (newCustomers: CustomerData[]): Promise<void> => {
      await bulkUpdateCustomers(newCustomers);
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
    setCustomers,
    setFilteredCustomers,
  };
}
