'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
  IconAlertCircle,
  IconHistory,
  IconSearch,
} from '@tabler/icons-react';
import type { PitrBaseBackup } from '../../backup/types';
import {
  formatBackupTimestamp,
  formatRelativeTime,
  parseTimestamp,
} from '../../backup/types';

interface InvestigationLogRecord {
  id: string;
  createdAt: string;
  userId: string | null;
  userName: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  field: string | null;
  oldValue: unknown;
  newValue: unknown;
  source: string | null;
  metadata: unknown;
}

interface InvestigationFilters {
  entityTypes: string[];
  actions: string[];
  sources: string[];
}

interface InvestigationResponse {
  success: boolean;
  logs?: InvestigationLogRecord[];
  filters?: InvestigationFilters | null;
  error?: string;
}

interface InvestigationAuditLogRecord {
  id: string;
  model: string;
  action: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  timestamp: string;
}

interface InvestigationAuditResponse {
  success: boolean;
  logs?: InvestigationAuditLogRecord[];
  error?: string;
}

interface PitrInvestigationTabProps {
  opened: boolean;
  baseBackups: PitrBaseBackup[];
  onApplyRestoreAnchor: (payload: {
    folder: string;
    targetTime: Date;
    message: string;
  }) => void;
}

function shiftDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toCodeString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function toPreviewString(value: unknown, maxLength = 140) {
  const raw = toCodeString(value);
  if (!raw) {
    return null;
  }

  const singleLine = raw.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }

  return `${singleLine.slice(0, maxLength - 1)}…`;
}

