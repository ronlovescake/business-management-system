/**
 * Dispatch Page
 * Manage dispatch operations and order tracking
 */

import type { Metadata } from 'next';
import { Container } from '@mantine/core';
import { DispatchComponent } from '@/modules/clothing/operations/dispatch';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export const metadata: Metadata = {
  title: 'Dispatch - Business Management',
  description: 'Manage dispatch operations and order tracking',
};

// Force dynamic rendering to always fetch fresh customer data
// This ensures customer name updates are immediately reflected in production
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DispatchPage() {
  const hasAccess = await hasModuleAccess('/clothing/operations/dispatch');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <Container size="xl" fluid p="md">
        <DispatchComponent />
      </Container>
    </PermissionGuard>
  );
}
