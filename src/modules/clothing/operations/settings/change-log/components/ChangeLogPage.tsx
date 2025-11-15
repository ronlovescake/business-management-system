'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Stack, Group, Text, Badge, Tooltip, Loader, Alert, Table, Accordion, Box, Divider, Paper } from '@mantine/core';
import { IconAlertCircle, IconChevronRight } from '@tabler/icons-react';
import { StandardTableContainer } from '@/components/tables/StandardDataTable';
import { useChangeLogQuery, type ChangeLogRecord } from '../hooks/useChangeLogQuery';

const ACTION_COLOR_MAP: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  import: 'orange',
  export: 'grape',
  restore: 'teal',
};

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const CUSTOMER_METADATA_KEYS = [
  'customerName',
  'customer',
  'customerFullName',
  'customer_full_name',
  'customerDisplayName',
  'customer_name',
];

const PRODUCT_METADATA_KEYS = [
  'productCode',
  'product_code',
  'sku',
  'itemCode',
  'item_code',
];

const SUMMARY_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const SUMMARY_TIME_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const SUMMARY_GRID_TEMPLATE =
  'minmax(280px, 2fr) 200px minmax(180px, 1fr) 120px';

const TRANSACTION_FIELD_KEYS = [
  'orderDate',
  'customers',
  'productCode',
  'quantity',
  'unitPrice',
  'discount',
  'adjustment',
  'lineTotal',
  'orderStatus',
  'notes',
  'invoiceDate',
  'packedDate',
  'shipmentCode',
] as const;

type TransactionFieldKey = (typeof TRANSACTION_FIELD_KEYS)[number];

const CHANGED_CELL_STYLE: CSSProperties = {
  backgroundColor: 'rgba(59, 130, 246, 0.12)',
  boxShadow: 'inset 0 0 0 1px rgba(37, 99, 235, 0.35)',
  borderRadius: 6,
  transition: 'background-color 120ms ease, box-shadow 120ms ease',
};

const DEFAULT_LIMIT = 250;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizePrimitive(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'bigint') {
    return value.toString();
  }

  return null;
}

