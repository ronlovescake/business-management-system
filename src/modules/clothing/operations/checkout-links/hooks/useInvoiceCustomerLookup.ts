/**
 * Invoice Customer Lookup Hook
 *
 * Fetches customers with their Facebook Messenger links
 * Provides lookup function to get Facebook chat link by customer name
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { useMemo } from 'react';
import { buildApiPath } from '@/lib/api/paths';

interface CustomerData {
  id: number;
  customerName: string;
  businessName: string;
  facebook: string;
}

interface CustomerDTO {
  id: number;
  'Customer Name': string;
  'Business Name': string;
  Facebook: string;
}

/**
 * Fetch all customers with Facebook links
 */
async function fetchCustomersWithFacebook(
  apiBasePath?: string
): Promise<CustomerData[]> {
  try {
    // The API returns array directly, not wrapped in { success, data }
    const response = await api.get<CustomerDTO[]>(
      buildApiPath(apiBasePath, '/customers')
    );

    if (!Array.isArray(response)) {
      throw new Error('Invalid response from API');
    }

    logger.info(`Fetched ${response.length} customers with Facebook links`);

    // Map DTO format to our interface
    return response.map((c) => ({
      id: c.id,
      customerName: c['Customer Name'] || '',
      businessName: c['Business Name'] || '',
      facebook: c.Facebook || '',
    }));
  } catch (error) {
    logger.error('Failed to fetch customers with Facebook links:', error);
    throw error;
  }
}

/**
 * Custom hook for invoice customer lookup
 */
export function useInvoiceCustomerLookup(enabled = true, apiBasePath?: string) {
  // Fetch all customers with Facebook links
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['invoice-customers-facebook', apiBasePath ?? 'default'],
    queryFn: () => fetchCustomersWithFacebook(apiBasePath),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    enabled,
  });

  /**
   * Create a lookup map: customer name (normalized) -> Facebook link
   */
  const facebookLinkMap = useMemo(() => {
    const map = new Map<string, string>();

    customers.forEach((customer) => {
      if (customer.facebook) {
        // Map by customer name
        const nameKey = customer.customerName.toLowerCase().trim();
        map.set(nameKey, customer.facebook);

        // Also map by business name if available
        if (customer.businessName) {
          const businessKey = customer.businessName.toLowerCase().trim();
          map.set(businessKey, customer.facebook);
        }

        // Map by combined name (matches invoice customerName format)
        if (customer.businessName) {
          const combinedKey =
            `${customer.customerName} | ${customer.businessName}`
              .toLowerCase()
              .trim();
          map.set(combinedKey, customer.facebook);
        }
      }
    });

    return map;
  }, [customers]);

  /**
   * Lookup function: given a customer name, return their Facebook Messenger link
   */
  const lookupFacebookLink = (customerName: string): string => {
    if (!customerName) {
      return '';
    }

    const normalizedName = customerName.toLowerCase().trim();
    return facebookLinkMap.get(normalizedName) || '';
  };

  /**
   * Check if a customer has a Facebook link
   */
  const hasFacebookLink = (customerName: string): boolean => {
    return !!lookupFacebookLink(customerName);
  };

  return {
    customers,
    facebookLinkMap,
    lookupFacebookLink,
    hasFacebookLink,
    isLoading,
  };
}
