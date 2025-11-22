/**
 * Dispatch Page
 * Manage dispatch operations and order tracking
 *
 * SERVER-SIDE RENDERING: Fetch fresh data from database on EVERY page load
 * This completely bypasses all client-side caching issues in production builds
 */

import type { Metadata } from 'next';
import { Container } from '@mantine/core';
import { DispatchComponent } from '@/modules/clothing/operations/dispatch';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export const metadata: Metadata = {
  title: 'Dispatch - Business Management',
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
  const hasAccess = await hasModuleAccess('/clothing/operations/dispatch');
  const redirectTo = await getFirstAccessibleModule();

  // CRITICAL: Fetch data SERVER-SIDE from database on EVERY page load
  // This completely bypasses all client-side React Query caching
  let serverCustomersData: ServerCustomerData[] = [];

  try {
    logger.info(
      '[DispatchPage] Fetching customers from DATABASE (server-side)'
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
      `[DispatchPage] SERVER fetched ${serverCustomersData.length} customers from database`
    );

    // Log sample customer for debugging
    const sample = serverCustomersData.find((c) => c.id === 1192);
    if (sample) {
      logger.info(
        `[DispatchPage] Customer 1192 from DB: "${sample.customerName}" | Business: "${sample.businessName}"`
      );
    }
  } catch (error) {
    logger.error(
      '[DispatchPage] Failed to fetch customers from database:',
      error
    );
    // Continue with empty array - component will handle it
  }

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <Container size="xl" fluid p="md">
        <DispatchComponent serverCustomersData={serverCustomersData} />
      </Container>
    </PermissionGuard>
  );
}
