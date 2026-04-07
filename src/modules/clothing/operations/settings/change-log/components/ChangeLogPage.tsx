'use client';

import React, { useMemo, useState, type CSSProperties } from 'react';
import {
  Stack,
  Group,
  Text,
  Badge,
  Tooltip,
  Loader,
  Alert,
  Table,
  Accordion,
  Box,
  Divider,
  Paper,
  Tabs,
  Button,
  Select,
  TextInput,
  SegmentedControl,
  ThemeIcon,
  Timeline,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconAlertCircle,
  IconChevronRight,
  IconArrowRight,
  IconTable,
  IconTimeline,
} from '@tabler/icons-react';
import { StandardTableContainer } from '@/components/tables/StandardDataTable';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import {
  useChangeLogQuery,
  type ChangeLogRecord,
} from '../hooks/useChangeLogQuery';

type PanelView = 'table' | 'timeline';

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

const GENERIC_TABLE_HEADERS = [
  'TIMESTAMP',
  'USER',
  'SOURCE',
  'FIELD',
  'ACTION',
  'PREVIOUS VALUE',
  'NEW VALUE',
  'METADATA',
] as const;

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

const DEFAULT_LIMIT = 200;

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

const TRANSACTION_FIELD_LABEL_MAP: Record<TransactionFieldKey, string> = {
  orderDate: 'Order Date',
  customers: 'Customer',
  productCode: 'Product Code',
  quantity: 'Quantity',
  unitPrice: 'Unit Price',
  discount: 'Discount',
  adjustment: 'Adjustment',
  lineTotal: 'Line Total',
  orderStatus: 'Order Status',
  notes: 'Notes',
  invoiceDate: 'Invoice Date',
  packedDate: 'Packed Date',
  shipmentCode: 'Shipment Code',
};

const TRANSACTION_HEADER_FOR_FIELD: Record<TransactionFieldKey, string> = {
  orderDate: 'ORDER DATE',
  customers: 'CUSTOMERS',
  productCode: 'PRODUCT CODE',
  quantity: 'QUANTITY',
  unitPrice: 'UNIT PRICE',
  discount: 'DISCOUNT',
  adjustment: 'ADJUSTMENT',
  lineTotal: 'LINE TOTAL',
  orderStatus: 'ORDER STATUS',
  notes: 'NOTES',
  invoiceDate: 'INVOICE DATE',
  packedDate: 'PACKED DATE',
  shipmentCode: 'SHIPMENT CODE',
};

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return TIMESTAMP_FORMATTER.format(date);
}

function formatTimestampFull(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
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

function getGroupChangedColumns(
  entries: ChangeLogRecord[]
): Set<TransactionFieldKey> {
  const allChanged = new Set<TransactionFieldKey>();
  for (const log of entries) {
    if (
      log.newValue &&
      typeof log.newValue === 'object' &&
      'orderDate' in log.newValue
    ) {
      const newTx = log.newValue as Record<string, unknown>;
      const fields = getChangedTransactionFields(newTx, log.oldValue);
      Array.from(fields).forEach((f) => allChanged.add(f));
    }
  }
  return allChanged;
}

function formatCellValue(value: unknown): string {
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
}

interface InlineDiffCellProps {
  field: TransactionFieldKey;
  newTx: Record<string, unknown>;
  oldTx: Record<string, unknown> | null;
  isChanged: boolean;
}

function InlineDiffCell({
  field,
  newTx,
  oldTx,
  isChanged,
}: InlineDiffCellProps) {
  const newVal = formatCellValue(newTx[field]);

  if (!isChanged) {
    return <>{newVal}</>;
  }

  const oldVal = oldTx ? formatCellValue(oldTx[field]) : '';

  if (!oldVal || oldVal === newVal) {
    return (
      <Text size="sm" fw={600} c="blue.7">
        {newVal || '(cleared)'}
      </Text>
    );
  }

  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" td="line-through">
        {oldVal}
      </Text>
      <Text size="sm" fw={600} c="blue.7">
        {newVal || '(cleared)'}
      </Text>
    </Stack>
  );
}

