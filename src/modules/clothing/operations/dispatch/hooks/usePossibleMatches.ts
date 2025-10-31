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
 * Checks additional addresses for all customers to ensure accurate matching
 */
async function findPossibleMatches(
  order: UnmatchedOrder,
  customers: CustomerData[]
): Promise<PossibleMatch[]> {
  const matches: PossibleMatch[] = [];

  // Process customers in smaller batches to prevent overwhelming the API
  const BATCH_SIZE = 20;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (customer) => {
      // Calculate similarity scores for primary data first
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

      // Always check additional addresses since customers often have multiple delivery locations
      // This is essential for accurate matching even when primary address differs
      let maxAddressScore = addressScore;
      const additionalAddresses = await fetchAdditionalAddresses(customer.id);
      if (additionalAddresses.length > 0) {
        const additionalAddressScores = additionalAddresses.map((addr) =>
          calculateAddressSimilarity(order.deliveryAddress, addr)
        );
        maxAddressScore = Math.max(addressScore, ...additionalAddressScores);
      }

      // Calculate overall similarity (weighted average) using already calculated scores
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

        return {
          customer,
          similarityScore: overallScore,
          matchedField,
          addressScore: maxAddressScore,
          phoneScore,
          nameScore,
          details: details.join(' • '),
        };
      }

      return null;
    });

    const batchResults = await Promise.all(batchPromises);
    matches.push(...batchResults.filter((m): m is PossibleMatch => m !== null));

    // Small delay between batches to prevent overwhelming the API
    if (i + BATCH_SIZE < customers.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
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
  // Fetch all customers
  const { data: customers = [], isLoading: loadingCustomers } = useQuery({
    queryKey: ['possible-match-customers'],
    queryFn: fetchCustomers,
    staleTime: 5 * 60 * 1000, // 5 minutes
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
