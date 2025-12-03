import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table as MantineTable,
  Text,
} from '@mantine/core';
import { IconAlertCircle, IconHistory } from '@tabler/icons-react';
import type { RestorePreviewResults } from '../../backup/types';
import { guessRowLabel } from '../../backup/types';

type RestorePreviewEntry = RestorePreviewResults[string] | null;
type RestorePreviewRow =
  | {
      type: 'insert';
      row: RestorePreviewResults[string]['inserts'][number] | null;
    }
  | {
      type: 'update';
      row: RestorePreviewResults[string]['updates'][number] | null;
    }
  | null;

interface RestorePreviewModalProps {
  opened: boolean;
  loading: boolean;
  forceOverwrite: boolean;
  tableOptions: Array<{ value: string; label: string }>;
  selectedTable: string | null;
  onSelectTable: (value: string | null) => void;
  changeTypeOptions: Array<{ value: 'insert' | 'update'; label: string }>;
  changeType: 'insert' | 'update';
  onChangeType: (value: 'insert' | 'update') => void;
  rowOptions: Array<{ value: string; label: string }>;
  selectedRow: string | null;
  onSelectRow: (value: string | null) => void;
  entry: RestorePreviewEntry;
  rowData: RestorePreviewRow;
  onClose: () => void;
  onConfirm: () => void;
}

const renderPreviewValue = (value: unknown) => {
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

export const RestorePreviewModal = ({
  opened,
  loading,
  forceOverwrite,
  tableOptions,
  selectedTable,
  onSelectTable,
  changeTypeOptions,
  changeType,
  onChangeType,
  rowOptions,
  selectedRow,
  onSelectRow,
  entry,
  rowData,
  onClose,
  onConfirm,
}: RestorePreviewModalProps) => (
  <Modal
    opened={opened}
    onClose={onClose}
    title="Review rows before restoring"
    size="xl"
    radius="md"
    trapFocus={false}
  >
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Use the cascading selectors below to inspect the exact rows and columns
        that will be restored before continuing to the confirmation dialog.
      </Text>

      <Select
        label="1. Table"
        placeholder="Select a table"
        data={tableOptions}
        value={selectedTable}
        onChange={onSelectTable}
        searchable
      />

      <Group align="flex-end" gap="md">
        <Select
          flex={1}
          label="2. Change type"
          placeholder="Select change type"
          data={changeTypeOptions}
          value={changeType}
          onChange={(value) =>
            onChangeType((value as 'insert' | 'update') || 'insert')
          }
          disabled={forceOverwrite || changeTypeOptions.length <= 1}
        />

        <Select
          flex={1}
          label="3. Row"
          placeholder={
            rowOptions.length ? 'Select a row' : 'No rows to preview'
          }
          data={rowOptions}
          value={selectedRow}
          onChange={onSelectRow}
          searchable
          disabled={!rowOptions.length}
        />
      </Group>

      {entry && (
        <Stack gap="xs">
          <Group gap="xs">
            <Badge color="blue">{entry.inserts.length} new</Badge>
            {!forceOverwrite && (
              <Badge color="orange">{entry.updates.length} updated</Badge>
            )}
            <Badge color="gray">{entry.skipped ?? 0} skipped</Badge>
            <Badge color="teal">{entry.attempted ?? 0} attempted</Badge>
          </Group>
          {entry.notice && (
            <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
              {entry.notice}
            </Alert>
          )}
          {forceOverwrite && !!entry.deletedCount && (
            <Alert color="red" icon={<IconAlertCircle size={16} />}>
              {entry.deletedCount} {entry.deletedCount === 1 ? 'row' : 'rows'}{' '}
              will be deleted before reinserting this backup because force
              overwrite is enabled.
            </Alert>
          )}
        </Stack>
      )}

      <Card withBorder padding="md" radius="md">
        {rowData?.row ? (
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <div>
                <Text fw={600}>
                  {rowData.type === 'insert'
                    ? 'New row preview'
                    : 'Updated row preview'}
                </Text>
                {rowData.type === 'update' && rowData.row && (
                  <Text size="sm" c="dimmed">
                    {guessRowLabel(rowData.row.incoming ?? {}, 'Selected row')}
                  </Text>
                )}
              </div>
              {rowData.type === 'update' && rowData.row?.id !== undefined && (
                <Badge color="gray">ID {String(rowData.row.id)}</Badge>
              )}
            </Group>

            <ScrollArea h={320} offsetScrollbars scrollbarSize={6}>
              {rowData.type === 'insert' ? (
                <MantineTable striped highlightOnHover>
                  <MantineTable.Thead>
                    <MantineTable.Tr>
                      <MantineTable.Th>Column</MantineTable.Th>
                      <MantineTable.Th>Value</MantineTable.Th>
                    </MantineTable.Tr>
                  </MantineTable.Thead>
                  <MantineTable.Tbody>
                    {Object.entries(rowData.row ?? {}).map(
                      ([column, value]) => (
                        <MantineTable.Tr key={column}>
                          <MantineTable.Td>
                            <Text size="sm" fw={600}>
                              {column}
                            </Text>
                          </MantineTable.Td>
                          <MantineTable.Td>
                            {renderPreviewValue(value)}
                          </MantineTable.Td>
                        </MantineTable.Tr>
                      )
                    )}
                  </MantineTable.Tbody>
                </MantineTable>
              ) : (
                <MantineTable striped highlightOnHover>
                  <MantineTable.Thead>
                    <MantineTable.Tr>
                      <MantineTable.Th>Column</MantineTable.Th>
                      <MantineTable.Th>Before</MantineTable.Th>
                      <MantineTable.Th>After</MantineTable.Th>
                    </MantineTable.Tr>
                  </MantineTable.Thead>
                  <MantineTable.Tbody>
                    {Object.entries(rowData.row?.changes ?? {}).map(
                      ([column, diff]) => (
                        <MantineTable.Tr key={column}>
                          <MantineTable.Td>
                            <Text size="sm" fw={600}>
                              {column}
                            </Text>
                          </MantineTable.Td>
                          <MantineTable.Td>
                            {renderPreviewValue(diff.before)}
                          </MantineTable.Td>
                          <MantineTable.Td>
                            {renderPreviewValue(diff.after)}
                          </MantineTable.Td>
                        </MantineTable.Tr>
                      )
                    )}
                  </MantineTable.Tbody>
                </MantineTable>
              )}
            </ScrollArea>
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            Select a table, change type, and row to preview what will be
            restored.
          </Text>
        )}
      </Card>

      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Only the rows listed above will be changed. Unchecked tables remain
          untouched.
        </Text>
        <Group>
          <Button variant="default" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            leftSection={<IconHistory size={16} />}
            onClick={onConfirm}
            loading={loading}
          >
            Continue to confirmation
          </Button>
        </Group>
      </Group>
    </Stack>
  </Modal>
);
