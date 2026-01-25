import { PageLayout } from '@/components/layout/PageLayout';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import {
  hasModuleAccess,
  getFirstAccessibleModule,
} from '@/lib/auth/permissions';
import { Text, Stack } from '@mantine/core';

export default async function GeneralMerchandiseEmployeesDashboard() {
  const hasAccess = await hasModuleAccess(
    '/general-merchandise/employees/dashboard'
  );
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout title="General Merchandise Employees">
        <Stack gap="sm">
          <Text fw={600}>Employees workspace is being set up.</Text>
          <Text c="dimmed">
            This is a placeholder dashboard for General Merchandise. Phase 1
            focuses on Operations → Transactions.
          </Text>
        </Stack>
      </PageLayout>
    </PermissionGuard>
  );
}
