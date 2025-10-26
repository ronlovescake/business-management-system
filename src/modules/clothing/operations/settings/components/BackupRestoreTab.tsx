'use client';

/**
 * BackupRestoreTab Component
 *
 * Comprehensive backup and restore management UI
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Stack,
  Group,
  Button,
  Card,
  Text,
  Title,
  Badge,
  Select,
  Switch,
  Table,
  ActionIcon,
  Modal,
  Checkbox,
  Alert,
  Progress,
  Divider,
  ScrollArea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { api } from '@/lib/api/client';
import Swal from 'sweetalert2';
import {
  IconDatabase,
  IconDownload,
  IconTrash,
  IconClock,
  IconFileTypeSql,
  IconFileTypeCsv,
  IconRefresh,
  IconAlertCircle,
  IconCheck,
  IconRestore,
  IconFile,
} from '@tabler/icons-react';

// Custom styles for SweetAlert2
const swalStyles = `
  .swal2-popup-large {
    width: 600px !important;
    font-size: 1rem !important;
  }
  .swal2-html-container {
    line-height: 1.6 !important;
  }
  .swal2-html-container p {
    margin: 0;
  }
  .swal2-html-container ul,
  .swal2-html-container ol {
    margin: 8px 0;
    padding-left: 24px;
  }
  .swal2-html-container li {
    margin: 4px 0;
  }
`;

// Inject styles if not already present
if (
  typeof document !== 'undefined' &&
  !document.getElementById('backup-swal-styles')
) {
  const styleElement = document.createElement('style');
  styleElement.id = 'backup-swal-styles';
  styleElement.textContent = swalStyles;
  document.head.appendChild(styleElement);
}

interface Backup {
  timestamp: string;
  path: string;
  files: string[];
  totalSize: number;
  manifest?: {
    format: string;
    database: string;
  };
}

interface DeletedRecord {
  id: number | string;
  deletedAt: string;
  [key: string]: unknown;
}

export function BackupRestoreTab() {
  // State
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [backupFormat, setBackupFormat] = useState<string>('json');
  const [includeSoftDeleted, setIncludeSoftDeleted] = useState(false);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);

  // Restore modal state
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [forceOverwrite, setForceOverwrite] = useState(false);

  // Soft-delete restore state
  const [softDeleteModalOpen, setSoftDeleteModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string>('transactions');
  const [deletedRecords, setDeletedRecords] = useState<DeletedRecord[]>([]);
  const [selectedRecords, setSelectedRecords] = useState<(number | string)[]>(
    []
  );

  const AVAILABLE_TABLES = [
    'transactions',
    'customers',
    'products',
    'prices',
    'shipments',
    'employees',
    'schedules',
    'attendance',
    'payrolls',
  ];

  // Fetch backups
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

  // Create backup
  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const data = await api.post<{
        success: boolean;
        backup?: { totalSize: number };
        error?: string;
      }>('/api/backup', {
        format: backupFormat,
        includeSoftDeleted,
      });

      if (data.success) {
        notifications.show({
          title: '✅ Backup Created',
          message: `Backup saved successfully${data.backup ? ` (${(data.backup.totalSize / 1024 / 1024).toFixed(2)} MB)` : ''}`,
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
      setCreating(false);
    }
  };

  // Delete backup
  const handleDeleteBackup = async (timestamp: string) => {
    const result = await Swal.fire({
      title: 'Delete Backup?',
      html: `
        <div style="text-align: left;">
          <p>Are you sure you want to delete this backup?</p>
          <p style="margin-top: 12px;"><strong>Backup Date:</strong> ${formatDate(timestamp)}</p>
          <p style="margin-top: 12px; color: #e03131;">This action cannot be undone!</p>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e03131',
      cancelButtonColor: '#868e96',
      confirmButtonText: 'Yes, delete it',
      cancelButtonText: 'Cancel',
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      const data = await api.delete<{ success: boolean; error?: string }>(
        `/api/backup?timestamp=${encodeURIComponent(timestamp)}`
      );

      if (data.success) {
        notifications.show({
          title: '✅ Backup Deleted',
          message: 'Backup deleted successfully',
          color: 'green',
        });
        await fetchBackups();
      } else {
        throw new Error(data.error || 'Delete failed');
      }
    } catch (error) {
      notifications.show({
        title: '❌ Delete Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  // Open restore modal
  const openRestoreModal = (backup: Backup) => {
    setSelectedBackup(backup);
    setSelectedTables(AVAILABLE_TABLES); // Select all by default
    setForceOverwrite(false); // Reset overwrite option
    setRestoreModalOpen(true);
  };

  // Restore from backup
  const handleRestore = async () => {
    if (!selectedBackup) {
      return;
    }

    // Show SweetAlert2 warning
    const result = await Swal.fire({
      title: forceOverwrite ? '🚨 CRITICAL WARNING!' : '⚠️ WARNING',
      html: forceOverwrite
        ? `
          <div style="text-align: left;">
            <p><strong>Force Overwrite will:</strong></p>
            <ol>
              <li>DELETE ALL current data in selected tables</li>
              <li>RESTORE ONLY data from this backup</li>
            </ol>
            
            <p style="margin-top: 16px;"><strong>⚠️ YOU WILL LOSE:</strong></p>
            <ul>
              <li>Any data added AFTER this backup was created</li>
              <li>Any changes made AFTER this backup</li>
            </ul>
            
            <p style="margin-top: 16px;"><strong>Backup Date:</strong> ${formatDate(selectedBackup.timestamp)}</p>
            
            <p style="margin-top: 16px; color: #e03131; font-weight: bold;">💡 TIP: Create a NEW backup first to save current state!</p>
            
            <p style="margin-top: 16px;"><strong>Are you ABSOLUTELY SURE you want to continue?</strong></p>
          </div>
        `
        : `
          <div style="text-align: left;">
            <p><strong>This will overwrite existing data in selected tables!</strong></p>
            <p style="margin-top: 16px;">Are you sure?</p>
          </div>
        `,
      icon: forceOverwrite ? 'error' : 'warning',
      showCancelButton: true,
      confirmButtonColor: forceOverwrite ? '#e03131' : '#228be6',
      cancelButtonColor: '#868e96',
      confirmButtonText: forceOverwrite
        ? 'Yes, I understand the risk'
        : 'Yes, proceed',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: 'swal2-popup-large',
      },
    });

    if (!result.isConfirmed) {
      return;
    }

    // If force overwrite, ask one more time
    if (forceOverwrite) {
      const finalConfirm = await Swal.fire({
        title: '⚠️ FINAL CONFIRMATION',
        html: `
          <div style="text-align: left;">
            <p style="font-size: 18px; font-weight: bold; color: #e03131;">This cannot be undone!</p>
            <p style="margin-top: 16px;">All current data in selected tables will be <strong>permanently deleted</strong> and replaced with backup data.</p>
            <p style="margin-top: 16px;">Proceed with force overwrite?</p>
          </div>
        `,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#e03131',
        cancelButtonColor: '#868e96',
        confirmButtonText: 'Yes, force overwrite',
        cancelButtonText: 'No, cancel',
      });

      if (!finalConfirm.isConfirmed) {
        return;
      }
    }

    try {
      // Find JSON file (starts with 'backup-' and ends with '.json')
      const jsonFile = selectedBackup.files.find(
        (f) => f.startsWith('backup-') && f.endsWith('.json')
      );

      if (!jsonFile) {
        notifications.show({
          title: '❌ No JSON Backup Found',
          message:
            'This backup does not contain a JSON file. Only JSON backups can be restored via UI.',
          color: 'red',
        });
        return;
      }

      const data = await api.post<{
        success: boolean;
        results?: Record<
          string,
          {
            count: number;
            attempted?: number;
            skipped?: number;
            beforeCount?: number;
            afterCount?: number;
            error?: string;
          }
        >;
        error?: string;
      }>('/api/restore', {
        timestamp: selectedBackup.timestamp,
        file: jsonFile,
        tables: selectedTables,
        forceOverwrite,
      });

      if (data.success) {
        const results = data.results as Record<
          string,
          {
            count: number;
            attempted?: number;
            skipped?: number;
            beforeCount?: number;
            afterCount?: number;
            error?: string;
          }
        >;

        const totalRestored = Object.values(results).reduce(
          (sum, result) => sum + result.count,
          0
        );

        const totalSkipped = Object.values(results).reduce(
          (sum, result) => sum + (result.skipped || 0),
          0
        );

        const hasErrors = Object.values(results).some((r) => r.error);

        let message = '';
        if (totalRestored > 0) {
          message = `Successfully restored ${totalRestored} new records`;
          if (totalSkipped > 0) {
            message += ` (${totalSkipped} duplicates skipped)`;
          }
        } else if (totalSkipped > 0) {
          message = `All ${totalSkipped} records already exist in the database (no new records added)`;
        } else {
          message = 'No records were restored';
        }

        notifications.show({
          title:
            totalRestored > 0 ? '✅ Restore Complete' : '⚠️ No New Records',
          message,
          color: totalRestored > 0 ? 'green' : 'yellow',
          autoClose: 7000,
        });

        if (hasErrors) {
          const errorTables = Object.entries(results)
            .filter(([, r]) => r.error)
            .map(([table]) => table)
            .join(', ');

          notifications.show({
            title: '⚠️ Some Tables Had Errors',
            message: `Errors in: ${errorTables}`,
            color: 'orange',
            autoClose: 7000,
          });
        }

        setRestoreModalOpen(false);
      } else {
        throw new Error(data.error || 'Restore failed');
      }
    } catch (error) {
      notifications.show({
        title: '❌ Restore Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
        autoClose: 7000,
      });
    }
  };

  // Fetch soft-deleted records
  const fetchDeletedRecords = async () => {
    try {
      const data = await api.get<{
        success: boolean;
        records?: DeletedRecord[];
      }>(`/api/restore?table=${encodeURIComponent(selectedTable)}`);

      if (data.success) {
        setDeletedRecords(data.records || []);
        setSelectedRecords([]);
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to load deleted records',
        color: 'red',
      });
    }
  };

  // Restore soft-deleted records
  const handleRestoreSoftDeleted = async () => {
    if (selectedRecords.length === 0) {
      return;
    }

    try {
      const data = await api.patch<{
        success: boolean;
        count?: number;
        error?: string;
      }>('/api/restore', {
        table: selectedTable,
        ids: selectedRecords,
      });

      if (data.success) {
        notifications.show({
          title: '✅ Records Restored',
          message: `Restored ${data.count} records`,
          color: 'green',
        });
        await fetchDeletedRecords();
      } else {
        throw new Error(data.error || 'Restore failed');
      }
    } catch (error) {
      notifications.show({
        title: '❌ Restore Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  };

  const formatDate = (timestamp: string) => {
    try {
      // Parse timestamp format: 2025-10-24T15-30-32
      // Convert to: 2025-10-24T15:30:32
      const isoFormat = timestamp.replace(
        /T(\d{2})-(\d{2})-(\d{2})/,
        'T$1:$2:$3'
      );
      const date = new Date(isoFormat);

      if (isNaN(date.getTime())) {
        return timestamp; // Return original if parsing fails
      }

      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
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
      {/* Header Alert */}
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Data Protection"
        color="blue"
      >
        <Text size="sm">
          Regular backups protect your business data from accidental deletion or
          corruption. Backups are stored locally in the <code>/backups</code>{' '}
          folder.
        </Text>
      </Alert>

      {/* Create Backup Section */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Create Backup</Title>
          <Badge color="blue" size="lg">
            Manual Backup
          </Badge>
        </Group>

        <Stack gap="md">
          <Select
            label="Backup Format"
            description="Choose the backup format (JSON recommended for quick backups)"
            data={[
              { value: 'json', label: 'JSON - Fast, human-readable' },
              {
                value: 'sql',
                label: 'SQL - Complete PostgreSQL dump (requires pg_dump)',
              },
              { value: 'all', label: 'ALL - Both JSON + SQL (recommended)' },
            ]}
            value={backupFormat}
            onChange={(value) => setBackupFormat(value || 'json')}
          />

          <Switch
            label="Include soft-deleted records"
            description="Include records that were previously deleted"
            checked={includeSoftDeleted}
            onChange={(event) =>
              setIncludeSoftDeleted(event.currentTarget.checked)
            }
          />

          <Button
            leftSection={<IconDatabase size={16} />}
            onClick={() => void handleCreateBackup()}
            loading={creating}
            size="md"
            fullWidth
          >
            {creating ? 'Creating Backup...' : 'Create Backup Now'}
          </Button>
        </Stack>
      </Card>

      {/* Automatic Backup Section */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Automatic Backup</Title>
          <Badge color={autoBackupEnabled ? 'green' : 'gray'} size="lg">
            {autoBackupEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </Group>

        <Stack gap="md">
          <Switch
            label="Enable automatic daily backups"
            description="Create a backup every day at 2:00 AM (requires cron job setup)"
            checked={autoBackupEnabled}
            onChange={(event) =>
              setAutoBackupEnabled(event.currentTarget.checked)
            }
          />

          {autoBackupEnabled && (
            <Alert
              icon={<IconClock size={16} />}
              title="Setup Required"
              color="yellow"
            >
              <Text size="sm">
                Add this to your crontab to enable daily backups:
              </Text>
              <code
                style={{
                  display: 'block',
                  marginTop: '8px',
                  padding: '8px',
                  background: '#f5f5f5',
                }}
              >
                0 2 * * * cd /path/to/project && node scripts/backup-database.js
                --format=sql
              </code>
            </Alert>
          )}
        </Stack>
      </Card>

      <Divider />

      {/* Restore Options Section */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={3} mb="md">
          Restore Options
        </Title>

        <Stack gap="md">
          <Button
            leftSection={<IconRestore size={16} />}
            variant="outline"
            onClick={() => {
              setSoftDeleteModalOpen(true);
              void fetchDeletedRecords();
            }}
          >
            Restore Recently Deleted Records
          </Button>

          <Text size="sm" c="dimmed">
            Quick restore for accidentally deleted items (from soft-delete
            protection)
          </Text>
        </Stack>
      </Card>

      <Divider />

      {/* Available Backups Section */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Available Backups ({backups.length})</Title>
          <ActionIcon
            variant="subtle"
            onClick={() => void fetchBackups()}
            loading={loading}
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>

        {loading ? (
          <Progress value={100} animated />
        ) : backups.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No backups found. Create your first backup above.
          </Text>
        ) : (
          <ScrollArea style={{ height: 400 }}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date & Time</Table.Th>
                  <Table.Th>Format</Table.Th>
                  <Table.Th>Files</Table.Th>
                  <Table.Th>Size</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {backups.map((backup) => (
                  <Table.Tr key={backup.timestamp}>
                    <Table.Td>
                      <Group gap="xs">
                        <IconClock size={16} />
                        <Text size="sm">{formatDate(backup.timestamp)}</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        {backup.files.some((f) => f.endsWith('.json')) && (
                          <IconFile size={18} color="blue" />
                        )}
                        {backup.files.some((f) => f.endsWith('.sql')) && (
                          <IconFileTypeSql size={18} color="green" />
                        )}
                        {backup.files.some((f) => f.endsWith('.csv')) && (
                          <IconFileTypeCsv size={18} color="orange" />
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{backup.files.length} files</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatFileSize(backup.totalSize)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ActionIcon
                          color="blue"
                          variant="subtle"
                          onClick={() => openRestoreModal(backup)}
                        >
                          <IconDownload size={18} />
                        </ActionIcon>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() =>
                            void handleDeleteBackup(backup.timestamp)
                          }
                        >
                          <IconTrash size={18} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Card>

      {/* Restore Modal */}
      <Modal
        opened={restoreModalOpen}
        onClose={() => setRestoreModalOpen(false)}
        title="Restore from Backup"
        size="lg"
      >
        <Stack gap="md">
          <Alert
            icon={<IconAlertCircle size={16} />}
            title="Warning"
            color="red"
          >
            This will overwrite existing data in the selected tables!
          </Alert>

          {selectedBackup && (
            <>
              <div>
                <Text size="sm" fw={500}>
                  Backup Date:
                </Text>
                <Text size="sm" c="dimmed">
                  {formatDate(selectedBackup.timestamp)}
                </Text>
              </div>

              <div>
                <Text size="sm" fw={500}>
                  Backup Files:
                </Text>
                <Group gap="xs" mt="xs">
                  {selectedBackup.files.map((file) => (
                    <Badge
                      key={file}
                      color={
                        file.endsWith('.json')
                          ? 'blue'
                          : file.endsWith('.sql')
                            ? 'green'
                            : 'gray'
                      }
                      size="sm"
                    >
                      {file}
                    </Badge>
                  ))}
                </Group>
                {!selectedBackup.files.some(
                  (f) => f.startsWith('backup-') && f.endsWith('.json')
                ) && (
                  <Alert
                    icon={<IconAlertCircle size={16} />}
                    title="No JSON Backup"
                    color="yellow"
                    mt="xs"
                  >
                    This backup does not contain a JSON file. Only JSON backups
                    can be restored via UI. Use the CLI restore script for SQL
                    backups.
                  </Alert>
                )}
              </div>

              <div>
                <Text size="sm" fw={500} mb="xs">
                  Select Tables to Restore:
                </Text>
                <Stack gap="xs">
                  <Checkbox
                    label="Select All"
                    checked={selectedTables.length === AVAILABLE_TABLES.length}
                    onChange={(event) =>
                      setSelectedTables(
                        event.currentTarget.checked ? AVAILABLE_TABLES : []
                      )
                    }
                  />
                  {AVAILABLE_TABLES.map((table) => (
                    <Checkbox
                      key={table}
                      label={table.charAt(0).toUpperCase() + table.slice(1)}
                      checked={selectedTables.includes(table)}
                      onChange={(event) => {
                        if (event.currentTarget.checked) {
                          setSelectedTables([...selectedTables, table]);
                        } else {
                          setSelectedTables(
                            selectedTables.filter((t) => t !== table)
                          );
                        }
                      }}
                    />
                  ))}
                </Stack>
              </div>

              <Divider />

              <div>
                <Text size="sm" fw={500} mb="xs">
                  Restore Options:
                </Text>
                <Switch
                  label="Force overwrite existing records"
                  description="Required to restore data when records exist but values were changed/deleted"
                  checked={forceOverwrite}
                  onChange={(event) =>
                    setForceOverwrite(event.currentTarget.checked)
                  }
                  color="red"
                />
                <Alert
                  icon={<IconAlertCircle size={16} />}
                  title={
                    forceOverwrite
                      ? '🚨 DANGER - Read Carefully!'
                      : 'ℹ️ Skip Duplicates Mode'
                  }
                  color={forceOverwrite ? 'red' : 'blue'}
                  mt="xs"
                >
                  {forceOverwrite ? (
                    <>
                      <Text size="sm" fw={700} c="red">
                        ⚠️ YOU WILL LOSE ALL DATA ADDED AFTER THIS BACKUP!
                      </Text>
                      <Text size="sm" mt="xs" fw={500}>
                        This will:
                      </Text>
                      <Text size="sm">
                        1. DELETE all current records in selected tables
                      </Text>
                      <Text size="sm">2. RESTORE only records from backup</Text>
                      <Text size="sm" mt="xs" fw={500}>
                        Example:
                      </Text>
                      <Text size="sm">
                        • Backup has 15 customers (10:00 AM)
                      </Text>
                      <Text size="sm">
                        • You added 5 more customers (11:00 AM)
                      </Text>
                      <Text size="sm">
                        • After restore: Only 15 customers remain
                      </Text>
                      <Text size="sm">
                        • The 5 new customers = GONE FOREVER
                      </Text>
                      <Text size="sm" mt="xs" fw={700} c="red">
                        💡 CREATE A NEW BACKUP FIRST!
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text size="sm" fw={500}>
                        This will:
                      </Text>
                      <Text size="sm">
                        Only add records with NEW IDs (not in database)
                      </Text>
                      <Text size="sm" mt="xs" fw={500}>
                        ⚠️ Won&apos;t restore if you:
                      </Text>
                      <Text size="sm">
                        • Deleted column values (records still exist)
                      </Text>
                      <Text size="sm">• Modified existing records</Text>
                      <Text size="sm" fw={500} mt="xs">
                        → Enable &quot;Force overwrite&quot; to restore changed
                        data
                      </Text>
                    </>
                  )}
                </Alert>
              </div>

              <Group justify="flex-end" mt="md">
                <Button
                  variant="subtle"
                  onClick={() => setRestoreModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  color="red"
                  onClick={() => void handleRestore()}
                  disabled={
                    selectedTables.length === 0 ||
                    !selectedBackup.files.some(
                      (f) => f.startsWith('backup-') && f.endsWith('.json')
                    )
                  }
                >
                  Restore Selected Tables
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      {/* Soft-Delete Restore Modal */}
      <Modal
        opened={softDeleteModalOpen}
        onClose={() => setSoftDeleteModalOpen(false)}
        title="Restore Deleted Records"
        size="xl"
      >
        <Stack gap="md">
          <Select
            label="Table"
            data={AVAILABLE_TABLES.map((t) => ({
              value: t,
              label: t.charAt(0).toUpperCase() + t.slice(1),
            }))}
            value={selectedTable}
            onChange={(value) => {
              setSelectedTable(value || 'transactions');
              void fetchDeletedRecords();
            }}
          />

          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={() => void fetchDeletedRecords()}
            size="sm"
          >
            Refresh
          </Button>

          {deletedRecords.length === 0 ? (
            <Alert
              icon={<IconCheck size={16} />}
              title="No Deleted Records"
              color="green"
            >
              No recently deleted records found in this table.
            </Alert>
          ) : (
            <>
              <Text size="sm" fw={500}>
                Found {deletedRecords.length} deleted records:
              </Text>
              <ScrollArea style={{ height: 300 }}>
                <Stack gap="xs">
                  {deletedRecords.map((record) => (
                    <Checkbox
                      key={String(record.id)}
                      label={`ID: ${record.id} - Deleted: ${new Date(record.deletedAt).toLocaleString()}`}
                      checked={selectedRecords.includes(record.id)}
                      onChange={(event) => {
                        if (event.currentTarget.checked) {
                          setSelectedRecords([...selectedRecords, record.id]);
                        } else {
                          setSelectedRecords(
                            selectedRecords.filter((id) => id !== record.id)
                          );
                        }
                      }}
                    />
                  ))}
                </Stack>
              </ScrollArea>

              <Group justify="flex-end" mt="md">
                <Button
                  variant="subtle"
                  onClick={() => setSoftDeleteModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  color="blue"
                  onClick={() => void handleRestoreSoftDeleted()}
                  disabled={selectedRecords.length === 0}
                >
                  Restore Selected ({selectedRecords.length})
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