interface TimelineViewProps {
  entries: ChangeLogRecord[];
}

function TimelineView({ entries }: TimelineViewProps) {
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <Timeline active={0} bulletSize={24} lineWidth={2} color="blue">
      {sortedEntries.map((log) => {
        const isTransactionRecord =
          log.newValue &&
          typeof log.newValue === 'object' &&
          'orderDate' in log.newValue;
        const actionColor =
          ACTION_COLOR_MAP[log.action.toLowerCase()] ?? 'gray';
        const date = new Date(log.createdAt);

        if (isTransactionRecord) {
          const newTx = log.newValue as Record<string, unknown>;
          const changedFields = getChangedTransactionFields(
            newTx,
            log.oldValue
          );
          const oldTx = isRecord(log.oldValue)
            ? (log.oldValue as Record<string, unknown>)
            : null;

          if (changedFields.size === 0) {
            return (
              <Timeline.Item
                key={log.id}
                bullet={
                  <ThemeIcon
                    size={24}
                    variant="light"
                    color={actionColor}
                    radius="xl"
                  >
                    <IconArrowRight size={12} />
                  </ThemeIcon>
                }
              >
                <Group gap="xs" align="baseline" wrap="wrap">
                  <Text size="sm" fw={600}>
                    {SUMMARY_DATE_FORMATTER.format(date)} ·{' '}
                    {SUMMARY_TIME_FORMATTER.format(date)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {log.userName || 'System'}
                  </Text>
                </Group>
                <Text size="sm" c="dimmed" mt={4}>
                  {log.action} (no field changes detected)
                </Text>
              </Timeline.Item>
            );
          }

          return (
            <Timeline.Item
              key={log.id}
              bullet={
                <ThemeIcon
                  size={24}
                  variant="light"
                  color={actionColor}
                  radius="xl"
                >
                  <IconArrowRight size={12} />
                </ThemeIcon>
              }
            >
              <Group gap="xs" align="baseline" wrap="wrap">
                <Text size="sm" fw={600}>
                  {SUMMARY_DATE_FORMATTER.format(date)} ·{' '}
                  {SUMMARY_TIME_FORMATTER.format(date)}
                </Text>
                <Text size="xs" c="dimmed">
                  {log.userName || 'System'}
                </Text>
              </Group>
              <Stack gap={4} mt={4}>
                {Array.from(changedFields).map((field) => {
                  const oldVal = oldTx ? formatCellValue(oldTx[field]) : '';
                  const newVal = formatCellValue(newTx[field]);
                  const label = TRANSACTION_FIELD_LABEL_MAP[field];
                  return (
                    <Group key={field} gap={6} wrap="nowrap">
                      <Text
                        size="sm"
                        fw={500}
                        c="dark"
                        style={{ minWidth: 100 }}
                      >
                        {label}:
                      </Text>
                      {oldVal ? (
                        <>
                          <Text size="sm" c="dimmed" td="line-through">
                            {oldVal}
                          </Text>
                          <IconArrowRight
                            size={12}
                            color="var(--mantine-color-gray-5)"
                          />
                          <Text size="sm" fw={600} c="blue.7">
                            {newVal || '(cleared)'}
                          </Text>
                        </>
                      ) : (
                        <Text size="sm" fw={600} c="blue.7">
                          {newVal || '(cleared)'}
                        </Text>
                      )}
                    </Group>
                  );
                })}
              </Stack>
            </Timeline.Item>
          );
        }

        return (
          <Timeline.Item
            key={log.id}
            bullet={
              <ThemeIcon
                size={24}
                variant="light"
                color={actionColor}
                radius="xl"
              >
                <IconArrowRight size={12} />
              </ThemeIcon>
            }
          >
            <Group gap="xs" align="baseline" wrap="wrap">
              <Text size="sm" fw={600}>
                {SUMMARY_DATE_FORMATTER.format(date)} ·{' '}
                {SUMMARY_TIME_FORMATTER.format(date)}
              </Text>
              <Text size="xs" c="dimmed">
                {log.userName || 'System'}
              </Text>
              <Badge color={actionColor} variant="light" radius="sm" size="sm">
                {log.action.toUpperCase()}
              </Badge>
            </Group>
            {log.field && (
              <Group gap={6} mt={4} wrap="nowrap">
                <Text size="sm" fw={500} c="dark">
                  {log.field}:
                </Text>
                <Text size="sm" c="dimmed" td="line-through">
                  {formatLogValue(log.oldValue)}
                </Text>
                <IconArrowRight size={12} color="var(--mantine-color-gray-5)" />
                <Text size="sm" fw={600} c="blue.7">
                  {formatLogValue(log.newValue)}
                </Text>
              </Group>
            )}
          </Timeline.Item>
        );
      })}
    </Timeline>
  );
}

