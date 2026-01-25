import type { Metadata } from 'next';
import { Container } from '@mantine/core';
import { DispatchingComponent } from '@/modules/clothing/operations/dispatching';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';

export const metadata: Metadata = {
  title: 'Dispatching - General Merchandise',
  description: 'Manage dispatching operations and tracking',
};

export default async function GeneralMerchandiseDispatchingPage() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/operations/dispatching'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <Container size="xl" fluid p="md">
        <DispatchingComponent />
      </Container>
    </PermissionGuard>
  );
}
