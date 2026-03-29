'use client';

import { Stack } from '@mantine/core';
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
      <BackupListCard
        backups={backups}
        loading={loading}
        title={`Available Backups (${backups.length})`}
        subtitle="Preview a backup to open the Restore controls."
        onRefresh={onRefresh}
        onPreview={onPreview}
        onDownloadJSON={onDownloadJSON}
        onDownloadDump={onDownloadDump}
        onDelete={onDelete}
      />
    </Stack>
  );
}
