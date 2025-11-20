'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Stack,
  Box,
  Group,
  Button,
  Card,
  Text,
  Title,
  Badge,
  Select,
  Switch,
  Table as MantineTable,
  ActionIcon,
  Modal,
  Alert,
  Progress,
  Divider,
  ScrollArea,
  Tabs,
  NumberInput,
  Checkbox,
} from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
import { api } from '@/lib/api/client';
import {
  IconDatabase,
  IconDownload,
  IconTrash,
  IconClock,
  IconFileTypeCsv,
  IconRefresh,
  IconAlertCircle,
  IconCheck,
  IconFile,
  IconEye,
  IconFileText,
  IconFileSpreadsheet,
  IconHistory,
} from '@tabler/icons-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface Backup {
  timestamp: string;
  path: string;
  files: string[];
  totalSize: number;
}

interface BackupData {
  metadata: {
    createdAt: string;
    database: string;
    format: string;
    version: string;
  };
  tables: Record<
    string,
    {
      count: number;
      data: Array<Record<string, unknown>>;
    }
  >;
}

// Derive stable keys for preview table rows/cells using serialized content
const createRowKey = (tableName: string, row: Record<string, unknown>) =>
  `${tableName}-${Object.entries(row)
    .slice(0, 5)
    .map(([key, value]) => `${key}:${String(value ?? '')}`)
    .join('|')}`;

const createCellKey = (rowKey: string, columnKey: string) =>
  `${rowKey}-${columnKey}`;

const formatCellValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

type RestoreResults = Record<
  string,
  {
    count: number;
    updated?: number;
    error?: string;
    beforeCount?: number;
    afterCount?: number;
    attempted?: number;
    skipped?: number;
  }
>;

