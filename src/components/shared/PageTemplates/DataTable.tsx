import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Stack,
  Card,
  Box,
  Table,
  Text,
  Group,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { getIconButtonLabel } from '@/lib/accessibility';

export interface TableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (item: T) => ReactNode;
}

export interface TableAction<T = Record<string, unknown>> {
  icon: ReactNode;
  label: string;
  color?: string;
  onClick: (item: T) => void;
  show?: (item: T) => boolean;
  disabled?: boolean | ((item: T) => boolean);
}

interface DataTableProps<T = Record<string, unknown>> {
  data: T[];
  columns: TableColumn<T>[];
  actions?: TableAction<T>[];
  emptyMessage?: string;
  showFooter?: boolean;
  footerContent?: ReactNode;
  height?: string;
  showSummary?: boolean;
  summaryLeft?: ReactNode;
  summaryRight?: ReactNode;
  onRowDoubleClick?: (item: T) => void;
  onColumnWidthsChange?: (widths: number[]) => void;
}

/**
 * DataTable Component
 *
 * Reusable data table with consistent styling across all pages.
 * Matches the exact styling from Expenses page.
 *
 * @example
 * ```tsx
 * const columns = [
 *   { key: 'date', label: 'DATE', render: (item) => formatDate(item.date) },
 *   { key: 'amount', label: 'AMOUNT', render: (item) => formatCurrency(item.amount) },
 * ];
 *
 * const actions = [
 *   { icon: <IconEdit />, label: 'Edit', onClick: handleEdit },
 *   { icon: <IconTrash />, label: 'Delete', color: 'red', onClick: handleDelete },
 * ];
 *
 * <DataTable
 *   data={items}
 *   columns={columns}
 *   actions={actions}
 *   emptyMessage="No data found"
 * />
 * ```
 */
export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  actions = [],
  emptyMessage = 'No data found',
  showFooter = false,
  footerContent,
  height = '71vh',
  showSummary = false,
  summaryLeft,
  summaryRight,
  onRowDoubleClick,
  onColumnWidthsChange,
}: DataTableProps<T>) {
  const headerRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  headerRefs.current.length = columns.length + (actions.length > 0 ? 1 : 0);

  const measureColumnWidths = useCallback(() => {
    if (!onColumnWidthsChange) {
      return;
    }

    const widths = headerRefs.current.map((cell) =>
      cell ? Math.round(cell.getBoundingClientRect().width) : 0
    );

    onColumnWidthsChange(widths);
  }, [onColumnWidthsChange]);

  useEffect(() => {
    measureColumnWidths();
  }, [measureColumnWidths, columns.length, data.length, actions.length]);

  useEffect(() => {
    if (!onColumnWidthsChange) {
      return;
    }

    const handleResize = () => measureColumnWidths();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [measureColumnWidths, onColumnWidthsChange]);

  const renderSummaryLeft =
    summaryLeft !== undefined ? (
      summaryLeft
    ) : (
      <Text size="sm" c="dimmed">
        Showing {data.length} records
      </Text>
    );

  return (
    <Stack gap="md">
      <Card withBorder padding={0} style={{ overflow: 'hidden', height }}>
        <Box
          style={{
            height: '100%',
            overflowY: 'auto',
            position: 'relative',
          }}
        >
          <Table highlightOnHover withTableBorder>
            <Table.Thead
              style={{
                backgroundColor: '#f1f3f5',
                position: 'sticky',
                top: 0,
                zIndex: 2,
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
              }}
            >
              <Table.Tr>
                {columns.map((column, index) => (
                  <Table.Th
                    key={column.key}
                    style={{
                      padding: '16px 12px',
                      color: '#495057',
                      backgroundColor: '#f1f3f5',
                      textAlign: column.align || 'center',
                      width: column.width,
                    }}
                    ref={(element) => {
                      headerRefs.current[index] = element;
                    }}
                  >
                    {column.label}
                  </Table.Th>
                ))}
                {actions.length > 0 && (
                  <Table.Th
                    style={{
                      padding: '16px 12px',
                      color: '#495057',
                      backgroundColor: '#f1f3f5',
                      textAlign: 'center',
                    }}
                    ref={(element) => {
                      headerRefs.current[columns.length] = element;
                    }}
                  >
                    ACTION
                  </Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.length === 0 ? (
                <Table.Tr>
                  <Table.Td
                    colSpan={columns.length + (actions.length > 0 ? 1 : 0)}
                    style={{ textAlign: 'center', padding: '2rem' }}
                  >
                    <Text c="dimmed">{emptyMessage}</Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                data.map((item) => (
                  <Table.Tr
                    key={item.id}
                    onDoubleClick={() =>
                      onRowDoubleClick && onRowDoubleClick(item)
                    }
                    style={onRowDoubleClick ? { cursor: 'pointer' } : undefined}
                  >
                    {columns.map((column) => (
                      <Table.Td
                        key={column.key}
                        style={{
                          padding: '12px',
                          textAlign: column.align || 'center',
                        }}
                      >
                        {column.render
                          ? column.render(item)
                          : String(
                              (item as Record<string, unknown>)[column.key] ||
                                ''
                            )}
                      </Table.Td>
                    ))}
                    {actions.length > 0 && (
                      <Table.Td
                        style={{ padding: '12px', textAlign: 'center' }}
                      >
                        <Group gap="xs" justify="center">
                          {actions.map((action) => {
                            const shouldShow = action.show
                              ? action.show(item)
                              : true;
                            if (!shouldShow) {
                              return null;
                            }

                            const isDisabled =
                              typeof action.disabled === 'function'
                                ? action.disabled(item)
                                : Boolean(action.disabled);

                            const iconColor = isDisabled
                              ? 'gray'
                              : action.color || 'gray';

                            return (
                              <Tooltip
                                key={`action-${action.label}`}
                                label={action.label}
                              >
                                <ActionIcon
                                  variant="subtle"
                                  color={iconColor}
                                  disabled={isDisabled}
                                  onClick={() =>
                                    !isDisabled && action.onClick(item)
                                  }
                                  size="sm"
                                  {...getIconButtonLabel(action.label)}
                                >
                                  {action.icon}
                                </ActionIcon>
                              </Tooltip>
                            );
                          })}
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
            {showFooter && footerContent && (
              <Table.Tfoot>
                <Table.Tr>{footerContent}</Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </Box>
      </Card>

      {/* Summary Bar - Like Expenses Page */}
      {showSummary && (
        <Card withBorder padding="md">
          <Group justify="space-between">
            {renderSummaryLeft}
            {summaryRight}
          </Group>
        </Card>
      )}
    </Stack>
  );
}
