import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  Group,
  Progress,
  ScrollArea,
  Stack,
  Table as MantineTable,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconDatabase,
  IconFile,
  IconFileSpreadsheet,
  IconFileTypeCsv,
  IconHistory,
} from '@tabler/icons-react';
import type { BackupData, RestoreResults } from '../../backup/types';
import { formatBackupTimestamp } from '../../backup/types';
import { BackupTablesBrowser } from './BackupTablesBrowser';
import { UniversalModal } from '@/components/modals/UniversalModal';

type SelectedTableDetails = {
  name: string;
  count: number;
  data: Array<Record<string, unknown>>;
  columns: string[];
} | null;

interface BackupPreviewModalProps {
  opened: boolean;
  loading: boolean;
  previewData: BackupData | null;
  selectedTableName: string | null;
  selectedTableDetails: SelectedTableDetails;
  availableTables: string[];
  restoreSelection: string[];
  restoreSummaryEntries: Array<[string, RestoreResults[string]]>;
  forceOverwrite: boolean;
  restoreLoading: boolean;
  restoreDisabled: boolean;
  canDownloadBackup: boolean;
  onClose: () => void;
  onSelectTable: (table: string) => void | Promise<void>;
  onSelectAllTables: () => void;
  onClearSelectedTables: () => void;
  onToggleTable: (table: string, checked: boolean) => void;
  onSetForceOverwrite: (value: boolean) => void;
  onDownloadJSON: () => void;
  onDownloadSQL: () => void;
  onDownloadAllCSV: () => void;
  onDownloadAllXLSX: () => void;
  onDownloadCSV: (table: string) => void;
  onDownloadXLSX: (table: string) => void;
  onRestore: () => void;
}

export const BackupPreviewModal = ({
  opened,
  loading,
  previewData,
  selectedTableName,
  selectedTableDetails,
  availableTables,
  restoreSelection,
  restoreSummaryEntries,
  forceOverwrite,
  restoreLoading,
  restoreDisabled,
  canDownloadBackup,
  onClose,
  onSelectTable,
  onSelectAllTables,
  onClearSelectedTables,
  onToggleTable,
  onSetForceOverwrite,
  onDownloadJSON,
  onDownloadSQL,
  onDownloadAllCSV,
  onDownloadAllXLSX,
  onDownloadCSV,
  onDownloadXLSX,
  onRestore,
}: BackupPreviewModalProps) => (
  <UniversalModal
    opened={opened}
    onClose={onClose}
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
    {loading && !previewData ? (
      <Progress value={100} animated />
    ) : previewData?.metadata && previewData?.tables ? (
      <Tabs defaultValue="summary">
        <Tabs.List>
          <Tabs.Tab value="summary">Summary</Tabs.Tab>
          <Tabs.Tab value="tables">Tables</Tabs.Tab>
          <Tabs.Tab value="download">Download</Tabs.Tab>
          <Tabs.Tab value="restore">Restore</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="summary" pt="md">
          <Stack gap="md">
            <Alert icon={<IconHistory size={16} />} color="blue">
              <Stack gap="xs">
                <Text size="sm">
                  Created:{' '}
                  {formatBackupTimestamp(previewData.metadata.createdAt)}
                </Text>
                <Text size="sm">Database: {previewData.metadata.database}</Text>
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
          <BackupTablesBrowser
            previewData={previewData}
            selectedTableName={selectedTableName}
            selectedTableDetails={selectedTableDetails}
            onSelectTable={onSelectTable}
          />
        </Tabs.Panel>

        <Tabs.Panel value="download" pt="md">
          <Stack gap="md">
            <Button
              leftSection={<IconFile size={16} />}
              onClick={onDownloadJSON}
              disabled={!canDownloadBackup}
            >
              Download JSON
            </Button>
            <Button
              color="teal"
              leftSection={<IconDatabase size={16} />}
              onClick={onDownloadSQL}
              disabled={!canDownloadBackup}
            >
              Download SQL Dump
            </Button>
            <Button
              color="green"
              leftSection={<IconFileTypeCsv size={16} />}
              onClick={onDownloadAllCSV}
              disabled={!previewData}
            >
              Download All CSV
            </Button>
            <Button
              color="cyan"
              leftSection={<IconFileSpreadsheet size={16} />}
              onClick={onDownloadAllXLSX}
              disabled={!previewData}
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
                      onClick={() => onDownloadCSV(name)}
                    >
                      CSV
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="cyan"
                      disabled={!data.count}
                      onClick={() => onDownloadXLSX(name)}
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
              Restoring data will insert records from this backup. Select the
              specific tables you want to bring back—anything unchecked stays
              as-is.
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
                          onClick={onSelectAllTables}
                        >
                          Select all
                        </Button>
                        <Button
                          size="xs"
                          variant="light"
                          color="gray"
                          onClick={onClearSelectedTables}
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
                                onToggleTable(
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
                        <ScrollArea h={220} offsetScrollbars>
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
                              {restoreSummaryEntries.map(([table, result]) => (
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
                              ))}
                            </MantineTable.Tbody>
                          </MantineTable>
                        </ScrollArea>
                      </Stack>
                    </Card>
                  )}
                </Stack>
              </ScrollArea>
            </Box>

            <Checkbox
              label="Force overwrite existing data"
              description="Deletes existing records in the selected tables before restoring."
              checked={forceOverwrite}
              onChange={(event) =>
                onSetForceOverwrite(event.currentTarget.checked)
              }
            />
          </Stack>

          <Group justify="flex-end" mt="md">
            <Button
              leftSection={<IconHistory size={16} />}
              loading={restoreLoading}
              disabled={restoreDisabled}
              onClick={onRestore}
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
  </UniversalModal>
);
