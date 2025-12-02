import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizeString } from '@/lib/security/sanitize';

/**
 * GET /api/customers/with-all-addresses
 *
 * Optimized endpoint that fetches ALL customers with their additional addresses
 * in a SINGLE database query using JOIN instead of 1000+ individual queries.
 *
 * This solves the N+1 query problem where the fuzzy matching was making
 * thousands of individual API calls to /api/customers/:id/additional-info
 *
 * PERFORMANCE IMPROVEMENT:
 * Before: 1000+ individual API calls (50-300ms each) = 50-300 seconds total
 * After: 1 API call (~500ms) = instant!
 */
type CustomerWithAddresses = {
  id: number;
  customerName: string;
  businessName: string;
  phoneNumber: string;
  address: string;
  additionalAddresses: string[];
};

type CustomerWithAddressesStats = {
  totalCustomers: number;
  totalAdditionalAddresses: number;
  averageAddressesPerCustomer: number;
  withAdditionalAddresses: number;
  maxAdditionalAddresses: number;
};

type CustomerWithAddressesPayload = {
  customers: CustomerWithAddresses[];
  stats: CustomerWithAddressesStats;
};

const sanitizeField = (value: unknown, maxLength = 500) =>
  sanitizeString(value ?? '', {
    maxLength,
    allowSpecialChars: true,
  });

export const GET = withErrorHandler(async (_request: NextRequest) => {
  const customersWithAddresses = await prisma.customer.findMany({
    where: {
      deletedAt: null,
    },
    select: {
      id: true,
      customerName: true,
      businessName: true,
      address: true,
      phoneNumber: true,
      additionalCustomerInfo: {
        where: {
          type: 'address',
          deletedAt: null,
        },
        select: {
          value: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const customers = customersWithAddresses.map<CustomerWithAddresses>(
    (customer) => ({
      id: customer.id,
      customerName: sanitizeField(customer.customerName),
      businessName: sanitizeField(customer.businessName),
      phoneNumber: sanitizeField(customer.phoneNumber, 50),
      address: sanitizeField(customer.address),
      additionalAddresses: customer.additionalCustomerInfo
        .map((info) => sanitizeField(info.value))
        .filter((value) => value.length > 0),
    })
  );

  const stats = calculateStats(customers);

  logger.info('Customers with addresses fetched', {
    totalCustomers: stats.totalCustomers,
    totalAdditionalAddresses: stats.totalAdditionalAddresses,
  });

  return ApiResponse.success<CustomerWithAddressesPayload>(
    {
      customers,
      stats,
    },
    'Customers with addresses fetched'
  );
});

function calculateStats(
  customers: CustomerWithAddresses[]
): CustomerWithAddressesStats {
  const stats = customers.reduce<CustomerWithAddressesStats>(
    (acc, customer) => {
      acc.totalCustomers += 1;

      if (customer.additionalAddresses.length > 0) {
        acc.withAdditionalAddresses += 1;
        acc.totalAdditionalAddresses += customer.additionalAddresses.length;
        acc.maxAdditionalAddresses = Math.max(
          acc.maxAdditionalAddresses,
          customer.additionalAddresses.length
        );
      }

      return acc;
    },
    {
      totalCustomers: 0,
      totalAdditionalAddresses: 0,
      averageAddressesPerCustomer: 0,
      withAdditionalAddresses: 0,
      maxAdditionalAddresses: 0,
    }
  );

  stats.averageAddressesPerCustomer = stats.totalCustomers
    ? Math.round((stats.totalAdditionalAddresses / stats.totalCustomers) * 10) /
      10
    : 0;

  return stats;
}
