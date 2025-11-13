/**
 * Possible Matches Hook
 *
 * Finds potential customer matches for unmatched dispatch orders
 * by comparing delivery addresses, phone numbers, and names
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { useMemo } from 'react';
import {
  calculateAddressSimilarity,
  calculatePhoneSimilarity,
  calculateNameSimilarity,
} from '@/lib/utils/fuzzyMatch';

interface CustomerData {
  id: number;
  customerName: string;
  businessName: string;
  phoneNumber: string;
  address: string;
  additionalAddresses?: string[]; // Pre-loaded additional addresses
}

interface PossibleMatch {
  customer: CustomerData;
  similarityScore: number;
  matchedField: 'address' | 'phone' | 'name' | 'multiple';
  addressScore: number;
  phoneScore: number;
  nameScore: number;
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
async function fetchCustomersWithAllAddresses(): Promise<CustomerData[]> {
  try {
    const response = await api.get<{
      success: boolean;
      data: Array<{
        id: number;
        customerName: string;
        businessName: string;
        phoneNumber: string;
        address: string;
        additionalAddresses: string[];
      }>;
    }>('/api/customers/with-all-addresses');

    if (!response.success || !response.data) {
      throw new Error('Invalid response from API');
    }

    logger.info(
      `Fetched ${response.data.length} customers with all addresses in single query`
    );

    return response.data.map((c) => ({
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
  customers: CustomerData[]
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
  enabled = false
) {
  // Fetch all customers WITH all their addresses in ONE query (no N+1 problem!)
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['possible-match-customers-with-addresses'],
    queryFn: fetchCustomersWithAllAddresses,
    staleTime: 30 * 1000, // 30 seconds - catch customer updates quickly
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Refetch when component mounts
    enabled, // Only fetch when enabled
  });

  // Find matches for all unmatched orders
  const { data: matchesData, isLoading: loadingMatches } = useQuery({
    queryKey: ['possible-matches', unmatchedOrders.length, customers.length],
    queryFn: async () => {
      if (unmatchedOrders.length === 0 || customers.length === 0) {
        return new Map<string, PossibleMatch[]>();
      }

      const matchesMap = new Map<string, PossibleMatch[]>();

      // Process all orders - now FAST because all addresses are pre-loaded!
      for (const order of unmatchedOrders) {
        try {
          const matches = await findPossibleMatches(order, customers);
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
    enabled: enabled && unmatchedOrders.length > 0 && customers.length > 0, // Only run when explicitly enabled
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
    isLoading: loadingCustomers || loadingMatches,
  };
}
