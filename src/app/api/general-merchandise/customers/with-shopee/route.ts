import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizeString } from '@/lib/security/sanitize';

export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

type CustomerWithShopee = {
  id: number;
  customerName: string;
  businessName: string;
  facebook: string;
  address: string;
  phoneNumber: string;
  shopeeUsernames: string[];
};

type CustomerWithShopeeStats = {
  totalCustomers: number;
  withShopeeUsernames: number;
  totalShopeeUsernames: number;
  maxShopeeUsernames: number;
};

type CustomerWithShopeePayload = {
  customers: CustomerWithShopee[];
  stats: CustomerWithShopeeStats;
  timestamp: string;
};

const NO_CACHE_HEADERS = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store',
} as const;

const sanitizeField = (value: unknown, maxLength = 255) =>
  sanitizeString(value ?? '', {
    maxLength,
    allowSpecialChars: true,
    allowHtml: true,
  });

const sanitizeShopeeUsername = (value: unknown) =>
  sanitizeField(value, 150).toLowerCase().trim();

export const GET = withErrorHandler(async (_request: NextRequest) => {
  const timestamp = new Date().toISOString();
  logger.info('[GM API] Fetching customers with Shopee', { timestamp });

  const customersWithShopee = await prisma.generalMerchandiseCustomer.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      customerName: true,
      businessName: true,
      facebook: true,
      address: true,
      phoneNumber: true,
      additionalCustomerInfo: {
        where: {
          type: 'shopee_username',
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

  const customers = customersWithShopee.map<CustomerWithShopee>((customer) => ({
    id: customer.id,
    customerName: sanitizeField(customer.customerName),
    businessName: sanitizeField(customer.businessName),
    facebook: sanitizeField(customer.facebook, 500),
    address: sanitizeField(customer.address, 500),
    phoneNumber: sanitizeField(customer.phoneNumber, 50),
    shopeeUsernames: customer.additionalCustomerInfo
      .map((info: { value: unknown }) => sanitizeShopeeUsername(info.value))
      .filter((username: string) => username.length > 0),
  }));

  const stats = calculateStats(customers);

  const response = ApiResponse.success<CustomerWithShopeePayload>(
    {
      customers,
      stats,
      timestamp,
    },
    'GM customers with Shopee usernames fetched'
  );

  Object.entries(NO_CACHE_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
});

function calculateStats(
  customers: CustomerWithShopee[]
): CustomerWithShopeeStats {
  return customers.reduce<CustomerWithShopeeStats>(
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

      return acc;
    },
    {
      totalCustomers: 0,
      withShopeeUsernames: 0,
      totalShopeeUsernames: 0,
      maxShopeeUsernames: 0,
    }
  );
}
