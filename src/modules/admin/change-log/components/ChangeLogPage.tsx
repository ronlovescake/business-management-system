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
  Pagination,
  ActionIcon,
  Table,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useDebouncedValue } from '@mantine/hooks';
import {
  IconRotateClockwise,
  IconRefresh,
  IconAlertCircle,
} from '@tabler/icons-react';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import {
  useChangeLogQuery,
  type ChangeLogFiltersResponse,
} from '../hooks/useChangeLogQuery';

const ROWS_PER_PAGE_OPTIONS = [
  { value: '25', label: '25 / page' },
  { value: '50', label: '50 / page' },
  { value: '100', label: '100 / page' },
];

const TABLE_HEADERS = [
  'TIMESTAMP',
  'USER',
  'SOURCE',
  'ENTITY',
  'FIELD',
  'ACTION',
  'OLD VALUE',
  'NEW VALUE',
  'METADATA',
];

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
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState('25');
  const [controlsKey, setControlsKey] = useState(0);

  const [debouncedSearch] = useDebouncedValue(search, 400);

  const isDateRangeValid = !startDate || !endDate || endDate >= startDate;

  useEffect(() => {
    setPage(1);
  }, [
    debouncedSearch,
    entityType,
    action,
    source,
    entityId,
    userId,
    startDate,
    endDate,
    limit,
  ]);

  const queryParams = useMemo(
    () => ({
      page,
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
      page,
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
  const logs = data?.logs ?? [];
  const pagination = data?.pagination;

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

  const displayedPage = pagination?.page ?? page;
  const displayedLimit = pagination?.limit ?? Number(limit);
  const totalRecords = pagination?.total ?? 0;
  const startIndex = logs.length ? (displayedPage - 1) * displayedLimit + 1 : 0;
  const endIndex = logs.length ? startIndex + logs.length - 1 : 0;

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
    setLimit('25');
    setControlsKey((value) => value + 1);
    setPage(1);
  };

  const rows = logs.map((log) => {
    const actionColor = ACTION_COLOR_MAP[log.action.toLowerCase()] ?? 'gray';

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
          <Stack gap={2}>
            <Text size="sm" fw={500}>
              {log.entityType}
            </Text>
            {log.entityId && (
              <Text size="xs" c="dimmed">
                {log.entityId}
              </Text>
            )}
          </Stack>
        </Table.Td>
        <Table.Td>
          <Text size="sm" c="dark">
            {log.field || '—'}
          </Text>
        </Table.Td>
        <Table.Td>
          <Badge color={actionColor} variant="light" radius="sm">
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
  });

  return (
    <Stack gap="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <StandardTableControls
            key={controlsKey}
            searchPlaceholder="Search logs (user, entity, field, metadata)"
            onSearch={setSearch}
            hideImport
            hideExport
            hideAddNew
            expandSearch
          />
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

        <Group gap="sm" wrap="wrap">
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
        <StandardDataTable
          headers={TABLE_HEADERS as unknown as string[]}
          emptyState={emptyState}
          colSpan={TABLE_HEADERS.length}
        >
          {isLoading ? null : rows}
        </StandardDataTable>
      </StandardTableContainer>

      <Group justify="space-between" align="center" wrap="wrap">
        <Text size="sm" c="dimmed">
          {totalRecords === 0
            ? 'No records to display'
            : `Showing ${startIndex.toLocaleString()}–${endIndex.toLocaleString()} of ${totalRecords.toLocaleString()} records`}
        </Text>
        <Group gap="sm" align="center">
          <Select
            value={limit}
            data={ROWS_PER_PAGE_OPTIONS}
            onChange={(value) => value && setLimit(value)}
            size="sm"
          />
          <Pagination
            value={page}
            onChange={setPage}
            total={Math.max(pagination?.pages ?? 1, 1)}
            size="sm"
            withEdges
          />
        </Group>
      </Group>
    </Stack>
  );
}
