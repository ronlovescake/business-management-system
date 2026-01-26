import { Stack } from '@mantine/core';
import { PermissionGuard } from '@/components/auth/PermissionGuard';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  getFirstAccessibleModule,
  hasModuleAccess,
} from '@/lib/auth/permissions';
import { BackupRestoreTab } from '@/modules/clothing/operations/settings/components/BackupRestoreTab';

export default async function AdminBackupRestorePage() {
  // Reuse the same access gate as the original Clothing Operations Settings entry.
  // This keeps Backup/Restore restricted while we centralize it under /admin.
  const hasAccess = await hasModuleAccess('/clothing/operations/settings');
  const redirectTo = await getFirstAccessibleModule();

  return (
    <PermissionGuard hasAccess={hasAccess} redirectTo={redirectTo}>
      <PageLayout fluid withPadding>
        <Stack gap="lg">
          <BackupRestoreTab />
        </Stack>
      </PageLayout>
    </PermissionGuard>
  );
}
