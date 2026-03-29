import { Group, Button, Select } from '@mantine/core';
import {
  IconFileTypeCsv,
  IconFileSpreadsheet,
  IconDatabase,
  IconFileText,
  IconDownload,
} from '@tabler/icons-react';
import { StandardTableControls } from '@/components/tables/StandardDataTable';
import type { Backup, BackupData } from '../../backup/types';

interface BackupTablesActionPanelProps {
  tableSearchQuery: string;
  onSearchQueryChange: (value: string) => void;
  backupDateOptions: Array<{ value: string; label: string }>;
  selectedBackupTimestamp: string | null;
  onBackupDateFilterChange: (value: string | null) => void;
  selectedTableName: string | null;
  previewData: BackupData | null;
  selectedBackup: Backup | null;
  onDownloadCSV: (tableName: string) => Promise<void>;
  onDownloadXLSX: (tableName: string) => Promise<void>;
  onDownloadJSON: (backup: Backup) => Promise<void>;
  onDownloadDump: (backup: Backup) => Promise<void>;
  onDownloadAllCSV: () => Promise<void>;
  onDownloadAllXLSX: () => Promise<void>;
}

export function BackupTablesActionPanel({
  tableSearchQuery,
  onSearchQueryChange,
  backupDateOptions,
  selectedBackupTimestamp,
  onBackupDateFilterChange,
  selectedTableName,
  previewData,
  selectedBackup,
  onDownloadCSV,
  onDownloadXLSX,
  onDownloadJSON,
  onDownloadDump,
  onDownloadAllCSV,
  onDownloadAllXLSX,
}: BackupTablesActionPanelProps) {
  return (
    <Group gap="sm" align="center" wrap="wrap">
      <div style={{ flex: 1, minWidth: 240 }}>
        <StandardTableControls
          searchPlaceholder="Search rows..."
          onSearch={onSearchQueryChange}
          searchValue={tableSearchQuery}
          hideImport
          hideExport
          hideAddNew
          expandSearch
          searchAddon={
            <Select
              placeholder="Backup date"
              data={backupDateOptions}
              value={selectedBackupTimestamp}
              onChange={onBackupDateFilterChange}
              clearable
              style={{ minWidth: 220 }}
            />
          }
        />
      </div>

      <Group gap="xs" wrap="wrap">
        <Button
          leftSection={<IconFileTypeCsv size={16} />}
          onClick={() =>
            selectedTableName
              ? void onDownloadCSV(selectedTableName)
              : undefined
          }
          disabled={!selectedTableName || !previewData}
        >
          Download CSV
        </Button>
        <Button
          leftSection={<IconFileSpreadsheet size={16} />}
          onClick={() =>
            selectedTableName
              ? void onDownloadXLSX(selectedTableName)
              : undefined
          }
          disabled={!selectedTableName || !previewData}
        >
          Download XLSX
        </Button>
        <Button
          leftSection={<IconDatabase size={16} />}
          onClick={() =>
            selectedBackup ? void onDownloadJSON(selectedBackup) : undefined
          }
          disabled={!selectedBackup}
        >
          Download JSON
        </Button>
        <Button
          leftSection={<IconFileText size={16} />}
          onClick={() =>
            selectedBackup ? void onDownloadDump(selectedBackup) : undefined
          }
          disabled={!selectedBackup}
        >
          Download Dump
        </Button>
        <Button
          leftSection={<IconDownload size={16} />}
          color="green"
          onClick={() => {
            if (!selectedBackup || !previewData) {
              return;
            }
            void onDownloadAllCSV();
            void onDownloadAllXLSX();
            void onDownloadJSON(selectedBackup);
            void onDownloadDump(selectedBackup);
          }}
          disabled={!selectedBackup || !previewData}
        >
          Download All
        </Button>
      </Group>
    </Group>
  );
}