function formatDateBoundary(value: Date, boundary: 'start' | 'end'): string {
  const normalized = new Date(value);

  if (boundary === 'start') {
    normalized.setHours(0, 0, 0, 0);
  } else {
    normalized.setHours(23, 59, 59, 999);
  }

  return normalized.toISOString();
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

  /**
   * Optional external start date for embedded change-log filtering.
   */
  externalStartDate?: Date | null;

  /**
   * Optional external end date for embedded change-log filtering.
   */
  externalEndDate?: Date | null;

  /**
   * Optional API base path override (e.g. /api/general-merchandise).
   */
  apiBasePath?: string;
}

export function ChangeLogPage({
  hideFilters = false,
  externalSearch,
  externalStartDate,
  externalEndDate,
  apiBasePath,
}: ChangeLogPageProps) {
  const [activeTab, setActiveTab] = useState<string | null>('transactions');
  const [panelView, setPanelView] = useState<PanelView>('table');
  const [searchInput, setSearchInput] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [debouncedSearch] = useDebouncedValue(searchInput, 300);

  const effectiveSearch = hideFilters
    ? externalSearch?.trim() || undefined
    : debouncedSearch.trim() || undefined;
  const effectiveStartDate = hideFilters
    ? (externalStartDate ?? null)
    : startDate;
  const effectiveEndDate = hideFilters ? (externalEndDate ?? null) : endDate;
  const isDateRangeValid =
    !effectiveStartDate ||
    !effectiveEndDate ||
    effectiveEndDate >= effectiveStartDate;

  const queryParams = useMemo(
    () => ({
      page: 1,
      limit: DEFAULT_LIMIT,
      search: effectiveSearch,
      entityType: hideFilters ? undefined : entityTypeFilter || undefined,
      action: hideFilters ? undefined : actionFilter || undefined,
      source: hideFilters ? undefined : sourceFilter || undefined,
      startDate:
        isDateRangeValid && effectiveStartDate
          ? formatDateBoundary(effectiveStartDate, 'start')
          : undefined,
      endDate:
        isDateRangeValid && effectiveEndDate
          ? formatDateBoundary(effectiveEndDate, 'end')
          : undefined,
      includeFilters: !hideFilters,
    }),
    [
      actionFilter,
      effectiveEndDate,
      effectiveSearch,
      effectiveStartDate,
      entityTypeFilter,
      hideFilters,
      isDateRangeValid,
      sourceFilter,
    ]
  );

  const { data, isLoading, error } = useChangeLogQuery(
    queryParams,
    { enabled: isDateRangeValid },
    apiBasePath
  );
  const logs = useMemo(() => data?.logs ?? [], [data]);
  const totalRecords = data?.pagination?.total ?? 0;

  const entityTypeOptions = useMemo(
    () =>
      (data?.filters?.entityTypes ?? []).map((value) => ({
        value,
        label: value,
      })),
    [data?.filters?.entityTypes]
  );
  const actionOptions = useMemo(
    () =>
      (data?.filters?.actions ?? []).map((value) => ({
        value,
        label: value,
      })),
    [data?.filters?.actions]
  );
  const sourceOptions = useMemo(
    () =>
      (data?.filters?.sources ?? []).map((value) => ({
        value,
        label: value,
      })),
    [data?.filters?.sources]
  );

  const resetInternalFilters = () => {
    setSearchInput('');
    setEntityTypeFilter(null);
    setActionFilter(null);
    setSourceFilter(null);
    setStartDate(null);
    setEndDate(null);
  };

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

  const filteredGroupedLogs = useMemo(() => {
    if (!activeTab) {
      return groupedLogs;
    }
    return groupedLogs.filter((group) => {
      const isTransaction = group.entityType.toLowerCase() === 'transaction';
      return activeTab === 'transactions' ? isTransaction : !isTransaction;
    });
  }, [groupedLogs, activeTab]);

  return (
    <Stack gap="lg">
      {!hideFilters && (
        <Paper withBorder shadow="xs" p="md" radius="md">
          <Stack gap="sm">
            <Group gap="sm" align="flex-end" wrap="wrap">
              <TextInput
                label="Search"
                placeholder="Search customer, product, ID, notes, or values"
                value={searchInput}
                onChange={(event) => setSearchInput(event.currentTarget.value)}
                style={{ flex: 1, minWidth: 260 }}
              />
              <Select
                label="Entity"
                placeholder="All entities"
                data={entityTypeOptions}
                value={entityTypeFilter}
                onChange={setEntityTypeFilter}
                clearable
                w={180}
              />
              <Select
                label="Action"
                placeholder="All actions"
                data={actionOptions}
                value={actionFilter}
                onChange={setActionFilter}
                clearable
                w={160}
              />
              <Select
                label="Source"
                placeholder="All sources"
                data={sourceOptions}
                value={sourceFilter}
                onChange={setSourceFilter}
                clearable
                w={180}
              />
              <DateInput
                label="Start date"
                value={startDate}
                onChange={setStartDate}
                placeholder="Start date"
                clearable
                error={
                  isDateRangeValid ? undefined : 'Start must be before end'
                }
                {...COMMON_DATE_INPUT_PROPS}
              />
              <DateInput
                label="End date"
                value={endDate}
                onChange={setEndDate}
                placeholder="End date"
                clearable
                minDate={startDate ?? undefined}
                error={isDateRangeValid ? undefined : 'End must be after start'}
                {...COMMON_DATE_INPUT_PROPS}
              />
              <Button variant="light" onClick={resetInternalFilters}>
                Reset filters
              </Button>
            </Group>
            <Text size="sm" c="dimmed">
              {totalRecords.toLocaleString()} matching entries. Showing the
              newest up to {DEFAULT_LIMIT} records.
            </Text>
          </Stack>
        </Paper>
      )}

      {error && (
        <Alert color="red" icon={<IconAlertCircle size={20} />} title="Error">
          {error instanceof Error
            ? error.message
            : 'Unable to load change logs'}
        </Alert>
      )}

      <Group justify="space-between" align="flex-end">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="transactions">TRANSACTIONS</Tabs.Tab>
            <Tabs.Tab value="system">SYSTEM</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        <SegmentedControl
          size="xs"
          value={panelView}
          onChange={(v) => setPanelView(v as PanelView)}
          data={[
            {
              value: 'table',
              label: (
                <Group gap={4} wrap="nowrap">
                  <IconTable size={14} />
                  <span>Table</span>
                </Group>
              ),
            },
            {
              value: 'timeline',
              label: (
                <Group gap={4} wrap="nowrap">
                  <IconTimeline size={14} />
                  <span>Timeline</span>
                </Group>
              ),
            },
          ]}
        />
      </Group>

      <StandardTableContainer>
        {isLoading ? (
          <Group justify="center" py="lg">
            <Loader size="sm" />
          </Group>
        ) : filteredGroupedLogs.length === 0 ? (
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
                {filteredGroupedLogs.map((group) => {
                  // Sort NEWEST first (at top), OLDEST last (at bottom) - DESCENDING order
                  const sortedEntries = [...group.entries].sort(
                    (a, b) =>
                      new Date(b.createdAt).getTime() -
                      new Date(a.createdAt).getTime()
                  );
                  const latestDate = new Date(group.latestCreatedAt);
                  const latestEntry = sortedEntries[0];
                  const isTransactionGroup =
                    group.entityType.toLowerCase() === 'transaction';

                  const distinctUsers = new Set(
                    group.entries.map((e) => e.userName || 'System')
                  );

                  const groupChangedCols = isTransactionGroup
                    ? getGroupChangedColumns(group.entries)
                    : new Set<TransactionFieldKey>();

                  const visibleFieldKeys = isTransactionGroup
                    ? TRANSACTION_FIELD_KEYS.filter((f) =>
                        groupChangedCols.has(f)
                      )
                    : [];

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
                            {distinctUsers.size > 1 && (
                              <Text size="xs" c="dimmed">
                                +{distinctUsers.size - 1} other
                                {distinctUsers.size > 2 ? 's' : ''}
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
                        {panelView === 'timeline' ? (
                          <TimelineView entries={group.entries} />
                        ) : (
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
                                  {isTransactionGroup
                                    ? visibleFieldKeys.map((f) => (
                                        <Table.Th key={f}>
                                          {TRANSACTION_HEADER_FOR_FIELD[f]}
                                        </Table.Th>
                                      ))
                                    : GENERIC_TABLE_HEADERS.slice(2).map(
                                        (header) => (
                                          <Table.Th key={header}>
                                            {header}
                                          </Table.Th>
                                        )
                                      )}
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
                                    const newTx = log.newValue as Record<
                                      string,
                                      unknown
                                    >;
                                    const oldTx = isRecord(log.oldValue)
                                      ? (log.oldValue as Record<
                                          string,
                                          unknown
                                        >)
                                      : null;
                                    const changedFields =
                                      getChangedTransactionFields(
                                        newTx,
                                        log.oldValue
                                      );

                                    return (
                                      <Table.Tr key={log.id}>
                                        <Table.Td>
                                          <Tooltip
                                            label={formatTimestampFull(
                                              log.createdAt
                                            )}
                                            withArrow
                                          >
                                            <Text size="sm" fw={500} c="dark">
                                              {formatTimestamp(log.createdAt)}
                                            </Text>
                                          </Tooltip>
                                        </Table.Td>
                                        <Table.Td>
                                          <Text size="sm" fw={500}>
                                            {log.userName || 'System'}
                                          </Text>
                                        </Table.Td>
                                        {visibleFieldKeys.map((field) => (
                                          <Table.Td
                                            key={field}
                                            style={
                                              changedFields.has(field)
                                                ? CHANGED_CELL_STYLE
                                                : undefined
                                            }
                                          >
                                            <InlineDiffCell
                                              field={field}
                                              newTx={newTx}
                                              oldTx={oldTx}
                                              isChanged={changedFields.has(
                                                field
                                              )}
                                            />
                                          </Table.Td>
                                        ))}
                                      </Table.Tr>
                                    );
                                  }

                                  // Fall back to old rendering for non-transaction logs
                                  const actionColor =
                                    ACTION_COLOR_MAP[
                                      log.action.toLowerCase()
                                    ] ?? 'gray';

                                  return (
                                    <Table.Tr key={log.id}>
                                      <Table.Td>
                                        <Tooltip
                                          label={formatTimestampFull(
                                            log.createdAt
                                          )}
                                          withArrow
                                        >
                                          <Text size="sm" fw={500} c="dark">
                                            {formatTimestamp(log.createdAt)}
                                          </Text>
                                        </Tooltip>
                                      </Table.Td>
                                      <Table.Td>
                                        <Text size="sm" fw={500}>
                                          {log.userName || 'System'}
                                        </Text>
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
                        )}
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
