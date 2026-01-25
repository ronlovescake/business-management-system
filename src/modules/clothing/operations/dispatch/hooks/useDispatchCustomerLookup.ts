/**
 * Dispatch Customer Lookup Hook
 *
 * Fetches customers with their shopee usernames and provides
 * a lookup function to match dispatch usernames to customer names
 *
 * CRITICAL: This hook has been rewritten to COMPLETELY BYPASS React Query
 * and use manual fetch with aggressive cache-busting to solve production caching issues.
 */

import { logger } from '@/lib/logger';
import { buildApiPath } from '@/lib/api/paths';
import { useEffect, useMemo, useState, useCallback } from 'react';

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
 * Hook to fetch and lookup customers with Shopee usernames
 *
 * CRITICAL: Now supports server-side data to bypass all caching issues
 */
export function useDispatchCustomerLookup(
  enabled = true,
  serverData?: CustomerWithShopee[],
  apiBasePath?: string
) {
  // State for client-side fetched data (only used if no server data provided)
  const [customersData, setCustomersData] = useState<CustomerWithShopee[]>([]);
  const [isLoading, setIsLoading] = useState(!serverData);
  const [hasFetched, setHasFetched] = useState(!!serverData);

  // Log server data usage
  useEffect(() => {
    if (serverData && serverData.length > 0) {
      logger.debug(
        'DispatchCustomerLookup',
        `Using ${serverData.length} customers from SERVER (database)`
      );
      const sample = serverData.find((c) => c.id === 1192);
      if (sample) {
        logger.debug(
          'DispatchCustomerLookup',
          'Customer 1192 from SERVER:',
          sample
        );
      }
      logger.info(
        `[useDispatchCustomerLookup] Using server data: ${serverData.length} customers`
      );
      setHasFetched(true);
      setIsLoading(false);
    }
  }, [apiBasePath, serverData]);

  // CRITICAL: Manual fetch that completely bypasses all caching layers
  // Only runs if NO server data is provided (development mode)
  const fetchData = useCallback(async () => {
    if (serverData) {
      return; // Don't fetch if we have server data
    }

    try {
      setIsLoading(true);
      logger.info(
        '[useDispatchCustomerLookup] Starting client fetch (no server data provided)'
      );

      // Aggressive cache-busting: timestamp + random + performance.now()
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const perfNow = Math.floor(performance.now());
      const url = `${buildApiPath(
        apiBasePath,
        '/customers/with-shopee'
      )}?nocache=${timestamp}-${random}-${perfNow}&t=${new Date().toISOString()}`;

      logger.debug('DispatchCustomerLookup', 'Fetching URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
        cache: 'no-store',
        next: { revalidate: 0 },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const jsonResponse = await response.json();
      logger.debug('DispatchCustomerLookup', 'Raw API response:', jsonResponse);

      // Extract the customer array from the API response
      if (!jsonResponse.success || !jsonResponse.data) {
        throw new Error('Invalid API response format');
      }

      const payload = Array.isArray(jsonResponse.data)
        ? jsonResponse.data
        : Array.isArray(jsonResponse.data.customers)
          ? jsonResponse.data.customers
          : null;

      if (!Array.isArray(payload)) {
        throw new Error('Missing customers payload');
      }

      const data = payload as CustomerWithShopee[];
      logger.debug(
        'DispatchCustomerLookup',
        'Received data:',
        data.length,
        'customers'
      );

      const sample = data.find((c: CustomerWithShopee) => c.id === 1192);
      if (sample) {
        logger.debug(
          'DispatchCustomerLookup',
          'Customer 1192 from client fetch:',
          sample
        );
      }

      setCustomersData(data);
      setHasFetched(true);
      logger.info(
        `[useDispatchCustomerLookup] Manual fetch completed: ${data.length} customers`
      );
    } catch (error) {
      logger.error('[useDispatchCustomerLookup] Manual fetch failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiBasePath, serverData]);

  // Fetch on mount
  useEffect(() => {
    if (!hasFetched && enabled) {
      logger.debug(
        'DispatchCustomerLookup',
        'Component mounted, triggering fetch'
      );
      void fetchData();
    }
  }, [hasFetched, enabled, fetchData]);

  // Dummy refetch function for compatibility
  const refetch = useCallback(() => {
    logger.debug('DispatchCustomerLookup', 'Refetch called');
    setHasFetched(false);
    return fetchData();
  }, [fetchData]);

  // Use server data if available, otherwise use fetched data
  const customersWithShopee = useMemo(() => {
    const data = serverData || customersData;
    logger.debug(
      'DispatchCustomerLookup',
      `Using ${data.length} customers (source: ${serverData ? 'SERVER' : 'MANUAL FETCH'})`
    );
    const sample = data.find((c: CustomerWithShopee) => c.id === 1192);
    if (sample) {
      logger.debug('DispatchCustomerLookup', 'Sample customer 1192:', sample);
    }
    logger.info(
      `[useDispatchCustomerLookup] Using ${data.length} customers (source: ${serverData ? 'SERVER' : 'MANUAL FETCH'})`
    );
    return data;
  }, [serverData, customersData]);

  // Listen for customer updates from other pages via BroadcastChannel
  useEffect(() => {
    const channel = new BroadcastChannel('customer-updates');

    channel.onmessage = (event) => {
      if (event.data === 'customer-updated') {
        logger.info(
          '[DispatchCustomerLookup] Customer update detected - refetching data'
        );
        void refetch();
      }
    };

    return () => {
      channel.close();
    };
  }, [refetch]);

  /**
   * Create a lookup map: shopee username -> customer display name
   */
  const shopeeUsernameMap = useMemo(() => {
    const map = new Map<string, string>();

    customersWithShopee.forEach((customer: CustomerWithShopee) => {
      const displayName = customer.businessName
        ? `${customer.customerName} | ${customer.businessName}`
        : customer.customerName;

      customer.shopeeUsernames.forEach((username: string) => {
        const normalized = username.toLowerCase().trim();
        if (normalized) {
          map.set(normalized, displayName);
        }
      });
    });

    return map;
  }, [customersWithShopee]);

  /**
   * Create a lookup map: shopee username -> Facebook link
   */
  const facebookLinkMap = useMemo(() => {
    const map = new Map<string, string>();

    customersWithShopee.forEach((customer: CustomerWithShopee) => {
      customer.shopeeUsernames.forEach((username: string) => {
        if (customer.facebook) {
          const normalized = username.toLowerCase().trim();
          if (normalized) {
            map.set(normalized, customer.facebook);
          }
        }
      });
    });

    return map;
  }, [customersWithShopee]);

  /**
   * Create a lookup map: customer ID -> Facebook link
   */
  const facebookByIdMap = useMemo(() => {
    const map = new Map<number, string>();

    customersWithShopee.forEach((customer: CustomerWithShopee) => {
      if (customer.facebook) {
        map.set(customer.id, customer.facebook);
      }
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

  /**
   * Lookup function: given a customer ID, return the customer's Facebook link
   */
  const lookupFacebookLinkById = (customerId: number): string => {
    if (!customerId) {
      return '';
    }

    return facebookByIdMap.get(customerId) || '';
  };

  return {
    customersWithShopee,
    shopeeUsernameMap,
    facebookLinkMap,
    facebookByIdMap,
    lookupCustomerName,
    lookupFacebookLink,
    lookupFacebookLinkById,
    isLoading,
  };
}