function extractFromObject(
  record: Record<string, unknown>,
  keys: string[],
  depth = 0
): string | null {
  if (depth > 3) {
    return null;
  }

  for (const key of keys) {
    if (key in record) {
      const value = record[key];
      const normalized = normalizePrimitive(value);
      if (normalized) {
        return normalized;
      }

      if (isRecord(value)) {
        const nested = extractFromObject(value, keys, depth + 1);
        if (nested) {
          return nested;
        }
      }
    }
  }

  for (const value of Object.values(record)) {
    if (isRecord(value)) {
      const nested = extractFromObject(value, keys, depth + 1);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

function resolveDetail(value: unknown, keys: string[]): string | null {
  const direct = normalizePrimitive(value);
  if (direct) {
    return direct;
  }

  if (isRecord(value)) {
    return extractFromObject(value, keys);
  }

  return null;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  // Format with date, time, and milliseconds
  const formatted = TIMESTAMP_FORMATTER.format(date);
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
  return `${formatted}.${milliseconds}`;
}

function formatLogValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }

  if (typeof value === 'string') {
    return value.length === 0 ? '∅ (empty string)' : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Date) {
    return TIMESTAMP_FORMATTER.format(value);
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function truncateValue(value: string, maxLength = 120): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}…`;
}

function normalizeComparisonValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function getChangedTransactionFields(
  newRecord: Record<string, unknown>,
  previousValue: unknown
): Set<TransactionFieldKey> {
  const changed = new Set<TransactionFieldKey>();
  const previousRecord = isRecord(previousValue)
    ? (previousValue as Record<string, unknown>)
    : null;

  for (const field of TRANSACTION_FIELD_KEYS) {
    const nextValue = normalizeComparisonValue(newRecord[field]);
    if (previousRecord) {
      const prevValue = normalizeComparisonValue(previousRecord[field]);
      if (prevValue !== nextValue) {
        changed.add(field);
      }
    } else if (nextValue !== '') {
      changed.add(field);
    }
  }

  return changed;
}

interface ValueCellProps {
  value: unknown;
}

function ValueCell({ value }: ValueCellProps) {
  const formatted = formatLogValue(value);
  const truncated = truncateValue(formatted);
  const showTooltip = formatted !== truncated;

  return (
    <Tooltip
      label={formatted}
      withArrow
      disabled={!showTooltip}
      maw={360}
      multiline
    >
      <Text size="sm" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
        {showTooltip ? truncated : formatted}
      </Text>
    </Tooltip>
  );
}

export interface ChangeLogPageProps {
  /**
   * When true, hides the top-level search and filter controls, showing only the table.
   * Useful when embedding the Change Log inside another page that already has its own filters.
   */
  hideFilters?: boolean;

  /**
   * Optional external search query (e.g. from /clothing/operations/settings).
   * When provided, this value is used for filtering the logs instead of the internal search box.
   */
  externalSearch?: string;
}

export function ChangeLogPage({
  hideFilters: _hideFilters = false,
  externalSearch,
}: ChangeLogPageProps) {
  const [limit, setLimit] = useState(DEFAULT_LIMIT.toString());

  const queryParams = useMemo(
    () => ({
      page: 1,
      limit: Number(limit),
      search: externalSearch?.trim() || undefined,
    }),
    [limit, externalSearch]
  );

  const { data, isLoading, error } = useChangeLogQuery(queryParams);
  const logs = useMemo(() => data?.logs ?? [], [data]);
  const pagination = data?.pagination;
  const totalRecords = pagination?.total;

  useEffect(() => {
    if (!totalRecords) {
      return;
    }

    if (totalRecords !== Number(limit)) {
      setLimit(totalRecords.toString());
    }
  }, [totalRecords, limit]);

  const emptyState = isLoading ? (
    <Group justify="center" py="lg">
      <Loader size="sm" />
    </Group>
  ) : (
    'No change log entries found for the selected filters'
  );

  const groupedLogs = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        entityType: string;
        entityId: string;
        entries: ChangeLogRecord[];
        latestCreatedAt: string;
        customerName?: string;
        productCode?: string;
        quantity?: number;
      }
    >();

    for (const log of logs) {
      const entityType = log.entityType || 'Unknown Entity';
      const entityId = log.entityId || '—';
      const key = `${entityType}::${entityId}`;
      let groupRef = groups.get(key);

      if (groupRef) {
        groupRef.entries.push(log);
        if (new Date(log.createdAt) > new Date(groupRef.latestCreatedAt)) {
          groupRef.latestCreatedAt = log.createdAt;
        }
      } else {
        groupRef = {
          key,
          entityType,
          entityId,
          entries: [log],
          latestCreatedAt: log.createdAt,
        };
        groups.set(key, groupRef);
      }
    }

    // After grouping, extract customer, product, and quantity from the LATEST entry
    Array.from(groups.values()).forEach((groupRef) => {
      if (groupRef.entityType.toLowerCase() === 'transaction') {
        // Sort entries by createdAt descending (newest first)
        const sortedEntries = [...groupRef.entries].sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        // Get the latest entry
        const latestEntry = sortedEntries[0];

        if (latestEntry) {
          const metadataRecord = isRecord(latestEntry.metadata)
            ? latestEntry.metadata
            : undefined;
          const fieldName = (latestEntry.field ?? '').toLowerCase();
          const fieldIsCustomer = fieldName.includes('customer');
          const fieldIsProduct =
            fieldName.includes('product') ||
            fieldName.includes('sku') ||
            fieldName.includes('item');

          // Extract customer from latest entry
          const customerFromMetadata = metadataRecord
            ? extractFromObject(metadataRecord, CUSTOMER_METADATA_KEYS)
            : null;
          const customerFromField = fieldIsCustomer
            ? (resolveDetail(latestEntry.newValue, CUSTOMER_METADATA_KEYS) ??
              resolveDetail(latestEntry.oldValue, CUSTOMER_METADATA_KEYS))
            : null;

          // Try to extract from newValue if it's a transaction object
          let customerFromTransaction = null;
          if (
            latestEntry.newValue &&
            typeof latestEntry.newValue === 'object'
          ) {
            const newTx = latestEntry.newValue as Record<string, unknown>;
            if ('customers' in newTx) {
              customerFromTransaction = String(newTx.customers || '');
            }
          }

          const customerCandidate =
            customerFromTransaction ||
            customerFromMetadata ||
            customerFromField;
          if (customerCandidate) {
            groupRef.customerName = customerCandidate;
          }

          // Extract product code from latest entry
          const productFromMetadata = metadataRecord
            ? extractFromObject(metadataRecord, PRODUCT_METADATA_KEYS)
            : null;
          const productFromField = fieldIsProduct
            ? (resolveDetail(latestEntry.newValue, PRODUCT_METADATA_KEYS) ??
              resolveDetail(latestEntry.oldValue, PRODUCT_METADATA_KEYS))
            : null;

          // Try to extract from newValue if it's a transaction object
          let productFromTransaction = null;
          if (
            latestEntry.newValue &&
            typeof latestEntry.newValue === 'object'
          ) {
            const newTx = latestEntry.newValue as Record<string, unknown>;
            if ('productCode' in newTx) {
              productFromTransaction = String(newTx.productCode || '');
            }
          }

          const productCandidate =
            productFromTransaction || productFromMetadata || productFromField;
          if (productCandidate) {
            groupRef.productCode = productCandidate;
          }

          // Extract quantity from latest entry
          if (
            latestEntry.newValue &&
            typeof latestEntry.newValue === 'object'
          ) {
            const newTx = latestEntry.newValue as Record<string, unknown>;
            if ('quantity' in newTx) {
              const qty = newTx.quantity;
              if (typeof qty === 'number') {
                groupRef.quantity = qty;
              }
            }
          }
        }
      }
    });

    return Array.from(groups.values()).sort(
      (a, b) =>
        new Date(b.latestCreatedAt).getTime() -
        new Date(a.latestCreatedAt).getTime()
    );
  }, [logs]);

  return (
    <Stack gap="lg">
      {error && (
        <Alert color="red" icon={<IconAlertCircle size={20} />} title="Error">
          {error instanceof Error
            ? error.message
            : 'Unable to load change logs'}
        </Alert>
      )}

      <StandardTableContainer>
        {isLoading ? (
          <Group justify="center" py="lg">
            <Loader size="sm" />
          </Group>
        ) : logs.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="lg">
            {emptyState}
          </Text>
        ) : (
          <Paper
            withBorder
            radius="lg"
            shadow="sm"
            p={0}
            style={{
              height: '88vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Box
              px="lg"
              py="sm"
              style={{
                display: 'grid',
                gridTemplateColumns: SUMMARY_GRID_TEMPLATE,
                alignItems: 'center',
                textTransform: 'uppercase',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'rgba(17, 24, 39, 0.6)',
                letterSpacing: '0.05em',
              }}
            >
              <Text fw={600} size="xs">
                Details
              </Text>
              <Text fw={600} size="xs">
                Date / Time
              </Text>
              <Text fw={600} size="xs">
                User
              </Text>
              <Text fw={600} size="xs">
                Changes
              </Text>
            </Box>
            <Divider />
            <Box style={{ flex: 1, overflowY: 'auto' }}>
              <Accordion
                multiple
                radius="sm"
                chevronPosition="right"
                chevron={<IconChevronRight size={16} />}
                disableChevronRotation
                styles={(theme) => ({
                  root: {
                    backgroundColor: theme.white,
                  },
                  item: {
                    border: 'none',
                    borderRadius: 0,
                    '& + &': {
                      borderTop: `1px solid ${theme.colors.gray[3]}`,
                    },
                  },
                  control: {
                    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                    backgroundColor: theme.white,
                    '&[data-active]': {
                      backgroundColor: theme.colors.gray[0],
                    },
                  },
                  chevron: {
                    marginLeft: theme.spacing.md,
                  },
                  content: {
                    padding: `${theme.spacing.sm} ${theme.spacing.lg} ${theme.spacing.lg}`,
                    backgroundColor: theme.white,
                  },
                })}
              >
                {groupedLogs.map((group) => {
                  // Sort NEWEST first (at top), OLDEST last (at bottom) - DESCENDING order
                  const sortedEntries = [...group.entries].sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  );
                  const latestDate = new Date(group.latestCreatedAt);
                  const latestEntry = sortedEntries[0];

                  return (
                    <Accordion.Item key={group.key} value={group.key}>
                      <Accordion.Control>
                        <Box
                          style={{
                            display: 'grid',
                            gridTemplateColumns: SUMMARY_GRID_TEMPLATE,
                            alignItems: 'center',
                            gap: 12,
                            width: '100%',
                          }}
                        >
                          <Stack gap={4}>
                            <Text size="sm" fw={600} tt="capitalize">
                              {group.entityType} · ID: {group.entityId}
                            </Text>
                            {group.customerName && (
                              <Text size="sm" fw={500} c="dark">
                                {group.customerName}
                              </Text>
                            )}
                            {group.productCode && (
                              <Text size="sm" c="dimmed" fs="italic">
                                {group.productCode}
                              </Text>
                            )}
                          </Stack>
                          <Text size="sm" fw={500}>
                            {SUMMARY_DATE_FORMATTER.format(latestDate)} ·{' '}
                            {SUMMARY_TIME_FORMATTER.format(latestDate)}
                          </Text>
                          <Stack gap={2}>
                            <Text size="sm" fw={500}>
                              {latestEntry?.userName || 'System'}
                            </Text>
                            {latestEntry?.userId && (
                              <Text size="xs" c="dimmed">
                                {latestEntry.userId}
                              </Text>
                            )}
                          </Stack>
                          <Badge
                            color="blue"
                            variant="light"
                            radius="xl"
                            size="md"
                            fw={600}
                            tt="uppercase"
                          >
                            {group.entries.length} change
                            {group.entries.length === 1 ? '' : 's'}
                          </Badge>
                        </Box>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Divider mb="md" variant="dashed" />
                        <Box style={{ overflowX: 'auto' }}>
                          <Table
                            horizontalSpacing="md"
                            verticalSpacing="sm"
                            striped
                            highlightOnHover
                          >
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>TIMESTAMP</Table.Th>
                                <Table.Th>USER</Table.Th>
                                <Table.Th>ORDER DATE</Table.Th>
                                <Table.Th>CUSTOMERS</Table.Th>
                                <Table.Th>PRODUCT CODE</Table.Th>
                                <Table.Th>QUANTITY</Table.Th>
                                <Table.Th>UNIT PRICE</Table.Th>
                                <Table.Th>DISCOUNT</Table.Th>
                                <Table.Th>ADJUSTMENT</Table.Th>
                                <Table.Th>LINE TOTAL</Table.Th>
                                <Table.Th>ORDER STATUS</Table.Th>
                                <Table.Th>NOTES</Table.Th>
                                <Table.Th>INVOICE DATE</Table.Th>
                                <Table.Th>PACKED DATE</Table.Th>
                                <Table.Th>SHIPMENT CODE</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {sortedEntries.map((log) => {
                                // Check if oldValue and newValue are transaction objects
                                const isTransactionRecord =
                                  log.newValue &&
                                  typeof log.newValue === 'object' &&
                                  'orderDate' in log.newValue;

                                if (isTransactionRecord) {
                                  // Only show the NEW values (after the change)
                                  // Users can compare with the previous row to see what changed
                                  const newTx = log.newValue as Record<
                                    string,
                                    unknown
                                  >;
                                  const changedFields = getChangedTransactionFields(
                                    newTx,
                                    log.oldValue
                                  );

                                  const highlightCell = (
                                    field: TransactionFieldKey
                                  ) =>
                                    changedFields.has(field)
                                      ? CHANGED_CELL_STYLE
                                      : undefined;

                                  // Helper to format cell values: show blank for 0, empty, null, or undefined
                                  const formatCell = (
                                    value: unknown
                                  ): string => {
                                    if (
                                      value === null ||
                                      value === undefined ||
                                      value === '' ||
                                      value === 0 ||
                                      value === '0'
                                    ) {
                                      return '';
                                    }
                                    return String(value);
                                  };

                                  return (
                                    <Table.Tr key={log.id}>
                                      <Table.Td>
                                        <Text size="sm" fw={500} c="dark">
                                          {formatTimestamp(log.createdAt)}
                                        </Text>
                                      </Table.Td>
                                      <Table.Td>
                                        <Stack gap={2}>
                                          <Text size="sm" fw={500}>
                                            {log.userName || 'System'}
                                          </Text>
                                          {log.userId && (
                                            <Text size="xs" c="dimmed">
                                              {log.userId}
                                            </Text>
                                          )}
                                        </Stack>
                                      </Table.Td>
                                      <Table.Td style={highlightCell('orderDate')}>
                                        {formatCell(newTx.orderDate)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('customers')}>
                                        {formatCell(newTx.customers)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('productCode')}>
                                        {formatCell(newTx.productCode)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('quantity')}>
                                        {formatCell(newTx.quantity)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('unitPrice')}>
                                        {formatCell(newTx.unitPrice)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('discount')}>
                                        {formatCell(newTx.discount)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('adjustment')}>
                                        {formatCell(newTx.adjustment)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('lineTotal')}>
                                        {formatCell(newTx.lineTotal)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('orderStatus')}>
                                        {formatCell(newTx.orderStatus)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('notes')}>
                                        {formatCell(newTx.notes)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('invoiceDate')}>
                                        {formatCell(newTx.invoiceDate)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('packedDate')}>
                                        {formatCell(newTx.packedDate)}
                                      </Table.Td>
                                      <Table.Td style={highlightCell('shipmentCode')}>
                                        {formatCell(newTx.shipmentCode)}
                                      </Table.Td>
                                    </Table.Tr>
                                  );
                                }

                                // Fall back to old rendering for non-transaction logs
                                const actionColor =
                                  ACTION_COLOR_MAP[log.action.toLowerCase()] ??
                                  'gray';

                                return (
                                  <Table.Tr key={log.id}>
                                    <Table.Td>
                                      <Text size="sm" fw={500} c="dark">
                                        {formatTimestamp(log.createdAt)}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td>
                                      <Stack gap={2}>
                                        <Text size="sm" fw={500}>
                                          {log.userName || 'System'}
                                        </Text>
                                        {log.userId && (
                                          <Text size="xs" c="dimmed">
                                            {log.userId}
                                          </Text>
                                        )}
                                      </Stack>
                                    </Table.Td>
                                    <Table.Td>
                                      <Text size="sm" c="dimmed">
                                        {log.source || '—'}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td>
                                      <Text size="sm" c="dark">
                                        {log.field || '—'}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td>
                                      <Badge
                                        color={actionColor}
                                        variant="light"
                                        radius="sm"
                                      >
                                        {log.action.toUpperCase()}
                                      </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                      <ValueCell value={log.oldValue} />
                                    </Table.Td>
                                    <Table.Td>
                                      <ValueCell value={log.newValue} />
                                    </Table.Td>
                                    <Table.Td>
                                      <ValueCell value={log.metadata} />
                                    </Table.Td>
                                  </Table.Tr>
                                );
                              })}
                            </Table.Tbody>
                          </Table>
                        </Box>
                      </Accordion.Panel>
                    </Accordion.Item>
                  );
                })}
              </Accordion>
            </Box>
          </Paper>
        )}
      </StandardTableContainer>
    </Stack>
  );
}
