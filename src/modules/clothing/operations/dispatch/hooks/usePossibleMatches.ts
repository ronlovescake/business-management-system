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
}

interface AdditionalInfo {
  addresses: Array<{ id: string; value: string }>;
  phones: Array<{ id: string; value: string }>;
  shopeeUsernames: Array<{ id: string; value: string }>;
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
 * Fetch all customers with their details
 */
async function fetchCustomers(): Promise<CustomerData[]> {
  try {
    const customers =
      await api.get<Array<Record<string, unknown>>>('/api/customers');
    return customers.map((c) => ({
      id: Number(c.id),
      customerName: String(c.customerName || c['Customer Name'] || ''),
      businessName: String(c.businessName || c['Business Name'] || ''),
      phoneNumber: String(c.phoneNumber || c['Phone Number'] || ''),
      address: String(c.address || c.Address || ''),
    }));
  } catch (error) {
    logger.error('Failed to fetch customers:', error);
    throw error;
  }
}

/**
 * Fetch additional addresses for a customer
 */
async function fetchAdditionalAddresses(customerId: number): Promise<string[]> {
  try {
    const info = await api.get<AdditionalInfo>(
      `/api/customers/${customerId}/additional-info`
    );
    return info.addresses.map((a) => a.value);
  } catch (error) {
    return [];
  }
}

/**
 * Find possible matches for an unmatched order
 */
async function findPossibleMatches(
  order: UnmatchedOrder,
  customers: CustomerData[]
): Promise<PossibleMatch[]> {
  const matches: PossibleMatch[] = [];

  for (const customer of customers) {
    // Calculate similarity scores
    const addressScore = calculateAddressSimilarity(
      order.deliveryAddress,
      customer.address
    );

    // Also check additional addresses
    const additionalAddresses = await fetchAdditionalAddresses(customer.id);
    const additionalAddressScores = additionalAddresses.map((addr) =>
      calculateAddressSimilarity(order.deliveryAddress, addr)
    );
    const maxAddressScore = Math.max(addressScore, ...additionalAddressScores);

    const phoneScore = calculatePhoneSimilarity(
      order.phoneNumber,
      customer.phoneNumber
    );

    const nameScore = calculateNameSimilarity(
      order.receiverName,
      customer.customerName
    );

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
export function usePossibleMatches(unmatchedOrders: UnmatchedOrder[]) {
  // Fetch all customers
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['possible-match-customers'],
    queryFn: fetchCustomers,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Find matches for all unmatched orders
  const { data: matchesData, isLoading: loadingMatches } = useQuery({
    queryKey: ['possible-matches', unmatchedOrders.length, customers.length],
    queryFn: async () => {
      if (unmatchedOrders.length === 0 || customers.length === 0) {
        return new Map<string, PossibleMatch[]>();
      }

      const matchesMap = new Map<string, PossibleMatch[]>();

      // Process all orders
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
    enabled: unmatchedOrders.length > 0 && customers.length > 0,
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
