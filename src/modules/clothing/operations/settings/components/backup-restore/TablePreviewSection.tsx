'use client';

import { Alert, Progress, Stack } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { BackupData } from '../../backup/types';
import { BackupTablesBrowser } from './BackupTablesBrowser';

type SelectedTableDetails = {
  name: string;
  count: number;
  data: Array<Record<string, unknown>>;
  columns: string[];
} | null;

interface TablePreviewSectionProps {
  previewLoading: boolean;
  previewData: BackupData | null;
  activeTableName: string | null;
  selectedTableDetails: SelectedTableDetails;
  searchQuery: string;
  isAdminBackupRestore: boolean;
  onSelectTable: (table: string) => void | Promise<void>;
}

export function TablePreviewSection({
  previewLoading,
  previewData,
  activeTableName,
  selectedTableDetails,
  searchQuery,
  isAdminBackupRestore,
  onSelectTable,
}: TablePreviewSectionProps) {
  return (
    <Stack gap="lg">
      {previewLoading && !previewData ? (
        <Progress value={100} animated />
      ) : previewData ? (
        <BackupTablesBrowser
          previewData={previewData}
          selectedTableName={activeTableName}
          selectedTableDetails={selectedTableDetails}
          onSelectTable={onSelectTable}
          searchQuery={searchQuery}
          height="65vh"
          showTableList={!isAdminBackupRestore}
        />
      ) : (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          Preview any backup from the list below to see its tables here.
        </Alert>
      )}
    </Stack>
  );
}
