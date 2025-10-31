/**
 * Dispatch Customer Lookup Hook
 *
 * Fetches customers with their shopee usernames and provides
 * a lookup function to match dispatch usernames to customer names
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { useMemo } from 'react';

interface CustomerData {
  id: number;
  customerName: string;
  businessName: string;
}

interface AdditionalInfo {
  addresses: Array<{ id: string; value: string }>;
  phones: Array<{ id: string; value: string }>;
  shopeeUsernames: Array<{ id: string; value: string }>;
}

interface CustomerWithShopee extends CustomerData {
  shopeeUsernames: string[];
}

/**
 * Fetch all customers
 */
async function fetchCustomers(): Promise<CustomerData[]> {
  try {
    const customers =
      await api.get<Array<Record<string, unknown>>>('/api/customers');
    return customers.map((c) => ({
      id: Number(c.id),
      customerName: String(c.customerName || c['Customer Name'] || ''),
      businessName: String(c.businessName || c['Business Name'] || ''),
    }));
  } catch (error) {
    logger.error('Failed to fetch customers:', error);
    throw error;
  }
}

/**
 * Fetch additional info for a customer
 */
async function fetchCustomerAdditionalInfo(
  customerId: number
): Promise<AdditionalInfo> {
  try {
    return await api.get<AdditionalInfo>(
      `/api/customers/${customerId}/additional-info`
    );
  } catch (error) {
    logger.error(
      `Failed to fetch additional info for customer ${customerId}:`,
      error
    );
    return {
      addresses: [],
      phones: [],
      shopeeUsernames: [],
    };
  }
}

/**
 * Custom hook for dispatch customer lookup
 */
export function useDispatchCustomerLookup() {
  // Fetch all customers
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['dispatch-customers'],
    queryFn: fetchCustomers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch additional info for all customers
  const { data: customersWithShopee = [], isLoading: loadingShopee } = useQuery(
    {
      queryKey: ['dispatch-customers-shopee', customers.length],
      queryFn: async (): Promise<CustomerWithShopee[]> => {
        if (customers.length === 0) {
          return [];
        }

        try {
          // Fetch additional info for all customers in parallel
          const additionalInfoPromises = customers.map((customer) =>
            fetchCustomerAdditionalInfo(customer.id).then((info) => ({
              ...customer,
              shopeeUsernames: info.shopeeUsernames.map((u) =>
                u.value.toLowerCase()
              ),
            }))
          );

          const results = await Promise.all(additionalInfoPromises);

          // Filter only customers with shopee usernames
          return results.filter((c) => c.shopeeUsernames.length > 0);
        } catch (error) {
          logger.error('Failed to fetch shopee usernames:', error);
          return [];
        }
      },
      enabled: customers.length > 0,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  /**
   * Create a lookup map: shopee username -> customer display name
   */
  const shopeeUsernameMap = useMemo(() => {
    const map = new Map<string, string>();

    customersWithShopee.forEach((customer) => {
      const displayName = customer.businessName
        ? `${customer.customerName} | ${customer.businessName}`
        : customer.customerName;

      customer.shopeeUsernames.forEach((username) => {
        map.set(username, displayName);
      });
    });

    return map;
  }, [customersWithShopee]);

  /**
   * Lookup function: given a shopee username, return the customer display name
   */
  const lookupCustomerName = (shopeeUsername: string): string => {
    if (!shopeeUsername) {
      return '';
    }

    const normalizedUsername = shopeeUsername.toLowerCase().trim();
    return shopeeUsernameMap.get(normalizedUsername) || '';
  };

  return {
    customersWithShopee,
    shopeeUsernameMap,
    lookupCustomerName,
    isLoading: loadingCustomers || loadingShopee,
  };
}
