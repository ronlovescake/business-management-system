/**
 * GM Dispatch Page
 * Manage dispatch operations and order tracking
 *
 * SERVER-SIDE RENDERING: Fetch fresh data from database on EVERY page load
 */

import type { Metadata } from 'next';
import { DispatchRoutePage } from '@/app/operations/dispatch/_shared/DispatchRoutePage';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export const metadata: Metadata = {
  title: 'Dispatch',
  description: 'Manage dispatch operations and order tracking',
};

// CRITICAL: Force completely dynamic rendering - NO caching at all
export const dynamic = 'force-dynamic';
export const dynamicParams = true;
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const preferredRegion = 'auto';

interface ServerCustomerData {
  id: number;
  customerName: string;
  businessName: string;
  facebook: string;
  address: string;
  phoneNumber: string;
  shopeeUsernames: string[];
  additionalAddresses: string[];
}

export default async function DispatchPage() {
  // CRITICAL: Fetch data SERVER-SIDE from database on EVERY page load
  // This completely bypasses all client-side React Query caching
  let serverCustomersData: ServerCustomerData[] = [];

  try {
    logger.info(
      '[GM DispatchPage] Fetching customers from DATABASE (server-side)'
    );

    const customersWithShopee = await prisma.customer.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        customerName: true,
        businessName: true,
        facebook: true,
        address: true,
        phoneNumber: true,
        additionalCustomerInfo: {
          select: {
            type: true,
            value: true,
          },
          where: {
            deletedAt: null,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    serverCustomersData = customersWithShopee.map((customer) => {
      const shopeeUsernames = customer.additionalCustomerInfo
        .filter((info) => info.type === 'shopee_username')
        .map((info) => (info.value || '').toLowerCase().trim())
        .filter((username) => username.length > 0);

      const additionalAddresses = customer.additionalCustomerInfo
        .filter((info) => info.type === 'address')
        .map((info) => info.value || '')
        .filter((value) => value.length > 0);

      return {
        id: customer.id,
        customerName: customer.customerName || '',
        businessName: customer.businessName || '',
        facebook: customer.facebook || '',
        address: customer.address || '',
        phoneNumber: customer.phoneNumber || '',
        shopeeUsernames,
        additionalAddresses,
      } satisfies ServerCustomerData;
    });

    logger.info(
      `[GM DispatchPage] SERVER fetched ${serverCustomersData.length} customers from database`
    );
  } catch (error) {
    logger.error(
      '[GM DispatchPage] Failed to fetch customers from database:',
      error
    );
    // Continue with empty array - component will handle it
  }

  return renderOperationsPage(
    '/general-merchandise/operations/dispatch',
    <DispatchRoutePage
      serverCustomersData={serverCustomersData}
      apiBasePath="/api/general-merchandise"
    />
  );
}
