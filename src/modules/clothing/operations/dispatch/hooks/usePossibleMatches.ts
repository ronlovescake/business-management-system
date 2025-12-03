/**
 * Possible Matches Hook
 *
 * Finds potential customer matches for unmatched dispatch orders
 * by comparing delivery addresses, phone numbers, and names
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { useMemo, useEffect } from 'react';
import {
  calculateAddressSimilarity,
  calculatePhoneSimilarity,
  calculateNameSimilarity,
} from '@/lib/utils/fuzzyMatch';

export interface DispatchCustomerWithAddresses {
  id: number;
  customerName: string;
  businessName: string;
  phoneNumber: string;
  address: string;
  additionalAddresses: string[]; // Pre-loaded additional addresses
}

interface PossibleMatch {
  customer: DispatchCustomerWithAddresses;
  similarityScore: number;
  matchedField: 'address' | 'phone' | 'name' | 'multiple';
  addressScore: number;
  phoneScore: number;
  nameScore: number;
  overallScore: number;
  details: string;
}

interface UnmatchedOrder {
  orderId: string;
  username: string;
  deliveryAddress: string;
  receiverName: string;
  phoneNumber: string;
  city: string;
  province: string;
  zipCode: string;
}

/**
 * Fetch all customers with ALL their addresses in a single optimized query
 * This prevents the N+1 query problem of fetching addresses individually
 */
async function fetchCustomersWithAllAddresses(): Promise<
  DispatchCustomerWithAddresses[]
> {
  try {
    type CustomerRecord = {
      id: number;
      customerName: string;
      businessName: string;
      phoneNumber: string;
      address: string;
      additionalAddresses: string[];
    };

    const response = await api.get<{
      success: boolean;
      data?: {
        customers: CustomerRecord[];
      };
    }>('/api/customers/with-all-addresses', { unwrapApiResponse: false });

    if (!response.success || !response.data) {
      throw new Error('Invalid response from API');
    }

    const customers = response.data.customers ?? [];

    logger.info(
      `Fetched ${customers.length} customers with all addresses in single query`
    );

    return customers.map((c) => ({
      id: c.id,
      customerName: c.customerName || '',
      businessName: c.businessName || '',
      phoneNumber: c.phoneNumber || '',
      address: c.address || '',
      additionalAddresses: c.additionalAddresses || [],
    }));
  } catch (error) {
    logger.error('Failed to fetch customers with addresses:', error);
    throw error;
  }
}

/**
 * Find possible matches for an unmatched order
 * Uses pre-loaded addresses to avoid N+1 query problem
 */
async function findPossibleMatches(
  order: UnmatchedOrder,
  customers: DispatchCustomerWithAddresses[]
): Promise<PossibleMatch[]> {
  const matches: PossibleMatch[] = [];

  // Process all customers - no need for batching since we have all data in memory
  for (const customer of customers) {
    // Calculate similarity scores for primary data
    const addressScore = calculateAddressSimilarity(
      order.deliveryAddress,
      customer.address
    );

    const phoneScore = calculatePhoneSimilarity(
      order.phoneNumber,
      customer.phoneNumber
    );

    const nameScore = calculateNameSimilarity(
      order.receiverName,
      customer.customerName
    );

    // Check additional addresses from pre-loaded data (no API call needed!)
    let maxAddressScore = addressScore;
    if (
      customer.additionalAddresses &&
      customer.additionalAddresses.length > 0
    ) {
      const additionalAddressScores = customer.additionalAddresses.map((addr) =>
        calculateAddressSimilarity(order.deliveryAddress, addr)
      );
      maxAddressScore = Math.max(addressScore, ...additionalAddressScores);
    }

    // Calculate overall similarity (weighted average)
    const overallScore = Math.round(
      maxAddressScore * 0.6 + // Address is most important
        phoneScore * 0.25 + // Phone is secondary
        nameScore * 0.15 // Name is least reliable (often masked)
    );

    // Only include if overall score is above threshold (40%)
    if (overallScore >= 40) {
      let matchedField: 'address' | 'phone' | 'name' | 'multiple' = 'address';
      const highScores = [
        { field: 'address' as const, score: maxAddressScore },
        { field: 'phone' as const, score: phoneScore },
        { field: 'name' as const, score: nameScore },
      ].filter((s) => s.score >= 70);

      if (highScores.length > 1) {
        matchedField = 'multiple';
      } else if (highScores.length === 1) {
        matchedField = highScores[0].field;
      }

      // Generate details string
      const details = [];
      if (maxAddressScore >= 60) {
        details.push(`Address: ${maxAddressScore}%`);
      }
      if (phoneScore >= 60) {
        details.push(`Phone: ${phoneScore}%`);
      }
      if (nameScore >= 60) {
        details.push(`Name: ${nameScore}%`);
      }

      matches.push({
        customer,
        similarityScore: overallScore,
        matchedField,
        addressScore: maxAddressScore,
        phoneScore,
        nameScore,
        overallScore,
        details: details.join(' • '),
      });
    }
  }

  // Sort by similarity score (highest first) and return top 10
  return matches
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, 10);
}

