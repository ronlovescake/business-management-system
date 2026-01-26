import { memo, useMemo } from 'react';
import {
  Alert,
  Badge,
  Box,
  Card,
  Group,
  ScrollArea,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import {
  StandardDataTable,
  StandardTableContainer,
} from '@/components/tables/StandardDataTable';
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
  searchQuery?: string;
  height?: number | string;
  showTableList?: boolean;
}

export const BackupTablesBrowser = memo(
  ({
    previewData,
    selectedTableName,
    selectedTableDetails,
    onSelectTable,
    searchQuery = '',
    height = 'calc(83vh - 220px)',
    showTableList = true,
  }: BackupTablesBrowserProps) => {
    const tableHeight = typeof height === 'number' ? `${height}px` : height;
    const tableEntries = useMemo(
      () => Object.entries(previewData?.tables ?? {}),
      [previewData]
    );
    const filteredRows = useMemo(() => {
      if (!selectedTableDetails?.data) {
        return [];
      }

      const query = searchQuery.trim().toLowerCase();
      if (!query) {
        return selectedTableDetails.data;
      }

      return selectedTableDetails.data.filter((row) =>
        selectedTableDetails.columns.some((column) => {
          const value = row[column];
          if (value === null || value === undefined) {
            return false;
          }
          return String(value).toLowerCase().includes(query);
        })
      );
    }, [searchQuery, selectedTableDetails]);

    if (!previewData) {
      return (
        <Alert icon={<IconAlertCircle size={16} />} color="yellow">
          Preview a backup to explore its tables.
        </Alert>
      );
    }

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
            <StandardTableContainer>
              <Box style={{ flex: 1, minHeight: 0, overflowX: 'auto' }}>
                <div
                  style={{
                    minWidth: Math.max(
                      selectedTableDetails.columns.length * 160,
                      600
                    ),
                  }}
                >
                  <StandardDataTable
                    headers={selectedTableDetails.columns}
                    height={tableHeight}
                    emptyState={
                      searchQuery
                        ? 'No matching rows for this search.'
                        : 'No data available for this table.'
                    }
                  >
                    {filteredRows.length
                      ? filteredRows.map((row) => {
                          const rowKey = createRowKey(
                            selectedTableDetails.name,
                            row
                          );

                          return (
                            <Table.Tr key={rowKey}>
                              {selectedTableDetails.columns.map((column) => (
                                <Table.Td key={createCellKey(rowKey, column)}>
                                  <Text size="sm">
                                    {formatCellValue(row[column])}
                                  </Text>
                                </Table.Td>
                              ))}
                            </Table.Tr>
                          );
                        })
                      : null}
                  </StandardDataTable>
                </div>
              </Box>
            </StandardTableContainer>
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
