import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconAlertCircle, IconArrowsDiff } from '@tabler/icons-react';

import type { BackupChangePreview } from '../../backup/types';
import { guessRowLabel } from '../../backup/types';
import { UniversalModal } from '@/components/modals/UniversalModal';

type SelectedRowData =
  | {
      type: 'added' | 'removed';
      row: Record<string, unknown> | null;
    }
  | {
      type: 'updated';
      row: BackupChangePreview['updates'][number] | null;
    }
  | null;

interface BackupChangeDetailModalProps {
  opened: boolean;
  loading: boolean;
  tableName: string | null;
  preview: BackupChangePreview | null;
  error: string | null;
  changeTypeOptions: Array<{
    value: 'added' | 'updated' | 'removed';
    label: string;
  }>;
  selectedChangeType: 'added' | 'updated' | 'removed';
  onChangeType: (value: 'added' | 'updated' | 'removed') => void;
  rowOptions: Array<{ value: string; label: string }>;
  selectedRow: string | null;
  onSelectRow: (value: string | null) => void;
  rowData: SelectedRowData;
  onClose: () => void;
}

const renderValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return (
      <Text size="sm" c="dimmed" fs="italic">
        blank
      </Text>
    );
  }

  if (typeof value === 'object') {
    try {
      return (
        <Text size="sm" ff="monospace">
          {JSON.stringify(value)}
        </Text>
      );
    } catch {
      return (
        <Text size="sm" ff="monospace">
          [object]
        </Text>
      );
    }
  }

  return (
    <Text size="sm" ff="monospace">
      {String(value)}
    </Text>
  );
};

export const BackupChangeDetailModal = ({
  opened,
  loading,
  tableName,
  preview,
  error,
  changeTypeOptions,
  selectedChangeType,
  onChangeType,
  rowOptions,
  selectedRow,
  onSelectRow,
  rowData,
  onClose,
}: BackupChangeDetailModalProps) => (
  <UniversalModal
    opened={opened}
    onClose={onClose}
    title={`Changed rows${tableName ? `: ${tableName}` : ''}`}
    size="xl"
    radius="md"
    trapFocus={false}
  >
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        This preview compares the selected backup row-by-row against the live
        database for one table.
      </Text>

      {loading ? (
        <Alert color="blue" icon={<IconArrowsDiff size={16} />}>
          Loading detailed row changes...
        </Alert>
      ) : null}

      {error ? (
        <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
          {error}
        </Alert>
      ) : null}

      {preview ? (
        <>
          <Group gap="xs">
            <Badge color="green">{preview.addedCount} added</Badge>
            <Badge color="orange">{preview.updatedCount} updated</Badge>
            <Badge color="red">{preview.removedCount} removed</Badge>
            <Badge color="gray">
              {preview.backupCount} backup / {preview.currentCount} current
            </Badge>
          </Group>

          <Group align="flex-end" gap="md">
            <Select
              flex={1}
              label="Change type"
              placeholder="Select a change type"
              data={changeTypeOptions}
              value={selectedChangeType}
              onChange={(value) =>
                onChangeType(
                  (value as 'added' | 'updated' | 'removed') || 'added'
                )
              }
              disabled={changeTypeOptions.length <= 1}
            />

            <Select
              flex={1}
              label="Row"
              placeholder={
                rowOptions.length ? 'Select a row' : 'No rows available'
              }
              data={rowOptions}
              value={selectedRow}
              onChange={onSelectRow}
              searchable
              disabled={!rowOptions.length}
            />
          </Group>

          {(preview.truncatedAdded ||
            preview.truncatedRemoved ||
            preview.truncatedUpdates) && (
            <Alert color="blue" icon={<IconAlertCircle size={16} />}>
              Large change sets are sampled. Counts are accurate, but only a
              subset of rows is shown here.
            </Alert>
          )}

          <Card withBorder padding="md" radius="md">
            {rowData?.row ? (
              <Stack gap="sm">
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={600}>
                      {rowData.type === 'added'
                        ? 'Added row'
                        : rowData.type === 'removed'
                          ? 'Removed row'
                          : 'Updated row'}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {rowData.type === 'updated'
                        ? guessRowLabel(
                            rowData.row?.current ?? rowData.row?.backup ?? {},
                            'Selected row'
                          )
                        : guessRowLabel(rowData.row ?? {}, 'Selected row')}
                    </Text>
                  </div>
                  {rowData.type === 'updated' &&
                  rowData.row?.id !== undefined ? (
                    <Badge color="gray">ID {String(rowData.row.id)}</Badge>
                  ) : null}
                </Group>

                <ScrollArea h={320} offsetScrollbars scrollbarSize={6}>
                  {rowData.type === 'updated' ? (
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Column</Table.Th>
                          <Table.Th>Backup</Table.Th>
                          <Table.Th>Current</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {Object.entries(rowData.row?.changes ?? {}).map(
                          ([column, diff]) => (
                            <Table.Tr key={column}>
                              <Table.Td>
                                <Text size="sm" fw={600}>
                                  {column}
                                </Text>
                              </Table.Td>
                              <Table.Td>{renderValue(diff.before)}</Table.Td>
                              <Table.Td>{renderValue(diff.after)}</Table.Td>
                            </Table.Tr>
                          )
                        )}
                      </Table.Tbody>
                    </Table>
                  ) : (
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Column</Table.Th>
                          <Table.Th>Value</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {Object.entries(rowData.row ?? {}).map(
                          ([column, value]) => (
                            <Table.Tr key={column}>
                              <Table.Td>
                                <Text size="sm" fw={600}>
                                  {column}
                                </Text>
                              </Table.Td>
                              <Table.Td>{renderValue(value)}</Table.Td>
                            </Table.Tr>
                          )
                        )}
                      </Table.Tbody>
                    </Table>
                  )}
                </ScrollArea>
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Select a change type and row to inspect what actually changed.
              </Text>
            )}
          </Card>
        </>
      ) : null}

      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Close
        </Button>
      </Group>
    </Stack>
  </UniversalModal>
);