/**
 * Custom hook for possible matches
 */
export function usePossibleMatches(
  unmatchedOrders: UnmatchedOrder[],
  enabled = false,
  serverCustomersWithAddresses?: DispatchCustomerWithAddresses[]
) {
  const shouldFetchCustomers = enabled && !serverCustomersWithAddresses;

  // Fetch all customers WITH all their addresses in ONE query (no N+1 problem!)
  const {
    data: customers = [],
    isLoading: loadingCustomers,
    refetch: refetchCustomers,
  } = useQuery({
    queryKey: ['possible-match-customers-with-addresses'],
    queryFn: fetchCustomersWithAllAddresses,
    staleTime: 30 * 1000, // 30 seconds - catch customer updates quickly
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Refetch when component mounts
    enabled: shouldFetchCustomers, // Only fetch when enabled and no server data
  });

  const combinedCustomers =
    serverCustomersWithAddresses && serverCustomersWithAddresses.length > 0
      ? serverCustomersWithAddresses
      : customers;

  const loadingCustomersState = serverCustomersWithAddresses
    ? false
    : loadingCustomers;

  // Listen for customer updates from other pages via BroadcastChannel
  useEffect(() => {
    if (!shouldFetchCustomers) {
      return undefined;
    }

    const channel = new BroadcastChannel('customer-updates');

    channel.onmessage = (event) => {
      if (event.data === 'customer-updated') {
        logger.info(
          '[usePossibleMatches] Customer update detected - refetching customers with addresses'
        );
        void refetchCustomers();
      }
    };

    return () => {
      channel.close();
    };
  }, [shouldFetchCustomers, refetchCustomers]);

  const customersKey = useMemo(() => {
    if (combinedCustomers.length === 0) {
      return 'none';
    }

    return combinedCustomers
      .map((customer) =>
        [
          customer.id,
          customer.address,
          customer.phoneNumber,
          customer.customerName,
          customer.businessName,
          customer.additionalAddresses?.join('|') || 'no-additional',
        ].join('::')
      )
      .join('||');
  }, [combinedCustomers]);

  const matchesEnabled =
    enabled && unmatchedOrders.length > 0 && combinedCustomers.length > 0;

  // Find matches for all unmatched orders
  const { data: matchesData, isLoading: loadingMatches } = useQuery({
    queryKey: ['possible-matches', unmatchedOrders.length, customersKey],
    queryFn: async () => {
      if (unmatchedOrders.length === 0 || combinedCustomers.length === 0) {
        return new Map<string, PossibleMatch[]>();
      }

      const matchesMap = new Map<string, PossibleMatch[]>();

      // Process all orders - now FAST because all addresses are pre-loaded!
      for (const order of unmatchedOrders) {
        try {
          const matches = await findPossibleMatches(order, combinedCustomers);
          matchesMap.set(order.orderId, matches);
        } catch (error) {
          logger.error(
            `Failed to find matches for order ${order.orderId}:`,
            error
          );
          matchesMap.set(order.orderId, []);
        }
      }

      return matchesMap;
    },
    enabled: matchesEnabled, // Only run when explicitly enabled
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const matches = useMemo(
    () => matchesData || new Map<string, PossibleMatch[]>(),
    [matchesData]
  );

  /**
   * Get possible matches for a specific order
   */
  const getMatchesForOrder = (orderId: string): PossibleMatch[] => {
    return matches.get(orderId) || [];
  };

  /**
   * Get statistics
   */
  const stats = useMemo(() => {
    let totalMatches = 0;
    let ordersWithMatches = 0;

    matches.forEach((orderMatches) => {
      if (orderMatches.length > 0) {
        ordersWithMatches++;
        totalMatches += orderMatches.length;
      }
    });

    return {
      totalUnmatchedOrders: unmatchedOrders.length,
      ordersWithPossibleMatches: ordersWithMatches,
      ordersWithoutMatches: unmatchedOrders.length - ordersWithMatches,
      totalPossibleMatches: totalMatches,
      averageMatchesPerOrder:
        ordersWithMatches > 0
          ? Math.round(totalMatches / ordersWithMatches)
          : 0,
    };
  }, [matches, unmatchedOrders.length]);

  return {
    matches,
    getMatchesForOrder,
    stats,
    isLoading: loadingCustomersState || loadingMatches,
  };
}
