'use client';

import { Alert, Stack, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { Backup } from '../../backup/types';
import { BackupListCard } from './BackupListCard';

interface RestoreSectionProps {
  backups: Backup[];
  loading: boolean;
  onRefresh: () => void;
  onPreview: (backup: Backup) => void;
  onDownloadJSON: (backup: Backup) => void;
  onDownloadDump: (backup: Backup) => void;
  onDelete: (backup: Backup) => void;
}

export function RestoreSection({
  backups,
  loading,
  onRefresh,
  onPreview,
  onDownloadJSON,
  onDownloadDump,
  onDelete,
}: RestoreSectionProps) {
  return (
    <Stack gap="lg">
      <Alert color="red" icon={<IconAlertCircle size={16} />}>
        <Text size="sm">
          Browser restore has been retired for disaster recovery. Use this page
          to review backups and download the PostgreSQL dump, then run the
          operator command `npm run docker:restore:docker-db --
          &lt;dump-file&gt; --confirm`.
        </Text>
      </Alert>

      <BackupListCard
        backups={backups}
        loading={loading}
        title={`Available Backups (${backups.length})`}
        subtitle="Preview a backup to inspect its contents or download the PostgreSQL dump for operator-managed restore."
        onRefresh={onRefresh}
        onPreview={onPreview}
        onDownloadJSON={onDownloadJSON}
        onDownloadDump={onDownloadDump}
        onDelete={onDelete}
      />
    </Stack>
  );
}
