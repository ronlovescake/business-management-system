import { memo } from 'react';
import {
  Alert,
  Badge,
  Box,
  Card,
  Group,
  ScrollArea,
  Stack,
  Table as MantineTable,
  Text,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { BackupData } from '../../backup/types';
import {
  createCellKey,
  createRowKey,
  formatCellValue,
} from '../../backup/types';

type TableDetails = {
  name: string;
  count: number;
  data: Array<Record<string, unknown>>;
  columns: string[];
} | null;

interface BackupTablesBrowserProps {
  previewData: BackupData | null;
  selectedTableName: string | null;
  selectedTableDetails: TableDetails;
  onSelectTable: (table: string) => void | Promise<void>;
  height?: number | string;
  showTableList?: boolean;
}

export const BackupTablesBrowser = memo(
  ({
    previewData,
    selectedTableName,
    selectedTableDetails,
    onSelectTable,
    height = 'calc(83vh - 220px)',
    showTableList = true,
  }: BackupTablesBrowserProps) => {
    if (!previewData) {
      return (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          Preview a backup to explore its tables.
        </Alert>
      );
    }

    const tableEntries = Object.entries(previewData.tables ?? {});
    if (!tableEntries.length) {
      return (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          This backup did not include table data.
        </Alert>
      );
    }

    return (
      <Box
        style={{
          height,
          display: 'flex',
          gap: 'var(--mantine-spacing-md)',
        }}
      >
        {showTableList && (
          <Box style={{ width: 240, height: '100%' }}>
            <ScrollArea
              style={{ height: '100%' }}
              offsetScrollbars
              scrollbarSize={6}
            >
              <Stack gap="xs">
                {tableEntries.map(([name, data]) => {
                  const isActive = name === selectedTableName;

                  return (
                    <Card
                      key={name}
                      withBorder
                      padding="sm"
                      radius="sm"
                      shadow={isActive ? 'sm' : 'xs'}
                      onClick={() => void onSelectTable(name)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isActive ? '#edf2ff' : undefined,
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
                          {data.count} {data.count === 1 ? 'record' : 'records'}
                        </Badge>
                      </Group>
                    </Card>
                  );
                })}
              </Stack>
            </ScrollArea>
          </Box>
        )}

        <Stack gap="md" style={{ flex: 1, minWidth: 0, height: '100%' }}>
          {selectedTableDetails ? (
            selectedTableDetails.data.length ? (
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
                    <MantineTable striped highlightOnHover stickyHeader>
                      <MantineTable.Thead>
                        <MantineTable.Tr>
                          {selectedTableDetails.columns.map((column) => (
                            <MantineTable.Th
                              key={`${selectedTableDetails.name}-${column}`}
                              style={{
                                backgroundColor: 'var(--mantine-color-body)',
                                position: 'sticky',
                                top: 0,
                                zIndex: 1,
                              }}
                            >
                              {column}
                            </MantineTable.Th>
                          ))}
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
                              {selectedTableDetails.columns.map((column) => (
                                <MantineTable.Td
                                  key={createCellKey(rowKey, column)}
                                >
                                  <Text size="sm">
                                    {formatCellValue(row[column])}
                                  </Text>
                                </MantineTable.Td>
                              ))}
                            </MantineTable.Tr>
                          );
                        })}
                      </MantineTable.Tbody>
                    </MantineTable>
                  </div>
                </ScrollArea>
              </Box>
            ) : (
              <Alert icon={<IconAlertCircle size={16} />} color="gray">
                <Text size="sm" c="dimmed">
                  No data available for this table.
                </Text>
              </Alert>
            )
          ) : (
            <Alert icon={<IconAlertCircle size={16} />} color="blue">
              <Text size="sm">Select a table to view its full backup.</Text>
            </Alert>
          )}
        </Stack>
      </Box>
    );
  }
);

BackupTablesBrowser.displayName = 'BackupTablesBrowser';
