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
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
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
} from '@tabler/icons-react';
import Papa from 'papaparse';

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
      notifications.show({
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
          notifications.show({
            title: isAuto ? '✅ Auto-Backup Complete' : '✅ Backup Created',
            message: `Backup saved (${(data.backup.totalSize / 1024 / 1024).toFixed(2)} MB)`,
            color: 'green',
          });
          await fetchBackups();
        } else {
          throw new Error(data.error || 'Backup failed');
        }
      } catch (error) {
        notifications.show({
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
        notifications.show({
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
    });

    if (!finalStep.isConfirmed) {
      return;
    }

    try {
      const data = await api.delete<{ success: boolean; error?: string }>(
        `/api/backup?timestamp=${encodeURIComponent(timestamp)}`
      );

      if (data.success) {
        notifications.show({
          title: '✅ Deleted',
          message: 'Backup deleted',
          color: 'green',
        });
        await fetchBackups();
      }
    } catch (error) {
      notifications.show({
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
    } catch (error) {
      notifications.show({
        title: 'Preview Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
      setPreviewModalOpen(false);
      setSelectedTableName(null);
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
      notifications.show({
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

      notifications.show({
        title: 'Downloaded',
        message: `${tableName}.csv`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
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

    notifications.show({
      title: 'Downloaded',
      message: `${count} CSV files`,
      color: 'green',
    });
  };

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
          Regular backups protect your data. Backups include JSON and CSV
          formats.
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
              { value: 'all', label: 'JSON + CSV (recommended)' },
            ]}
            value={backupFormat}
            onChange={(v) => setBackupFormat(v || 'json')}
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
          <ScrollArea h={400}>
            <MantineTable>
              <MantineTable.Thead>
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
                        >
                          <IconEye size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="green"
                          variant="subtle"
                          onClick={() => handleDownloadJSON(backup)}
                        >
                          <IconDownload size={16} />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() =>
                            void handleDeleteBackup(backup.timestamp)
                          }
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
                        <Button
                          size="sm"
                          variant="light"
                          color="green"
                          leftSection={<IconFileTypeCsv size={14} />}
                          onClick={() =>
                            handleDownloadCSV(selectedTableDetails.name)
                          }
                        >
                          Download CSV
                        </Button>
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
                  color="green"
                  leftSection={<IconFileTypeCsv size={16} />}
                  onClick={() => void handleDownloadAllCSV()}
                >
                  Download All CSV
                </Button>
                <Divider />
                <Stack gap="xs">
                  {Object.entries(previewData.tables).map(([name, data]) => (
                    <Group key={name} justify="space-between">
                      <Text size="sm">{name}</Text>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="green"
                        disabled={!data.count}
                        onClick={() => handleDownloadCSV(name)}
                      >
                        CSV
                      </Button>
                    </Group>
                  ))}
                </Stack>
              </Stack>
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
