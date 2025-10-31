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
  facebook: string;
}

interface CustomerWithShopee extends CustomerData {
  shopeeUsernames: string[];
}

/**
 * Fetch all customers with their Shopee usernames in a single optimized query
 * This is MUCH faster than fetching customers and then making 1000+ individual API calls
 */
async function fetchCustomersWithShopee(): Promise<CustomerWithShopee[]> {
  try {
    const response = await api.get<{
      success: boolean;
      data: Array<{
        id: number;
        customerName: string;
        businessName: string;
        facebook: string;
        shopeeUsernames: string[];
      }>;
    }>('/api/customers/with-shopee');

    if (!response.success || !response.data) {
      throw new Error('Invalid response from API');
    }

    logger.info(
      `Fetched ${response.data.length} customers with Shopee usernames in single query`
    );

    return response.data.map((c) => ({
      id: c.id,
      customerName: c.customerName || '',
      businessName: c.businessName || '',
      facebook: c.facebook || '',
      shopeeUsernames: c.shopeeUsernames,
    }));
  } catch (error) {
    logger.error('Failed to fetch customers with Shopee usernames:', error);
    throw error;
  }
}

/**
 * Custom hook for dispatch customer lookup
 */
export function useDispatchCustomerLookup(enabled = true) {
  // Fetch all customers with Shopee usernames in a SINGLE optimized query
  // This is instant compared to the old approach of 1000+ individual API calls
  const { data: customersWithShopee = [], isLoading } = useQuery({
    queryKey: ['dispatch-customers-shopee'],
    queryFn: fetchCustomersWithShopee,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled,
  });

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
   * Create a lookup map: shopee username -> Facebook link
   */
  const facebookLinkMap = useMemo(() => {
    const map = new Map<string, string>();

    customersWithShopee.forEach((customer) => {
      customer.shopeeUsernames.forEach((username) => {
        if (customer.facebook) {
          map.set(username, customer.facebook);
        }
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

  /**
   * Lookup function: given a shopee username, return the customer's Facebook link
   */
  const lookupFacebookLink = (shopeeUsername: string): string => {
    if (!shopeeUsername) {
      return '';
    }

    const normalizedUsername = shopeeUsername.toLowerCase().trim();
    return facebookLinkMap.get(normalizedUsername) || '';
  };

  return {
    customersWithShopee,
    shopeeUsernameMap,
    facebookLinkMap,
    lookupCustomerName,
    lookupFacebookLink,
    isLoading,
  };
}