export function BackupRestoreTab() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [backupFormat, setBackupFormat] = useState<string>('all');
  const [includeSoftDeleted, setIncludeSoftDeleted] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [autoBackupInterval, setAutoBackupInterval] = useState(30);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<BackupData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string | null>(
    null
  );
  const [previewJsonFile, setPreviewJsonFile] = useState<string | null>(null);
  const [restoreSelection, setRestoreSelection] = useState<string[]>([]);
  const [forceOverwrite, setForceOverwrite] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreResults, setRestoreResults] = useState<RestoreResults | null>(
    null
  );
  const autoBackupIntervalRef = useRef<NodeJS.Timeout>();

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ success: boolean; backups?: Backup[] }>(
        '/api/backup'
      );
      if (data.success) {
        setBackups(data.backups || []);
      }
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to load backups',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBackups();
  }, [fetchBackups]);

  useEffect(() => {
    if (!previewData?.tables) {
      if (selectedTableName !== null) {
        setSelectedTableName(null);
      }
      return;
    }

    const tableNames = Object.keys(previewData.tables);
    if (!tableNames.length) {
      if (selectedTableName !== null) {
        setSelectedTableName(null);
      }
      return;
    }

    if (!selectedTableName || !previewData.tables[selectedTableName]) {
      setSelectedTableName(tableNames[0]);
    }
  }, [previewData, selectedTableName]);

  const handleCreateBackup = useCallback(
    async (isAuto = false) => {
      if (!isAuto) {
        setCreating(true);
      }

      try {
        const data = await api.post<{
          success: boolean;
          backup?: { totalSize: number; timestamp: string; files: string[] };
          error?: string;
        }>('/api/backup', {
          format: backupFormat,
          includeSoftDeleted,
        });

        if (data.success && data.backup) {
          showNotification({
            title: isAuto ? '✅ Auto-Backup Complete' : '✅ Backup Created',
            message: `Backup saved (${(data.backup.totalSize / 1024 / 1024).toFixed(2)} MB)`,
            color: 'green',
          });
          await fetchBackups();
        } else {
          throw new Error(data.error || 'Backup failed');
        }
      } catch (error) {
        showNotification({
          title: '❌ Backup Failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          color: 'red',
        });
      } finally {
        if (!isAuto) {
          setCreating(false);
        }
      }
    },
    [backupFormat, includeSoftDeleted, fetchBackups]
  );

  useEffect(() => {
    if (autoBackupEnabled) {
      const performAutoBackup = async () => {
        showNotification({
          title: 'Auto-Backup',
          message: 'Starting automatic backup...',
          color: 'blue',
          autoClose: 3000,
        });
        await handleCreateBackup(true);
      };

      void performAutoBackup();
      autoBackupIntervalRef.current = setInterval(
        () => void performAutoBackup(),
        autoBackupInterval * 60 * 1000
      );

      return () => {
        if (autoBackupIntervalRef.current) {
          clearInterval(autoBackupIntervalRef.current);
        }
      };
    }
  }, [autoBackupEnabled, autoBackupInterval, handleCreateBackup]);

  const handleDeleteBackup = async (timestamp: string) => {
    const firstStep = await Swal.fire({
      title: 'Delete this backup?',
      text: 'This will permanently remove the backup files.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e03131',
      cancelButtonColor: '#868e96',
      focusCancel: true,
      allowOutsideClick: false,
    });

    if (!firstStep.isConfirmed) {
      return;
    }

    const formattedDate = formatDate(timestamp);
    const finalStep = await Swal.fire({
      title: 'Final confirmation',
      html: `Backup <strong>${formattedDate}</strong> will be deleted.<br/>This action cannot be undone.`,
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Delete backup',
      cancelButtonText: 'Keep backup',
      confirmButtonColor: '#c92a2a',
      cancelButtonColor: '#228be6',
      allowOutsideClick: false,
    });

    if (!finalStep.isConfirmed) {
      return;
    }

    try {
      const data = await api.delete<{ success: boolean; error?: string }>(
        `/api/backup?timestamp=${encodeURIComponent(timestamp)}`
      );

      if (data.success) {
        showNotification({
          title: '✅ Deleted',
          message: 'Backup deleted',
          color: 'green',
        });
        await fetchBackups();
      }
    } catch (error) {
      showNotification({
        title: '❌ Delete Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handlePreviewBackup = async (backup: Backup) => {
    setSelectedBackup(backup);
    setPreviewModalOpen(true);
    setPreviewLoading(true);
    setRestoreResults(null);

    try {
      const jsonFile =
        backup.files.find(
          (f) => f.startsWith('backup-') && f.endsWith('.json')
        ) || backup.files.find((f) => f.endsWith('.json'));
      if (!jsonFile) {
        throw new Error('No JSON file found');
      }

      // Use API route to fetch the file
      const response = await fetch(
        `/api/backup/${backup.timestamp}/${jsonFile}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch backup: ${response.statusText}`);
      }
      const data: BackupData = await response.json();
      setPreviewData(data);
      const [firstTable] = Object.keys(data.tables);
      setSelectedTableName(firstTable ?? null);
      setRestoreSelection([]);
      setForceOverwrite(false);
      setPreviewJsonFile(jsonFile);
    } catch (error) {
      showNotification({
        title: 'Preview Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
      setPreviewModalOpen(false);
      setSelectedTableName(null);
      setPreviewJsonFile(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadJSON = async (backup: Backup) => {
    try {
      const jsonFile =
        backup.files.find(
          (f) => f.startsWith('backup-') && f.endsWith('.json')
        ) || backup.files.find((f) => f.endsWith('.json'));
      if (!jsonFile) {
        return;
      }

      // Use API route to fetch the file
      const response = await fetch(
        `/api/backup/${backup.timestamp}/${jsonFile}`
      );
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = jsonFile;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleDownloadSQL = async (backup: Backup) => {
    try {
      const sqlFile =
        backup.files.find(
          (f) => f.startsWith('backup-') && f.endsWith('.sql')
        ) || backup.files.find((f) => f.endsWith('.sql'));
      if (!sqlFile) {
        showNotification({
          title: 'No SQL File',
          message: 'This backup does not contain an SQL dump file',
          color: 'orange',
        });
        return;
      }

      // Use API route to fetch the file
      const response = await fetch(
        `/api/backup/${backup.timestamp}/${sqlFile}`
      );
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sqlFile;
      a.click();
      URL.revokeObjectURL(url);

      showNotification({
        title: 'Downloaded',
        message: sqlFile,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleDownloadXLSX = async (tableName: string) => {
    if (!previewData) {
      return;
    }

    try {
      const tableData = previewData.tables[tableName];
      if (!tableData?.data?.length) {
        return;
      }

      // Create worksheet from table data
      const ws = XLSX.utils.json_to_sheet(tableData.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, tableName);

      // Generate XLSX file
      XLSX.writeFile(wb, `${tableName}-${selectedBackup?.timestamp}.xlsx`);

      showNotification({
        title: 'Downloaded',
        message: `${tableName}.xlsx`,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleDownloadAllXLSX = async () => {
    if (!previewData) {
      return;
    }

    try {
      const wb = XLSX.utils.book_new();
      let sheetCount = 0;

      for (const [tableName, tableData] of Object.entries(previewData.tables)) {
        if (tableData.data?.length) {
          const ws = XLSX.utils.json_to_sheet(tableData.data);
          // Sheet names are limited to 31 characters in Excel
          const sheetName = tableName.substring(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
          sheetCount++;
        }
      }

      if (sheetCount > 0) {
        XLSX.writeFile(
          wb,
          `backup-all-tables-${selectedBackup?.timestamp}.xlsx`
        );
        showNotification({
          title: 'Downloaded',
          message: `${sheetCount} tables in workbook`,
          color: 'green',
        });
      }
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleDownloadCSV = async (tableName: string) => {
    if (!previewData) {
      return;
    }

    try {
      const tableData = previewData.tables[tableName];
      if (!tableData?.data?.length) {
        return;
      }

      const csv = Papa.unparse(tableData.data);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${tableName}-${selectedBackup?.timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      showNotification({
        title: 'Downloaded',
        message: `${tableName}.csv`,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const handleDownloadAllCSV = async () => {
    if (!previewData) {
      return;
    }

    let count = 0;
    for (const [tableName, tableData] of Object.entries(previewData.tables)) {
      if (tableData.data?.length) {
        const csv = Papa.unparse(tableData.data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tableName}-${selectedBackup?.timestamp}.csv`;
        await new Promise((r) => setTimeout(r, 100));
        a.click();
        URL.revokeObjectURL(url);
        count++;
      }
    }

    showNotification({
      title: 'Downloaded',
      message: `${count} CSV files`,
      color: 'green',
    });
  };

  const handleSelectAllTables = () => {
    if (!previewData) {
      return;
    }
    setRestoreSelection(Object.keys(previewData.tables));
  };

  const handleClearSelectedTables = () => {
    setRestoreSelection([]);
  };

  const toggleTableSelection = (table: string, checked: boolean) => {
    setRestoreSelection((prev) => {
      if (checked) {
        if (prev.includes(table)) {
          return prev;
        }
        return [...prev, table];
      }
      return prev.filter((t) => t !== table);
    });
  };

  const handleRestore = useCallback(async () => {
    if (!selectedBackup || !previewJsonFile || !previewData) {
      showNotification({
        title: 'Restore unavailable',
        message: 'Open a backup preview before restoring.',
        color: 'red',
      });
      return;
    }

    const tablesForConfirm = restoreSelection;

    if (!tablesForConfirm.length) {
      showNotification({
        title: 'Select tables',
        message: 'Choose at least one table to restore.',
        color: 'red',
      });
      return;
    }

    const formattedDate = formatDate(selectedBackup.timestamp);
    const listHtml = tablesForConfirm
      .map(
        (table) =>
          `<li><strong>${table}</strong> (${previewData.tables[table]?.count ?? 0} rows)</li>`
      )
      .join('');

    const confirmation = await Swal.fire({
      title: 'Restore backup?',
      width: 520,
      html: `
        <div style="text-align: left; font-size: 15px; line-height: 1.5;">
          <p style="font-weight: 600; color: #c92a2a;">You are about to restore these datasets:</p>
          <ul style="margin: 8px 0 18px 20px;">${listHtml}</ul>
          <p>This data comes from backup <strong>${formattedDate}</strong>.</p>
          <p style="margin-top: 10px; color: ${
            forceOverwrite ? '#c92a2a' : '#495057'
          };">
            ${forceOverwrite ? 'Existing data will be overwritten.' : 'Existing data will be preserved when duplicates exist.'}
          </p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Restore now',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#228be6',
      cancelButtonColor: '#868e96',
      allowOutsideClick: false,
    });

    if (!confirmation.isConfirmed) {
      return;
    }

    const secondary = await Swal.fire({
      title: 'Type "RESTORE" to confirm',
      input: 'text',
      inputAttributes: {
        autocapitalize: 'off',
      },
      inputPlaceholder: 'RESTORE',
      confirmButtonText: 'Yes, restore',
      confirmButtonColor: '#c92a2a',
      showCancelButton: true,
      cancelButtonColor: '#868e96',
      allowOutsideClick: false,
      preConfirm: (value) => {
        if (value?.trim().toUpperCase() !== 'RESTORE') {
          Swal.showValidationMessage('Please type RESTORE to continue.');
          return false;
        }
        return true;
      },
    });

    if (!secondary.isConfirmed) {
      return;
    }

    setRestoreLoading(true);

    try {
      const response = await api.post<{
        success: boolean;
        results?: RestoreResults;
        error?: string;
        message?: string;
      }>('/api/restore', {
        timestamp: selectedBackup.timestamp,
        file: previewJsonFile,
        tables: tablesForConfirm,
        forceOverwrite,
      });

      if (!response.success || !response.results) {
        throw new Error(response.error || 'Restore failed');
      }

      setRestoreResults(response.results);
      showNotification({
        title: 'Restore complete',
        message: `Restored ${tablesForConfirm.length} table${
          tablesForConfirm.length === 1 ? '' : 's'
        }.`,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Restore failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setRestoreLoading(false);
    }
  }, [
    selectedBackup,
    previewJsonFile,
    previewData,
    restoreSelection,
    forceOverwrite,
  ]);

  const selectedTableDetails = useMemo(() => {
    if (!previewData || !selectedTableName) {
      return null;
    }

    const table = previewData.tables[selectedTableName];
    if (!table) {
      return null;
    }

    const columns: string[] = [];
    (table.data || []).forEach((row) => {
      Object.keys(row).forEach((key) => {
        if (!columns.includes(key)) {
          columns.push(key);
        }
      });
    });

    return {
      name: selectedTableName,
      count: table.count,
      data: table.data || [],
      columns,
    };
  }, [previewData, selectedTableName]);

  const availableTables = previewData ? Object.keys(previewData.tables) : [];
  const restoreDisabled =
    restoreLoading ||
    !selectedBackup ||
    !previewJsonFile ||
    restoreSelection.length === 0;
  const restoreSummaryEntries = restoreResults
    ? Object.entries(restoreResults)
    : [];

  const formatDate = (timestamp: string) => {
    try {
      // Convert timestamp format from 2025-11-06T07-56-19 to 2025-11-06T07:56:19Z
      // The Z suffix tells JavaScript to treat this as UTC (even though it's Manila time)
      // This prevents JavaScript from treating it as local time and doing unwanted conversions
      const iso = timestamp.replace(/T(\d{2})-(\d{2})-(\d{2})/, 'T$1:$2:$3Z');
      const date = new Date(iso);
      if (isNaN(date.getTime())) {
        return timestamp;
      }

      // Timestamp is already in Manila time (UTC+8), display as-is with UTC formatter
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      });
    } catch {
      return timestamp;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <Stack gap="lg">
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Data Protection"
        color="blue"
      >
        <Text size="sm">
          Regular backups protect your data. Backups include JSON, CSV, XLSX,
          and SQL dump formats.
        </Text>
      </Alert>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Create Backup</Title>
          <Badge color="blue">Manual</Badge>
        </Group>

        <Stack gap="md">
          <Select
            label="Format"
            data={[
              { value: 'json', label: 'JSON only' },
              { value: 'csv', label: 'CSV only' },
              { value: 'xlsx', label: 'XLSX only' },
              { value: 'sql', label: 'SQL dump only' },
              { value: 'all', label: 'JSON + CSV + XLSX + SQL (recommended)' },
            ]}
            value={backupFormat}
            onChange={(v) => setBackupFormat(v || 'all')}
          />

          <Switch
            label="Include deleted records"
            checked={includeSoftDeleted}
            onChange={(e) => setIncludeSoftDeleted(e.currentTarget.checked)}
          />

          <Button
            leftSection={<IconDatabase size={16} />}
            onClick={() => void handleCreateBackup(false)}
            loading={creating}
            fullWidth
          >
            {creating ? 'Creating...' : 'Create Backup Now'}
          </Button>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Auto-Backup</Title>
          <Badge color={autoBackupEnabled ? 'green' : 'gray'}>
            {autoBackupEnabled ? 'ON' : 'OFF'}
          </Badge>
        </Group>

        <Stack gap="md">
          <Switch
            label="Enable automatic backups"
            checked={autoBackupEnabled}
            onChange={(e) => setAutoBackupEnabled(e.currentTarget.checked)}
          />

          {autoBackupEnabled && (
            <>
              <NumberInput
                label="Interval (minutes)"
                value={autoBackupInterval}
                onChange={(v) => setAutoBackupInterval(Number(v) || 30)}
                min={5}
                max={1440}
              />

              <Alert icon={<IconClock size={16} />} color="green">
                Backups every {autoBackupInterval} minutes while page is open
              </Alert>
            </>
          )}
        </Stack>
      </Card>

      <Divider />

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Backups ({backups.length})</Title>
          <ActionIcon onClick={() => void fetchBackups()} loading={loading}>
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>

        {loading ? (
          <Progress value={100} animated />
        ) : backups.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No backups found
          </Text>
        ) : (
          <ScrollArea h="55vh" scrollbarSize={10} offsetScrollbars>
            <MantineTable striped highlightOnHover>
              <MantineTable.Thead
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  background: 'var(--mantine-color-white)',
                }}
              >
                <MantineTable.Tr>
                  <MantineTable.Th>Date</MantineTable.Th>
                  <MantineTable.Th>Files</MantineTable.Th>
                  <MantineTable.Th>Size</MantineTable.Th>
                  <MantineTable.Th>Actions</MantineTable.Th>
                </MantineTable.Tr>
              </MantineTable.Thead>
              <MantineTable.Tbody>
                {backups.map((backup) => (
                  <MantineTable.Tr key={backup.timestamp}>
                    <MantineTable.Td>
                      <Text size="sm">{formatDate(backup.timestamp)}</Text>
                    </MantineTable.Td>
                    <MantineTable.Td>{backup.files.length}</MantineTable.Td>
                    <MantineTable.Td>
                      {formatFileSize(backup.totalSize)}
                    </MantineTable.Td>
                    <MantineTable.Td>
                      <Group gap="xs">
                        <ActionIcon
                          color="blue"
                          variant="subtle"
                          onClick={() => handlePreviewBackup(backup)}
                          title="Preview backup"
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="green"
                          variant="subtle"
                          onClick={() => handleDownloadJSON(backup)}
                          title="Download JSON"
                        >
                          <IconDownload size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="teal"
                          variant="subtle"
                          onClick={() => handleDownloadSQL(backup)}
                          title="Download SQL"
                        >
                          <IconDatabase size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() =>
                            void handleDeleteBackup(backup.timestamp)
                          }
                          title="Delete backup"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </MantineTable.Td>
                  </MantineTable.Tr>
                ))}
              </MantineTable.Tbody>
            </MantineTable>
          </ScrollArea>
        )}
      </Card>

      <Modal
        opened={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        title="Backup Preview"
        size="90vw"
        styles={{
          content: {
            maxWidth: '90vw',
            width: '90vw',
            maxHeight: '80vh',
            height: '80vh',
          },
        }}
      >
        {previewLoading ? (
          <Progress value={100} animated />
        ) : previewData?.metadata && previewData?.tables ? (
          <Tabs defaultValue="summary">
            <Tabs.List>
              <Tabs.Tab
                value="summary"
                leftSection={<IconFileText size={16} />}
              >
                Summary
              </Tabs.Tab>
              <Tabs.Tab value="tables" leftSection={<IconDatabase size={16} />}>
                Tables
              </Tabs.Tab>
              <Tabs.Tab
                value="download"
                leftSection={<IconDownload size={16} />}
              >
                Download
              </Tabs.Tab>
              <Tabs.Tab value="restore" leftSection={<IconHistory size={16} />}>
                Restore
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="summary" pt="md">
              <Stack gap="md">
                <Alert icon={<IconCheck size={16} />} color="blue">
                  <Stack gap="xs">
                    <Text size="sm">
                      Created:{' '}
                      {new Date(previewData.metadata.createdAt).toLocaleString(
                        'en-US',
                        {
                          year: 'numeric',
                          month: 'short',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'UTC',
                        }
                      )}
                    </Text>
                    <Text size="sm">
                      Database: {previewData.metadata.database}
                    </Text>
                  </Stack>
                </Alert>

                <Card withBorder>
                  <Title order={5} mb="sm">
                    Tables
                  </Title>
                  <Stack gap="xs">
                    {Object.entries(previewData.tables).map(([name, data]) => (
                      <Group key={name} justify="space-between">
                        <Text size="sm">{name}</Text>
                        <Badge>{data.count} records</Badge>
                      </Group>
                    ))}
                  </Stack>
                </Card>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="tables" pt="md">
              <Box
                style={{
                  height: 'calc(83vh - 220px)',
                  display: 'flex',
                  gap: 'var(--mantine-spacing-md)',
                }}
              >
                <Box style={{ width: 240, height: '100%' }}>
                  <ScrollArea
                    style={{ height: '100%' }}
                    offsetScrollbars
                    scrollbarSize={6}
                  >
                    <Stack gap="xs">
                      {Object.entries(previewData.tables).map(
                        ([name, data]) => {
                          const isActive = name === selectedTableName;

                          return (
                            <Card
                              key={name}
                              withBorder
                              padding="sm"
                              radius="sm"
                              shadow={isActive ? 'sm' : 'xs'}
                              onClick={() => setSelectedTableName(name)}
                              style={{
                                cursor: 'pointer',
                                backgroundColor: isActive
                                  ? '#edf2ff'
                                  : undefined,
                                borderColor: isActive ? '#4dabf7' : undefined,
                              }}
                            >
                              <Group justify="space-between" align="center">
                                <Text
                                  size="sm"
                                  fw={isActive ? 600 : 500}
                                  tt="capitalize"
                                >
                                  {name}
                                </Text>
                                <Badge color={isActive ? 'blue' : 'gray'}>
                                  {data.count}{' '}
                                  {data.count === 1 ? 'record' : 'records'}
                                </Badge>
                              </Group>
                            </Card>
                          );
                        }
                      )}
                    </Stack>
                  </ScrollArea>
                </Box>

                <Stack
                  gap="md"
                  style={{ flex: 1, minWidth: 0, height: '100%' }}
                >
                  {selectedTableDetails ? (
                    <>
                      <Group justify="space-between" align="flex-start">
                        <div>
                          <Title order={4} tt="capitalize">
                            {selectedTableDetails.name}
                          </Title>
                          <Text size="sm" c="dimmed">
                            {selectedTableDetails.count}{' '}
                            {selectedTableDetails.count === 1
                              ? 'record'
                              : 'records'}
                          </Text>
                        </div>
                        <Group gap="xs">
                          <Button
                            size="sm"
                            variant="light"
                            color="green"
                            leftSection={<IconFileTypeCsv size={14} />}
                            onClick={() =>
                              handleDownloadCSV(selectedTableDetails.name)
                            }
                          >
                            CSV
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            color="teal"
                            leftSection={<IconFileSpreadsheet size={14} />}
                            onClick={() =>
                              handleDownloadXLSX(selectedTableDetails.name)
                            }
                          >
                            XLSX
                          </Button>
                        </Group>
                      </Group>

                      {selectedTableDetails.data.length ? (
                        <Box style={{ flex: 1, minHeight: 0 }}>
                          <ScrollArea
                            style={{ height: '100%' }}
                            offsetScrollbars
                            scrollbarSize={8}
                          >
                            <div
                              style={{
                                minWidth: Math.max(
                                  selectedTableDetails.columns.length * 160,
                                  400
                                ),
                              }}
                            >
                              <MantineTable
                                striped
                                highlightOnHover
                                stickyHeader
                              >
                                <MantineTable.Thead>
                                  <MantineTable.Tr>
                                    {selectedTableDetails.columns.map(
                                      (column) => (
                                        <MantineTable.Th
                                          key={`${selectedTableDetails.name}-${column}`}
                                          style={{
                                            backgroundColor:
                                              'var(--mantine-color-body)',
                                            position: 'sticky',
                                            top: 0,
                                            zIndex: 1,
                                          }}
                                        >
                                          {column}
                                        </MantineTable.Th>
                                      )
                                    )}
                                  </MantineTable.Tr>
                                </MantineTable.Thead>
                                <MantineTable.Tbody>
                                  {selectedTableDetails.data.map((row) => {
                                    const rowKey = createRowKey(
                                      selectedTableDetails.name,
                                      row
                                    );

                                    return (
                                      <MantineTable.Tr key={rowKey}>
                                        {selectedTableDetails.columns.map(
                                          (column) => (
                                            <MantineTable.Td
                                              key={createCellKey(
                                                rowKey,
                                                column
                                              )}
                                            >
                                              <Text size="sm">
                                                {formatCellValue(row[column])}
                                              </Text>
                                            </MantineTable.Td>
                                          )
                                        )}
                                      </MantineTable.Tr>
                                    );
                                  })}
                                </MantineTable.Tbody>
                              </MantineTable>
                            </div>
                          </ScrollArea>
                        </Box>
                      ) : (
                        <Alert
                          icon={<IconAlertCircle size={16} />}
                          color="gray"
                        >
                          <Text size="sm" c="dimmed">
                            No data available for this table.
                          </Text>
                        </Alert>
                      )}
                    </>
                  ) : (
                    <Alert icon={<IconAlertCircle size={16} />} color="blue">
                      <Text size="sm">
                        Select a table from the list to view its full backup.
                      </Text>
                    </Alert>
                  )}
                </Stack>
              </Box>
            </Tabs.Panel>

            <Tabs.Panel value="download" pt="md">
              <Stack gap="md">
                <Button
                  leftSection={<IconFile size={16} />}
                  onClick={() =>
                    selectedBackup && handleDownloadJSON(selectedBackup)
                  }
                >
                  Download JSON
                </Button>
                <Button
                  color="teal"
                  leftSection={<IconDatabase size={16} />}
                  onClick={() =>
                    selectedBackup && handleDownloadSQL(selectedBackup)
                  }
                >
                  Download SQL Dump
                </Button>
                <Button
                  color="green"
                  leftSection={<IconFileTypeCsv size={16} />}
                  onClick={() => void handleDownloadAllCSV()}
                >
                  Download All CSV
                </Button>
                <Button
                  color="cyan"
                  leftSection={<IconFileSpreadsheet size={16} />}
                  onClick={() => void handleDownloadAllXLSX()}
                >
                  Download All XLSX
                </Button>
                <Divider />
                <Stack gap="xs">
                  {Object.entries(previewData.tables).map(([name, data]) => (
                    <Group key={name} justify="space-between">
                      <Text size="sm">{name}</Text>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="subtle"
                          color="green"
                          disabled={!data.count}
                          onClick={() => handleDownloadCSV(name)}
                        >
                          CSV
                        </Button>
                        <Button
                          size="xs"
                          variant="subtle"
                          color="cyan"
                          disabled={!data.count}
                          onClick={() => handleDownloadXLSX(name)}
                        >
                          XLSX
                        </Button>
                      </Group>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel
              value="restore"
              pt="md"
              style={{
                display: 'flex',
                flexDirection: 'column',
                maxHeight: 'calc(85vh - 80px)',
              }}
            >
              <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  color="yellow"
                  title="Caution"
                >
                  Restoring data will insert records from this backup. Select
                  the specific tables you want to bring back—anything unchecked
                  stays as-is.
                </Alert>

                <Box style={{ flex: 1, minHeight: 0 }}>
                  <ScrollArea style={{ height: '100%' }} offsetScrollbars>
                    <Stack gap="md">
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Text size="sm" fw={600}>
                            Tables in backup ({availableTables.length})
                          </Text>
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant="light"
                              onClick={handleSelectAllTables}
                            >
                              Select all
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              color="gray"
                              onClick={handleClearSelectedTables}
                            >
                              Clear
                            </Button>
                          </Group>
                        </Group>

                        <Stack gap="sm">
                          {availableTables.map((table) => {
                            const count = previewData.tables[table]?.count ?? 0;
                            const checked = restoreSelection.includes(table);
                            return (
                              <Box
                                key={table}
                                p="sm"
                                style={{
                                  borderRadius: 12,
                                  border: `1px solid ${
                                    checked
                                      ? 'var(--mantine-color-blue-5)'
                                      : 'var(--mantine-color-gray-3)'
                                  }`,
                                  backgroundColor: checked
                                    ? 'var(--mantine-color-blue-0)'
                                    : 'var(--mantine-color-white)',
                                  transition:
                                    'border-color 120ms ease, background-color 120ms ease',
                                }}
                              >
                                <Checkbox
                                  size="lg"
                                  checked={checked}
                                  onChange={(event) =>
                                    toggleTableSelection(
                                      table,
                                      event.currentTarget.checked
                                    )
                                  }
                                  styles={{
                                    body: { alignItems: 'flex-start' },
                                    label: { width: '100%' },
                                    inner: { marginTop: 4, marginRight: 14 },
                                  }}
                                  label={
                                    <Group justify="space-between" gap="sm">
                                      <Text fw={600} size="lg" tt="capitalize">
                                        {table}
                                      </Text>
                                      <Text size="sm" c="dimmed">
                                        {count} {count === 1 ? 'row' : 'rows'}
                                      </Text>
                                    </Group>
                                  }
                                />
                              </Box>
                            );
                          })}
                        </Stack>
                      </Stack>

                      {restoreSummaryEntries.length > 0 && (
                        <Card withBorder padding="md" radius="md">
                          <Stack gap="sm">
                            <Group justify="space-between">
                              <Text fw={600}>Last restore summary</Text>
                              <Badge color="green">Completed</Badge>
                            </Group>
                            <MantineTable striped highlightOnHover>
                              <MantineTable.Thead>
                                <MantineTable.Tr>
                                  <MantineTable.Th>Table</MantineTable.Th>
                                  <MantineTable.Th>Inserted</MantineTable.Th>
                                  <MantineTable.Th>Updated</MantineTable.Th>
                                  <MantineTable.Th>Attempted</MantineTable.Th>
                                  <MantineTable.Th>Skipped</MantineTable.Th>
                                  <MantineTable.Th>
                                    Before → After
                                  </MantineTable.Th>
                                  <MantineTable.Th>Notes</MantineTable.Th>
                                </MantineTable.Tr>
                              </MantineTable.Thead>
                              <MantineTable.Tbody>
                                {restoreSummaryEntries.map(
                                  ([table, result]) => (
                                    <MantineTable.Tr key={table}>
                                      <MantineTable.Td>{table}</MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.count}
                                      </MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.updated ?? '—'}
                                      </MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.attempted ?? '—'}
                                      </MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.skipped ?? '—'}
                                      </MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.beforeCount ?? '—'} →{' '}
                                        {result.afterCount ?? '—'}
                                      </MantineTable.Td>
                                      <MantineTable.Td>
                                        {result.error ? (
                                          <Text c="red" size="sm">
                                            {result.error}
                                          </Text>
                                        ) : (
                                          <Text c="green" size="sm">
                                            OK
                                          </Text>
                                        )}
                                      </MantineTable.Td>
                                    </MantineTable.Tr>
                                  )
                                )}
                              </MantineTable.Tbody>
                            </MantineTable>
                          </Stack>
                        </Card>
                      )}
                    </Stack>
                  </ScrollArea>
                </Box>

                <Switch
                  label="Force overwrite existing data"
                  description="Deletes existing records in the selected tables before restoring."
                  checked={forceOverwrite}
                  onChange={(event) =>
                    setForceOverwrite(event.currentTarget.checked)
                  }
                />
              </Stack>

              <Group justify="flex-end" mt="md">
                <Button
                  leftSection={<IconHistory size={16} />}
                  loading={restoreLoading}
                  disabled={restoreDisabled}
                  onClick={() => void handleRestore()}
                >
                  {restoreLoading ? 'Restoring…' : 'Restore Backup'}
                </Button>
              </Group>
            </Tabs.Panel>
          </Tabs>
        ) : (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            <Text size="sm">
              Failed to load backup data. The file may be corrupted.
            </Text>
          </Alert>
        )}
      </Modal>
    </Stack>
  );
}
