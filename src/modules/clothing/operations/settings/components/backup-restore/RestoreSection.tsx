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
  onDelete: (backup: Backup) => void;
}

export function RestoreSection({
  backups,
  loading,
  onRefresh,
  onPreview,
  onDelete,
}: RestoreSectionProps) {
  return (
    <Stack gap="lg">
      <Alert color="red" icon={<IconAlertCircle size={16} />}>
        <Text size="sm">
          Open a backup first, then use its Restore tab. The UI restore still
          runs the same validated Docker full-dump workflow under the hood.
        </Text>
      </Alert>

      <BackupListCard
        backups={backups}
        loading={loading}
        title={`Choose A Backup (${backups.length})`}
        subtitle="Open a backup to inspect its restore readiness, compare changes, download artifacts, or queue a restore."
        onRefresh={onRefresh}
        onPreview={onPreview}
        onDelete={onDelete}
      />
    </Stack>
  );
}
