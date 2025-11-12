'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Stack,
  Group,
  Select,
  TextInput,
  Button,
  Text,
  Badge,
  Tooltip,
  Loader,
  Alert,
  ActionIcon,
  Table,
  Accordion,
  Box,
  Divider,
  Paper,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconRotateClockwise,
  IconRefresh,
  IconAlertCircle,
  IconChevronRight,
  IconSearch,
} from '@tabler/icons-react';
import { StandardTableContainer } from '@/components/tables/StandardDataTable';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import {
  useChangeLogQuery,
  type ChangeLogFiltersResponse,
  type ChangeLogRecord,
} from '../hooks/useChangeLogQuery';

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
  'minmax(280px, 1.8fr) 200px minmax(220px, 1.6fr) 150px';

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
  return TIMESTAMP_FORMATTER.format(date);
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

function buildSelectOptions(values: string[] | undefined) {
  return (values ?? []).map((value) => ({
    value,
    label: value,
  }));
}

export function ChangeLogPage() {
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [entityId, setEntityId] = useState('');
  const [userId, setUserId] = useState('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT.toString());

  const [debouncedSearch] = useDebouncedValue(search, 400);

  const isDateRangeValid = !startDate || !endDate || endDate >= startDate;

  const queryParams = useMemo(
    () => ({
      page: 1,
      limit: Number(limit),
      search: debouncedSearch || undefined,
      entityType: entityType || undefined,
      entityId: entityId.trim() || undefined,
      userId: userId.trim() || undefined,
      action: action || undefined,
      source: source || undefined,
      startDate: startDate ? startDate.toISOString() : undefined,
      endDate: endDate ? endDate.toISOString() : undefined,
      includeFilters: true,
    }),
    [
      limit,
      debouncedSearch,
      entityType,
      entityId,
      userId,
      action,
      source,
      startDate,
      endDate,
    ]
  );

  const { data, isLoading, isFetching, error, refetch } = useChangeLogQuery(
    queryParams,
    {
      enabled: isDateRangeValid,
    }
  );

  const filters: ChangeLogFiltersResponse | null = data?.filters ?? null;
  const logs = useMemo(() => data?.logs ?? [], [data]);
  const pagination = data?.pagination;
  const totalRecords = pagination?.total;

  const entityTypeOptions = useMemo(
    () => buildSelectOptions(filters?.entityTypes),
    [filters?.entityTypes]
  );
  const actionOptions = useMemo(
    () => buildSelectOptions(filters?.actions),
    [filters?.actions]
  );
  const sourceOptions = useMemo(
    () => buildSelectOptions(filters?.sources),
    [filters?.sources]
  );

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

  const handleResetFilters = () => {
    setSearch('');
    setEntityType(null);
    setAction(null);
    setSource(null);
    setEntityId('');
    setUserId('');
    setStartDate(null);
    setEndDate(null);
    setLimit(DEFAULT_LIMIT.toString());
  };

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

      if (groupRef.entityType.toLowerCase() === 'transaction') {
        const metadataRecord = isRecord(log.metadata)
          ? log.metadata
          : undefined;
        const fieldName = (log.field ?? '').toLowerCase();
        const fieldIsCustomer = fieldName.includes('customer');
        const fieldIsProduct =
          fieldName.includes('product') ||
          fieldName.includes('sku') ||
          fieldName.includes('item');

        if (!groupRef.customerName) {
          const customerFromMetadata = metadataRecord
            ? extractFromObject(metadataRecord, CUSTOMER_METADATA_KEYS)
            : null;
          const customerFromField = fieldIsCustomer
            ? (resolveDetail(log.newValue, CUSTOMER_METADATA_KEYS) ??
              resolveDetail(log.oldValue, CUSTOMER_METADATA_KEYS))
            : null;

          const candidate = customerFromMetadata ?? customerFromField;
          if (candidate) {
            groupRef.customerName = candidate;
          }
        }

        if (!groupRef.productCode) {
          const productFromMetadata = metadataRecord
            ? extractFromObject(metadataRecord, PRODUCT_METADATA_KEYS)
            : null;
          const productFromField = fieldIsProduct
            ? (resolveDetail(log.newValue, PRODUCT_METADATA_KEYS) ??
              resolveDetail(log.oldValue, PRODUCT_METADATA_KEYS))
            : null;

          const candidate = productFromMetadata ?? productFromField;
          if (candidate) {
            groupRef.productCode = candidate;
          }
        }
      }
    }

    return Array.from(groups.values()).sort(
      (a, b) =>
        new Date(b.latestCreatedAt).getTime() -
        new Date(a.latestCreatedAt).getTime()
    );
  }, [logs]);

  return (
    <Stack gap="lg">
      <Stack gap="md">
        <Group gap="sm" align="flex-end" justify="space-between" wrap="wrap">
          <Group
            gap="sm"
            align="flex-end"
            wrap="wrap"
            style={{ flex: '1 1 720px' }}
          >
            <TextInput
              label="Search"
              placeholder="Search logs (user, entity, field, metadata)"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              leftSection={<IconSearch size={16} />}
              size="sm"
              style={{ flex: '1 1 260px', minWidth: '220px' }}
            />
            <Select
              label="Entity"
              placeholder="All entity types"
              data={entityTypeOptions}
              value={entityType}
              onChange={setEntityType}
              clearable
              searchable
              size="sm"
            />
            <Select
              label="Action"
              placeholder="All actions"
              data={actionOptions}
              value={action}
              onChange={setAction}
              clearable
              searchable
              size="sm"
            />
            <Select
              label="Source"
              placeholder="All sources"
              data={sourceOptions}
              value={source}
              onChange={setSource}
              clearable
              searchable
              size="sm"
            />
            <TextInput
              label="Entity ID"
              placeholder="Filter by entity ID"
              value={entityId}
              onChange={(event) => setEntityId(event.currentTarget.value)}
              size="sm"
            />
            <TextInput
              label="User ID"
              placeholder="Filter by user ID"
              value={userId}
              onChange={(event) => setUserId(event.currentTarget.value)}
              size="sm"
            />
            <DateInput
              label="Start date"
              placeholder="Start"
              value={startDate}
              onChange={setStartDate}
              clearable
              size="sm"
              valueFormat="MMM DD, YYYY"
              {...COMMON_DATE_INPUT_PROPS}
            />
            <DateInput
              label="End date"
              placeholder="End"
              value={endDate}
              onChange={setEndDate}
              clearable
              size="sm"
              valueFormat="MMM DD, YYYY"
              minDate={startDate ?? undefined}
              {...COMMON_DATE_INPUT_PROPS}
            />
          </Group>
          <Group gap="sm" align="center">
            {isFetching && !isLoading && <Loader size="sm" />}
            <Tooltip label="Refresh logs" withArrow>
              <ActionIcon
                variant="light"
                color="blue"
                onClick={() => refetch()}
                aria-label="Refresh change logs"
                disabled={isLoading}
              >
                <IconRefresh size={18} />
              </ActionIcon>
            </Tooltip>
            <Button
              variant="subtle"
              color="gray"
              leftSection={<IconRotateClockwise size={18} />}
              onClick={handleResetFilters}
            >
              Reset filters
            </Button>
          </Group>
        </Group>
      </Stack>

      {!isDateRangeValid && (
        <Alert
          color="yellow"
          icon={<IconAlertCircle size={20} />}
          title="Invalid date range"
        >
          End date must be the same as or after the start date.
        </Alert>
      )}

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
                          <Stack gap={2}>
                            <Text size="sm" fw={600} tt="capitalize">
                              {group.entityType} · ID: {group.entityId}
                            </Text>
                            {group.customerName && (
                              <Text size="xs" c="dimmed">
                                Customer: {group.customerName}
                              </Text>
                            )}
                            {group.productCode && (
                              <Text size="xs" c="dimmed">
                                Product: {group.productCode}
                              </Text>
                            )}
                          </Stack>
                          <Text fw={500}>
                            {SUMMARY_DATE_FORMATTER.format(latestDate)} ·{' '}
                            {SUMMARY_TIME_FORMATTER.format(latestDate)}
                          </Text>
                          <Stack gap={2}>
                            <Text fw={500}>
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
                                <Table.Th>SOURCE</Table.Th>
                                <Table.Th>FIELD</Table.Th>
                                <Table.Th>ACTION</Table.Th>
                                <Table.Th>OLD VALUE</Table.Th>
                                <Table.Th>NEW VALUE</Table.Th>
                                <Table.Th>METADATA</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {sortedEntries.map((log) => {
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