function buildLogSearchBlob(log: InvestigationLogRecord) {
  return [
    log.userName,
    log.entityType,
    log.entityId,
    log.action,
    log.field,
    log.source,
    toCodeString(log.oldValue),
    toCodeString(log.newValue),
    toCodeString(log.metadata),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function buildLogPreview(log: InvestigationLogRecord) {
  return (
    toPreviewString(log.metadata) ||
    toPreviewString(log.oldValue) ||
    toPreviewString(log.newValue) ||
    'No structured details recorded'
  );
}

function findBestBaseBackup(
  baseBackups: PitrBaseBackup[],
  targetDate: Date
): PitrBaseBackup | null {
  for (const baseBackup of baseBackups) {
    const createdAt = new Date(baseBackup.createdAt);
    if (createdAt.getTime() <= targetDate.getTime()) {
      return baseBackup;
    }
  }

  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function valuesEqual(left: unknown, right: unknown) {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return left === right;
  }
}

interface FieldChangeEntry {
  path: string;
  oldValue: unknown;
  newValue: unknown;
}

function collectFieldChanges(
  oldValue: unknown,
  newValue: unknown,
  path = ''
): FieldChangeEntry[] {
  if (isPlainObject(oldValue) && isPlainObject(newValue)) {
    const keys = Array.from(new Set([...Object.keys(oldValue), ...Object.keys(newValue)]));

    return keys.flatMap((key) =>
      collectFieldChanges(
        oldValue[key],
        newValue[key],
        path ? `${path}.${key}` : key
      )
    );
  }

  if (valuesEqual(oldValue, newValue)) {
    return [];
  }

  return [{ path, oldValue, newValue }];
}

function buildFieldChanges(log: InvestigationLogRecord) {
  const fallbackField = log.field || 'value';

  return collectFieldChanges(log.oldValue, log.newValue).map((entry) => ({
    field: entry.path || fallbackField,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    oldText: toCodeString(entry.oldValue) ?? 'null',
    newText: toCodeString(entry.newValue) ?? 'null',
  }));
}

export function PitrInvestigationTab({
  opened,
  baseBackups,
  onApplyRestoreAnchor,
}: PitrInvestigationTabProps) {
  const [logFilters, setLogFilters] = useState<InvestigationFilters | null>(null);
  const [investigationLogs, setInvestigationLogs] = useState<InvestigationLogRecord[]>([]);
  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [investigationError, setInvestigationError] = useState<string | null>(null);
  const [investigationInitialized, setInvestigationInitialized] = useState(false);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [actorFilter, setActorFilter] = useState('');
  const [businessIdentifierFilter, setBusinessIdentifierFilter] = useState('');
  const [searchClue, setSearchClue] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string | null>(null);
  const [entityIdFilter, setEntityIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string | null>('update');
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [startDateFilter, setStartDateFilter] = useState<Date | null>(shiftDays(new Date(), -7));
  const [endDateFilter, setEndDateFilter] = useState<Date | null>(new Date());
  const [investigationNotice, setInvestigationNotice] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<InvestigationAuditLogRecord[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) {
      setInvestigationInitialized(false);
      setInvestigationLogs([]);
      setInvestigationError(null);
      setSelectedLogId(null);
      setInvestigationNotice(null);
      setAuditLogs([]);
      setAuditError(null);
    }
  }, [opened]);

  const loadInvestigationLogs = useCallback(() => {
    setInvestigationLoading(true);
    setInvestigationError(null);
    setInvestigationNotice(null);

    const query = new URLSearchParams();
    query.set('page', '1');
    query.set('limit', '200');

    if (entityTypeFilter) {
      query.set('entityType', entityTypeFilter);
    }
    if (entityIdFilter.trim().length > 0) {
      query.set('entityId', entityIdFilter.trim());
    }
    if (actorFilter.trim().length > 0) {
      query.set('actor', actorFilter.trim());
    }
    if (actionFilter) {
      query.set('action', actionFilter);
    }
    if (sourceFilter) {
      query.set('source', sourceFilter);
    }
    if (businessIdentifierFilter.trim().length > 0) {
      query.set('search', businessIdentifierFilter.trim());
    }
    if (startDateFilter) {
      query.set('startDate', startDateFilter.toISOString());
    }
    if (endDateFilter) {
      query.set('endDate', endDateFilter.toISOString());
    }

    fetch(`/api/backup/pitr/investigate?${query.toString()}`)
      .then(async (res) => {
        const data = (await res.json()) as InvestigationResponse;
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to load investigation logs.');
        }

        setInvestigationLogs(data.logs ?? []);
        setLogFilters(data.filters ?? null);
        setSelectedLogId((current) => {
          if (current && (data.logs ?? []).some((log) => log.id === current)) {
            return current;
          }

          return data.logs?.[0]?.id ?? null;
        });
        setInvestigationInitialized(true);
      })
      .catch((error) => {
        setInvestigationError(
          error instanceof Error
            ? error.message
            : 'Failed to load investigation logs.'
        );
      })
      .finally(() => setInvestigationLoading(false));
  }, [
    actionFilter,
    actorFilter,
    businessIdentifierFilter,
    endDateFilter,
    entityIdFilter,
    entityTypeFilter,
    sourceFilter,
    startDateFilter,
  ]);

  useEffect(() => {
    if (opened && !investigationInitialized) {
      loadInvestigationLogs();
    }
  }, [investigationInitialized, loadInvestigationLogs, opened]);

  const resetInvestigationFilters = () => {
    setActorFilter('');
    setBusinessIdentifierFilter('');
    setSearchClue('');
    setEntityTypeFilter(null);
    setEntityIdFilter('');
    setActionFilter('update');
    setSourceFilter(null);
    setStartDateFilter(shiftDays(new Date(), -7));
    setEndDateFilter(new Date());
    setSelectedLogId(null);
    setInvestigationNotice(null);
  };

  const normalizedClue = searchClue.trim().toLowerCase();
  const normalizedBusinessIdentifier = businessIdentifierFilter.trim().toLowerCase();
  const visibleLogs = investigationLogs.filter((log) => {
    if (!normalizedClue && !normalizedBusinessIdentifier) {
      return true;
    }

    const searchBlob = buildLogSearchBlob(log);

    return (
      (!normalizedClue || searchBlob.includes(normalizedClue)) &&
      (!normalizedBusinessIdentifier || searchBlob.includes(normalizedBusinessIdentifier))
    );
  });

  const selectedLog =
    investigationLogs.find((log) => log.id === selectedLogId) ?? null;
  const selectedLogDate = selectedLog ? new Date(selectedLog.createdAt) : null;
  const suggestedBaseBackup = selectedLogDate
    ? findBestBaseBackup(baseBackups, selectedLogDate)
    : null;
  const suggestedTargetTime =
    selectedLogDate && suggestedBaseBackup
      ? new Date(
          Math.max(
            new Date(suggestedBaseBackup.createdAt).getTime(),
            selectedLogDate.getTime() - 1000
          )
        )
      : null;
  const selectedLogFieldChanges = selectedLog ? buildFieldChanges(selectedLog) : [];
  const selectedAuditLog = auditLogs[0] ?? null;
  const selectedAuditFieldChanges = selectedAuditLog
    ? buildFieldChanges({
        id: selectedAuditLog.id,
        createdAt: selectedAuditLog.timestamp,
        userId: null,
        userName: null,
        entityType: selectedLog?.entityType ?? selectedAuditLog.model,
        entityId: selectedAuditLog.targetId,
        action: selectedAuditLog.action,
        field: null,
        oldValue: selectedAuditLog.before,
        newValue: selectedAuditLog.after,
        source: 'audit-log',
        metadata: null,
      })
    : [];
  const visibleFieldChanges =
    selectedLogFieldChanges.length > 0 ? selectedLogFieldChanges : selectedAuditFieldChanges;
  const fieldChangeSourceLabel =
    selectedLogFieldChanges.length > 0
      ? 'Change log'
      : selectedAuditFieldChanges.length > 0
        ? 'Audit log fallback'
        : null;

  useEffect(() => {
    if (!opened || !selectedLog?.entityId) {
      setAuditLogs([]);
      setAuditError(null);
      setAuditLoading(false);
      return;
    }

    setAuditLoading(true);
    setAuditError(null);

    const query = new URLSearchParams({
      entityType: selectedLog.entityType,
      entityId: selectedLog.entityId,
      action: selectedLog.action,
      eventTime: selectedLog.createdAt,
      limit: '5',
    });

    fetch(`/api/backup/pitr/audit?${query.toString()}`)
      .then(async (response) => {
        const data = (await response.json()) as InvestigationAuditResponse;
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to load audit log details.');
        }

        setAuditLogs(data.logs ?? []);
      })
      .catch((error) => {
        setAuditError(
          error instanceof Error
            ? error.message
            : 'Failed to load audit log details.'
        );
      })
      .finally(() => setAuditLoading(false));
  }, [opened, selectedLog]);

  const handleUseLogForRestore = (log: InvestigationLogRecord) => {
    const logDate = new Date(log.createdAt);
    const baseBackup = findBestBaseBackup(baseBackups, logDate);

    if (!baseBackup) {
      setInvestigationNotice(
        'This event is older than the oldest available base backup. You need an older retained base backup to restore around this point.'
      );
      return;
    }

    const targetTime = new Date(
      Math.max(
        new Date(baseBackup.createdAt).getTime(),
        logDate.getTime() - 1000
      )
    );

    setSelectedLogId(log.id);
    onApplyRestoreAnchor({
      folder: baseBackup.folder,
      targetTime,
      message: `Planner anchored to ${formatBackupTimestamp(targetTime.toISOString())} from ${log.action} ${log.entityType}${log.entityId ? ` (${log.entityId})` : ''}.`,
    });
  };

  return (
    <Stack gap="md">
      <Alert icon={<IconSearch size={16} />} color="blue" title="Pinpoint The Incident Window">
        Search the recorded change-log events first, then anchor the PITR planner to the event you
        care about. Use the actor and business-identifier filters to narrow the request up front,
        then use the clue field to scan the loaded payloads for the exact record details.
      </Alert>

      <Card withBorder padding="md" radius="md">
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={5}>Search Filters</Title>
            <Group gap="xs">
              <Button size="xs" variant="default" onClick={resetInvestigationFilters}>
                Reset
              </Button>
              <Button size="xs" onClick={loadInvestigationLogs}>
                Search Events
              </Button>
            </Group>
          </Group>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <TextInput
              label="Actor"
              placeholder="User name or user id"
              value={actorFilter}
              onChange={(event) => setActorFilter(event.currentTarget.value)}
              description="Exact user id or partial actor name"
            />
            <TextInput
              label="Business identifier"
              placeholder="Invoice, product code, customer, route..."
              value={businessIdentifierFilter}
              onChange={(event) => setBusinessIdentifierFilter(event.currentTarget.value)}
              description="Used for server-side search and payload narrowing"
            />
            <TextInput
              label="Clue"
              placeholder="Customer, product, invoice, deleted name..."
              value={searchClue}
              onChange={(event) => setSearchClue(event.currentTarget.value)}
              description="Filters the returned log payloads client-side"
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
            <TextInput
              label="Entity ID"
              placeholder="Exact entity id if known"
              value={entityIdFilter}
              onChange={(event) => setEntityIdFilter(event.currentTarget.value)}
            />
            <Select
              label="Action"
              placeholder="Any action"
              value={actionFilter}
              onChange={setActionFilter}
              data={[
                { value: 'update', label: 'update' },
                { value: 'create', label: 'create' },
                { value: 'restore', label: 'restore' },
                ...((logFilters?.actions ?? [])
                  .filter(
                    (action) => !['delete', 'update', 'create', 'restore'].includes(action)
                  )
                  .map((action) => ({ value: action, label: action }))),
                { value: 'delete', label: 'delete' },
              ]}
              clearable
            />
            <Select
              label="Entity type"
              placeholder="Any entity"
              value={entityTypeFilter}
              onChange={setEntityTypeFilter}
              data={(logFilters?.entityTypes ?? []).map((entityType) => ({
                value: entityType,
                label: entityType,
              }))}
              searchable
              clearable
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            <Select
              label="Source"
              placeholder="Any source"
              value={sourceFilter}
              onChange={setSourceFilter}
              data={(logFilters?.sources ?? []).map((source) => ({
                value: source,
                label: source,
              }))}
              searchable
              clearable
            />
            <DateTimePicker
              label="Start date"
              placeholder="Search from"
              value={startDateFilter}
              onChange={setStartDateFilter}
              clearable
            />
            <DateTimePicker
              label="End date"
              placeholder="Search to"
              value={endDateFilter}
              onChange={setEndDateFilter}
              clearable
            />
          </SimpleGrid>
        </Stack>
      </Card>

      {investigationLoading ? (
        <Progress value={100} animated />
      ) : null}

      {investigationError ? (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {investigationError}
        </Alert>
      ) : null}

      {investigationNotice ? (
        <Alert icon={<IconAlertCircle size={16} />} color="orange">
          {investigationNotice}
        </Alert>
      ) : null}

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Title order={5}>Matched Events</Title>
            <Group gap="xs">
              <Badge color="blue" variant="light">
                {visibleLogs.length} shown
              </Badge>
              <Badge color="gray" variant="light">
                {investigationLogs.length} loaded
              </Badge>
            </Group>
          </Group>

          {visibleLogs.length === 0 ? (
            <Alert icon={<IconHistory size={16} />} color="gray">
              No matching events found. Broaden the date window, clear some filters, or use a less
              specific clue string.
            </Alert>
          ) : (
            <Table.ScrollContainer minWidth={1080}>
              <Table withTableBorder withColumnBorders striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Time</Table.Th>
                    <Table.Th>Action</Table.Th>
                    <Table.Th>Entity</Table.Th>
                    <Table.Th>Actor</Table.Th>
                    <Table.Th>Source</Table.Th>
                    <Table.Th>Clue Preview</Table.Th>
                    <Table.Th>Restore</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {visibleLogs.map((log) => {
                    const selected = log.id === selectedLogId;
                    return (
                      <Table.Tr key={log.id} bg={selected ? 'rgba(34, 139, 230, 0.06)' : undefined}>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm">{formatBackupTimestamp(log.createdAt)}</Text>
                            <Text size="xs" c="dimmed">
                              {formatRelativeTime(parseTimestamp(log.createdAt))}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={
                              log.action === 'delete'
                                ? 'red'
                                : log.action === 'update'
                                  ? 'blue'
                                  : log.action === 'create'
                                    ? 'green'
                                    : 'gray'
                            }
                            variant="light"
                          >
                            {log.action}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm" fw={600}>
                              {log.entityType}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {log.entityId || 'No entity id'}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{log.userName || 'Unknown user'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{log.source || 'Unspecified'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="xs" c="dimmed">
                            {buildLogPreview(log)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Button
                              size="xs"
                              variant={selected ? 'filled' : 'default'}
                              onClick={() => setSelectedLogId(log.id)}
                            >
                              Inspect
                            </Button>
                            <Button
                              size="xs"
                              variant="light"
                              onClick={() => handleUseLogForRestore(log)}
                            >
                              Use
                            </Button>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Stack>
      </Card>

      {selectedLog ? (
        <Card withBorder padding="md" radius="md">
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={5}>Selected Event</Title>
              <Button size="xs" onClick={() => handleUseLogForRestore(selectedLog)}>
                Use This Event For Restore Planning
              </Button>
            </Group>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <Card withBorder padding="sm" radius="md" style={{ gridColumn: '1 / -1' }}>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Stack gap={2}>
                      <Title order={6}>Changed Fields</Title>
                      <Text size="xs" c="dimmed">
                        Use the previous values below to correct the live record manually.
                      </Text>
                    </Stack>
                    <Group gap="xs">
                      {fieldChangeSourceLabel ? (
                        <Badge color="blue" variant="light">{fieldChangeSourceLabel}</Badge>
                      ) : null}
                      <Badge color="blue" variant="light">
                        {visibleFieldChanges.length} field{visibleFieldChanges.length !== 1 ? 's' : ''}
                      </Badge>
                    </Group>
                  </Group>

                  {auditLoading ? <Progress value={100} animated size="xs" /> : null}
                  {auditError ? (
                    <Text size="xs" c="red">
                      {auditError}
                    </Text>
                  ) : null}

                  {visibleFieldChanges.length > 0 ? (
                    <Table.ScrollContainer minWidth={600}>
                      <Table withTableBorder withColumnBorders striped>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Field</Table.Th>
                            <Table.Th>Previous value</Table.Th>
                            <Table.Th>Current value</Table.Th>
                            <Table.Th>Copy</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {visibleFieldChanges.map((change) => (
                            <Table.Tr key={change.field}>
                              <Table.Td>
                                <Text size="xs" ff="monospace">
                                  {change.field}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" ff="monospace" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {change.oldText}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" ff="monospace" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {change.newText}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Group gap="xs" wrap="nowrap">
                                  <CopyButton value={change.oldText} timeout={1500}>
                                    {({ copied, copy }) => (
                                      <Button size="xs" variant="subtle" color={copied ? 'teal' : 'blue'} onClick={copy}>
                                        {copied ? 'Copied old' : 'Copy old'}
                                      </Button>
                                    )}
                                  </CopyButton>
                                  <CopyButton value={change.newText} timeout={1500}>
                                    {({ copied, copy }) => (
                                      <Button size="xs" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                                        {copied ? 'Copied new' : 'Copy new'}
                                      </Button>
                                    )}
                                  </CopyButton>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  ) : (
                    <Text size="sm" c="dimmed">
                      No field-level diff could be derived from this event. Use the raw payloads below.
                    </Text>
                  )}
                </Stack>
              </Card>

              {selectedAuditLog ? (
                <Card withBorder padding="sm" radius="md">
                  <Stack gap={4}>
                    <Text size="xs" c="dimmed">
                      Audit log match
                    </Text>
                    <Text size="sm" fw={600}>
                      {selectedAuditLog.action} {selectedAuditLog.model}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {formatBackupTimestamp(selectedAuditLog.timestamp)}
                    </Text>
                  </Stack>
                </Card>
              ) : null}

              <Card withBorder padding="sm" radius="md">
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Event time
                  </Text>
                  <Text size="sm" fw={600}>
                    {formatBackupTimestamp(selectedLog.createdAt)}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatRelativeTime(parseTimestamp(selectedLog.createdAt))}
                  </Text>
                </Stack>
              </Card>
              <Card withBorder padding="sm" radius="md">
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Suggested base backup
                  </Text>
                  <Text size="sm" fw={600}>
                    {suggestedBaseBackup?.folder || 'No eligible base backup'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {suggestedBaseBackup
                      ? formatBackupTimestamp(suggestedBaseBackup.createdAt)
                      : 'Event predates retained base backups'}
                  </Text>
                </Stack>
              </Card>
              <Card withBorder padding="sm" radius="md">
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Suggested restore target
                  </Text>
                  <Text size="sm" fw={600}>
                    {suggestedTargetTime
                      ? formatBackupTimestamp(suggestedTargetTime.toISOString())
                      : 'Unavailable'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    1 second before the selected event when possible
                  </Text>
                </Stack>
              </Card>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <Card withBorder padding="sm" radius="md">
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Action / entity
                  </Text>
                  <Text size="sm" fw={600}>
                    {selectedLog.action} {selectedLog.entityType}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Entity ID: {selectedLog.entityId || 'N/A'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    Field: {selectedLog.field || 'N/A'}
                  </Text>
                </Stack>
              </Card>
              <Card withBorder padding="sm" radius="md">
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Actor
                  </Text>
                  <Text size="sm" fw={600}>
                    {selectedLog.userName || 'Unknown user'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    User ID: {selectedLog.userId || 'N/A'}
                  </Text>
                </Stack>
              </Card>
              <Card withBorder padding="sm" radius="md">
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Source
                  </Text>
                  <Text size="sm" fw={600}>
                    {selectedLog.source || 'Unspecified'}
                  </Text>
                </Stack>
              </Card>
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
              <Card withBorder padding="sm" radius="md">
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Old value
                  </Text>
                  <Code block>{toCodeString(selectedLog.oldValue) || 'No old value recorded'}</Code>
                </Stack>
              </Card>
              <Card withBorder padding="sm" radius="md">
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    New value
                  </Text>
                  <Code block>{toCodeString(selectedLog.newValue) || 'No new value recorded'}</Code>
                </Stack>
              </Card>
              <Card withBorder padding="sm" radius="md">
                <Stack gap={4}>
                  <Text size="xs" c="dimmed">
                    Metadata
                  </Text>
                  <Code block>{toCodeString(selectedLog.metadata) || 'No metadata recorded'}</Code>
                </Stack>
              </Card>
            </SimpleGrid>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}
