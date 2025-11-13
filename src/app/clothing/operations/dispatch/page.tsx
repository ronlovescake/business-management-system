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

interface CustomerWithShopee {
  id: number;
  customerName: string;
  businessName: string;
  facebook: string;
  shopeeUsernames: string[];
}

export default async function DispatchPage() {
  const hasAccess = await hasModuleAccess('/clothing/operations/dispatch');
  const redirectTo = await getFirstAccessibleModule();

  // CRITICAL: Fetch data SERVER-SIDE from database on EVERY page load
  // This completely bypasses all client-side React Query caching
  let serverCustomersData: CustomerWithShopee[] = [];

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
        additionalCustomerInfo: {
          where: {
            type: 'shopee_username',
            deletedAt: null,
          },
          select: {
            value: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    serverCustomersData = customersWithShopee.map((customer) => ({
      id: customer.id,
      customerName: customer.customerName || '',
      businessName: customer.businessName || '',
      facebook: customer.facebook || '',
      shopeeUsernames: customer.additionalCustomerInfo.map((info) =>
        (info.value || '').toLowerCase().trim()
      ),
    }));

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
