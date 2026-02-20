import { Stack } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';
import { BackupRestoreTab } from '@/modules/clothing/operations/settings/components/BackupRestoreTab';

export default async function AdminBackupRestorePage() {
  return renderOperationsPage(
    '/clothing/operations/settings',
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <BackupRestoreTab />
      </Stack>
    </PageLayout>
  );
}
