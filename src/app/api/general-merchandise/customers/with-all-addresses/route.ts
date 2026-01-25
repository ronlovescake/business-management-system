import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizeString } from '@/lib/security/sanitize';

/**
 * GET /api/general-merchandise/customers/with-all-addresses
 *
 * Optimized endpoint that fetches ALL customers with their additional addresses
 * in a SINGLE database query using JOIN instead of 1000+ individual queries.
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

const gmPrisma = prisma as unknown as {
  generalMerchandiseCustomer: typeof prisma.customer;
};

export const GET = withErrorHandler(async (_request: NextRequest) => {
  const customersWithAddresses =
    await gmPrisma.generalMerchandiseCustomer.findMany({
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

  logger.info('GM customers with addresses fetched', {
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
