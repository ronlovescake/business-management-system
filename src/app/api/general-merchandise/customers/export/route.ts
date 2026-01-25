import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizeString } from '@/lib/security/sanitize';

type CustomerExportRecord = {
  id: number;
  date: string;
  customerName: string;
  phoneNumber: string;
  address: string;
  facebook: string;
  emailAddress: string;
  businessName: string;
  taxNumber: string;
  businessAddress: string;
  businessContactNumber: string;
  customerStatus: string;
  shopeeUsernames: string[];
  additionalAddresses: string[];
  additionalPhones: string[];
  alternateNames: string[];
  facebookAccounts: string[];
};

type CustomerExportStats = {
  totalCustomers: number;
  withShopeeUsernames: number;
  withAdditionalAddresses: number;
  withAdditionalPhones: number;
  withAlternateNames: number;
  withFacebookAccounts: number;
  totalShopeeUsernames: number;
  totalAdditionalAddresses: number;
  totalAdditionalPhones: number;
  totalAlternateNames: number;
  totalFacebookAccounts: number;
  maxShopeeUsernames: number;
  maxAdditionalAddresses: number;
  maxAdditionalPhones: number;
  maxAlternateNames: number;
  maxFacebookAccounts: number;
};

type CustomerExportPayload = {
  customers: CustomerExportRecord[];
  stats: CustomerExportStats;
};

const sanitizeField = (value: unknown, maxLength = 500) =>
  sanitizeString(value ?? '', {
    maxLength,
    allowSpecialChars: true,
    allowHtml: true,
  });

const sanitizeDate = (value: unknown) => {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return sanitizeField(value, 50);
};

const gmPrisma = prisma as unknown as {
  generalMerchandiseCustomer: typeof prisma.customer;
};

/**
 * GET /api/general-merchandise/customers/export
 *
 * Optimized endpoint that fetches ALL customers with ALL their additional info
 * in a SINGLE database query for CSV export purposes.
 */
export const GET = withErrorHandler(async (_request: NextRequest) => {
  // Single query with JOIN to get all customers with ALL their additional info
  const customersWithInfo = await gmPrisma.generalMerchandiseCustomer.findMany({
    where: {
      deletedAt: null,
    },
    include: {
      additionalCustomerInfo: {
        where: {
          deletedAt: null,
        },
        select: {
          type: true,
          value: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const customers = customersWithInfo.map<CustomerExportRecord>((customer) => {
    const grouped = {
      shopeeUsernames: [] as string[],
      additionalAddresses: [] as string[],
      additionalPhones: [] as string[],
      alternateNames: [] as string[],
      facebookAccounts: [] as string[],
    };

    customer.additionalCustomerInfo.forEach((info) => {
      const sanitizedValue = sanitizeField(info.value);
      switch (info.type) {
        case 'shopee_username':
          grouped.shopeeUsernames.push(sanitizedValue);
          break;
        case 'address':
          grouped.additionalAddresses.push(sanitizedValue);
          break;
        case 'phone':
          grouped.additionalPhones.push(sanitizedValue);
          break;
        case 'alternate_name':
          grouped.alternateNames.push(sanitizedValue);
          break;
        case 'facebook':
          grouped.facebookAccounts.push(sanitizedValue);
          break;
        default:
          break;
      }
    });

    return {
      id: customer.id,
      date: sanitizeDate(customer.date),
      customerName: sanitizeField(customer.customerName),
      phoneNumber: sanitizeField(customer.phoneNumber, 100),
      address: sanitizeField(customer.address),
      facebook: sanitizeField(customer.facebook),
      emailAddress: sanitizeField(customer.emailAddress),
      businessName: sanitizeField(customer.businessName),
      taxNumber: sanitizeField(customer.taxNumber, 100),
      businessAddress: sanitizeField(customer.businessAddress),
      businessContactNumber: sanitizeField(customer.businessContactNumber, 100),
      customerStatus: sanitizeField(customer.customerStatus, 50),
      shopeeUsernames: grouped.shopeeUsernames,
      additionalAddresses: grouped.additionalAddresses,
      additionalPhones: grouped.additionalPhones,
      alternateNames: grouped.alternateNames,
      facebookAccounts: grouped.facebookAccounts,
    };
  });

  const stats = calculateStats(customers);

  logger.info('GM customers export generated', {
    totalCustomers: stats.totalCustomers,
    withShopeeUsernames: stats.withShopeeUsernames,
  });

  return ApiResponse.success<CustomerExportPayload>(
    { customers, stats },
    'Customers export generated'
  );
});

function calculateStats(
  customers: CustomerExportRecord[]
): CustomerExportStats {
  return customers.reduce<CustomerExportStats>(
    (acc, customer) => {
      acc.totalCustomers += 1;

      if (customer.shopeeUsernames.length > 0) {
        acc.withShopeeUsernames += 1;
        acc.totalShopeeUsernames += customer.shopeeUsernames.length;
        acc.maxShopeeUsernames = Math.max(
          acc.maxShopeeUsernames,
          customer.shopeeUsernames.length
        );
      }

      if (customer.additionalAddresses.length > 0) {
        acc.withAdditionalAddresses += 1;
        acc.totalAdditionalAddresses += customer.additionalAddresses.length;
        acc.maxAdditionalAddresses = Math.max(
          acc.maxAdditionalAddresses,
          customer.additionalAddresses.length
        );
      }

      if (customer.additionalPhones.length > 0) {
        acc.withAdditionalPhones += 1;
        acc.totalAdditionalPhones += customer.additionalPhones.length;
        acc.maxAdditionalPhones = Math.max(
          acc.maxAdditionalPhones,
          customer.additionalPhones.length
        );
      }

      if (customer.alternateNames.length > 0) {
        acc.withAlternateNames += 1;
        acc.totalAlternateNames += customer.alternateNames.length;
        acc.maxAlternateNames = Math.max(
          acc.maxAlternateNames,
          customer.alternateNames.length
        );
      }

      if (customer.facebookAccounts.length > 0) {
        acc.withFacebookAccounts += 1;
        acc.totalFacebookAccounts += customer.facebookAccounts.length;
        acc.maxFacebookAccounts = Math.max(
          acc.maxFacebookAccounts,
          customer.facebookAccounts.length
        );
      }

      return acc;
    },
    {
      totalCustomers: 0,
      withShopeeUsernames: 0,
      withAdditionalAddresses: 0,
      withAdditionalPhones: 0,
      withAlternateNames: 0,
      withFacebookAccounts: 0,
      totalShopeeUsernames: 0,
      totalAdditionalAddresses: 0,
      totalAdditionalPhones: 0,
      totalAlternateNames: 0,
      totalFacebookAccounts: 0,
      maxShopeeUsernames: 0,
      maxAdditionalAddresses: 0,
      maxAdditionalPhones: 0,
      maxAlternateNames: 0,
      maxFacebookAccounts: 0,
    }
  );
}
