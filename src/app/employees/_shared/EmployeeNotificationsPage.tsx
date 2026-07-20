'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconAlertCircle, IconBell, IconRefresh } from '@tabler/icons-react';
import { PageLayout } from '@/components/layout/PageLayout';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import type {
  EmployeeAutomationOverview,
  EmployeeAutomationRunRecord,
  EmployeeAutomationStatus,
} from '@/modules/shared/employees/automation/types';
import {
  AUTOMATION_LABELS,
  SETTINGS_API_PATH,
  formatRunTarget,
  formatRunTimestamp,
  getStatusColor,
  getTriggerColor,
} from './employeeAutomationSettingsUtils';

type EmployeeNotificationsPageProps = {
  domains?: NotificationDomainConfig[];
};

type NotificationDomainConfig = {
  label: string;
  value: string;
  apiBasePath?: string;
};

type AutomationNotification = EmployeeAutomationRunRecord & {
  category: 'employee-automation';
  domainLabel: string;
  domainValue: string;
};

type BackupManifest = {
  timestamp?: string;
  format?: string;
  strategy?: 'full' | 'differential' | 'log';
  files?: Array<{ name?: string; size?: number }>;
  scheduler?: {
    trigger?: 'manual' | 'scheduled';
    triggeredAt?: string;
    scheduledDateKey?: string;
    catchUp?: boolean;
  };
};

type BackupListItem = {
  timestamp: string;
  totalSize?: number;
  manifest?: BackupManifest | null;
  strategy?: 'full' | 'differential' | 'log';
};

type BackupBaseItem = {
  folder: string;
  timestamp: string;
  files?: Array<{ name?: string; size?: number }>;
  scheduler?: {
    trigger?: 'manual' | 'scheduled';
    triggeredAt?: string;
  };
};

type BackupNotification = {
  id: string;
  category: 'backup';
  createdAt: string;
  domainLabel: 'System';
  domainValue: 'system';
  automationType: 'backup';
  triggerSource: EmployeeAutomationRunRecord['triggerSource'];
  status: 'success';
  target: string;
  message: string;
  processed: number;
  inserted: number;
  skipped: number;
  actor: string;
};

type OperationsNotificationRecord = {
  id: string;
  category: string;
  user?: string | null;
  userName?: string | null;
  changes: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

type DocumentNotification = {
  id: string;
  category: 'documents';
  createdAt: string;
  domainLabel: string;
  domainValue: string;
  automationType: 'document';
  triggerSource: 'manual';
  status: 'success';
  target: string;
  message: string;
  processed: number;
  inserted: number;
  skipped: number;
  actor: string;
};

type NotificationItem =
  | AutomationNotification
  | BackupNotification
  | DocumentNotification;

const DEFAULT_DOMAINS: NotificationDomainConfig[] = [
  { label: 'Clothing', value: 'clothing' },
  { label: 'Trucking', value: 'trucking', apiBasePath: '/api/trucking' },
  {
    label: 'General Merchandise',
    value: 'general-merchandise',
    apiBasePath: '/api/general-merchandise',
  },
];

const DOCUMENT_DOMAINS: NotificationDomainConfig[] = [
  { label: 'Clothing', value: 'clothing' },
  {
    label: 'General Merchandise',
    value: 'general-merchandise',
    apiBasePath: '/api/general-merchandise',
  },
];

const ALL_VALUE = 'all';

function buildSettingsPath(domain: NotificationDomainConfig) {
  return buildApiPath(domain.apiBasePath, SETTINGS_API_PATH);
}

function getLatestTimestamp(notifications: NotificationItem[]) {
  if (notifications.length === 0) {
    return 'No messages loaded yet.';
  }

  return `Latest: ${formatRunTimestamp(notifications[0].createdAt)}`;
}

function getStatusTone(status: EmployeeAutomationStatus) {
  if (status === 'error') {
    return 'Needs attention';
  }

  if (status === 'skipped') {
    return 'Skipped';
  }

  return 'Completed';
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatBackupTimestamp(value: string) {
  const normalized = value.replace(/T(\d{2})-(\d{2})-(\d{2})$/, 'T$1:$2:$3Z');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

function getBackupCreatedAt(item: BackupListItem) {
  return formatBackupTimestamp(item.manifest?.timestamp ?? item.timestamp);
}

function toBackupNotification(item: BackupListItem): BackupNotification {
  const strategy = item.manifest?.strategy ?? item.strategy ?? 'full';
  const fileCount = item.manifest?.files?.length ?? 0;
  const totalSize =
    item.totalSize ??
    item.manifest?.files?.reduce((sum, file) => sum + (file.size ?? 0), 0) ??
    0;
  const trigger = item.manifest?.scheduler?.trigger ?? 'manual';

  return {
    id: `backup-${item.timestamp}`,
    category: 'backup',
    createdAt: getBackupCreatedAt(item),
    domainLabel: 'System',
    domainValue: 'system',
    automationType: 'backup',
    triggerSource: trigger === 'scheduled' ? 'scheduler' : 'manual',
    status: 'success',
    target: item.manifest?.scheduler?.scheduledDateKey ?? item.timestamp,
    message: `${strategy[0].toUpperCase()}${strategy.slice(1)} backup completed. ${fileCount} file(s), ${formatBytes(totalSize)}.`,
    processed: fileCount,
    inserted: 1,
    skipped: 0,
    actor: 'System',
  };
}

function toPitrBackupNotification(item: BackupBaseItem): BackupNotification {
  const totalSize =
    item.files?.reduce((sum, file) => sum + (file.size ?? 0), 0) ?? 0;
  const trigger = item.scheduler?.trigger ?? 'manual';

  return {
    id: `pitr-backup-${item.folder}`,
    category: 'backup',
    createdAt: formatBackupTimestamp(item.timestamp),
    domainLabel: 'System',
    domainValue: 'system',
    automationType: 'backup',
    triggerSource: trigger === 'scheduled' ? 'scheduler' : 'manual',
    status: 'success',
    target: item.folder,
    message: `PITR base backup completed. ${item.files?.length ?? 0} file(s), ${formatBytes(totalSize)}.`,
    processed: item.files?.length ?? 0,
    inserted: 1,
    skipped: 0,
    actor: 'System',
  };
}

function getMetadataString(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function getMetadataNumber(
  metadata: Record<string, unknown> | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toDocumentNotification(
  domain: NotificationDomainConfig,
  item: OperationsNotificationRecord
): DocumentNotification {
  const documentType =
    getMetadataString(item.metadata, 'documentType') ?? 'document';
  const filename = getMetadataString(item.metadata, 'filename');

  return {
    id: `document-${domain.value}-${item.id}`,
    category: 'documents',
    createdAt: item.createdAt,
    domainLabel: domain.label,
    domainValue: domain.value,
    automationType: 'document',
    triggerSource: 'manual',
    status: 'success',
    target: filename ?? documentType,
    message: item.changes,
    processed: getMetadataNumber(item.metadata, 'count'),
    inserted: 1,
    skipped: 0,
    actor: item.userName ?? item.user ?? 'Operations',
  };
}

async function fetchDocumentNotifications(): Promise<DocumentNotification[]> {
  const results = await Promise.all(
    DOCUMENT_DOMAINS.map(async (domain) => {
      const response = await fetch(
        `${buildApiPath(domain.apiBasePath, '/operations/notifications')}?category=documents&limit=100`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to load ${domain.label} document notifications.`
        );
      }

      const records = (await response.json()) as OperationsNotificationRecord[];
      return records.map((record) => toDocumentNotification(domain, record));
    })
  );

  return results.flat();
}

async function fetchBackupNotifications(): Promise<BackupNotification[]> {
  const [backupResponse, pitrResponse] = await Promise.all([
    fetch('/api/backup', { cache: 'no-store' }),
    fetch('/api/backup/pitr/bases', { cache: 'no-store' }),
  ]);

  if (!backupResponse.ok) {
    throw new Error('Failed to load backup notifications.');
  }

  if (!pitrResponse.ok) {
    throw new Error('Failed to load PITR backup notifications.');
  }

  const backupBody = (await backupResponse.json()) as {
    backups?: BackupListItem[];
  };
  const pitrBody = (await pitrResponse.json()) as {
    baseBackups?: BackupBaseItem[];
  };

  return [
    ...(backupBody.backups ?? []).map(toBackupNotification),
    ...(pitrBody.baseBackups ?? []).map(toPitrBackupNotification),
  ];
}

export function EmployeeNotificationsPage({
  domains = DEFAULT_DOMAINS,
}: EmployeeNotificationsPageProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState(ALL_VALUE);
  const [domainFilter, setDomainFilter] = useState(ALL_VALUE);
  const [typeFilter, setTypeFilter] = useState(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState(ALL_VALUE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [automationResults, backupResults, documentResults] =
        await Promise.all([
          Promise.all(
            domains.map(async (domain) => {
              const response = await fetch(buildSettingsPath(domain), {
                cache: 'no-store',
              });

              if (!response.ok) {
                let body: { error?: string } | null = null;
                try {
                  body = (await response.json()) as { error?: string };
                } catch {
                  body = null;
                }

                throw new Error(
                  body?.error ?? `Failed to load ${domain.label} notifications.`
                );
              }

              const overview =
                (await response.json()) as EmployeeAutomationOverview;
              return (overview.history ?? []).map((run) => ({
                ...run,
                category: 'employee-automation' as const,
                domainLabel: domain.label,
                domainValue: domain.value,
              }));
            })
          ),
          fetchBackupNotifications(),
          fetchDocumentNotifications(),
        ]);

      setNotifications(
        [...automationResults.flat(), ...backupResults, ...documentResults]
          .flat()
          .sort(
            (left, right) =>
              new Date(right.createdAt).getTime() -
              new Date(left.createdAt).getTime()
          )
      );
    } catch (fetchError) {
      logger.error(fetchError);
      setNotifications([]);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Unable to load notifications.'
      );
    } finally {
      setLoading(false);
    }
  }, [domains]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  const filteredNotifications = useMemo(
    () =>
      notifications.filter((notification) => {
        const matchesDomain =
          domainFilter === ALL_VALUE ||
          notification.domainValue === domainFilter;
        const matchesCategory =
          categoryFilter === ALL_VALUE ||
          notification.category === categoryFilter;
        const matchesType =
          typeFilter === ALL_VALUE ||
          notification.automationType === typeFilter;
        const matchesStatus =
          statusFilter === ALL_VALUE || notification.status === statusFilter;

        return matchesDomain && matchesCategory && matchesType && matchesStatus;
      }),
    [categoryFilter, domainFilter, notifications, statusFilter, typeFilter]
  );

  const summary = useMemo(
    () => ({
      total: notifications.length,
      errors: notifications.filter((item) => item.status === 'error').length,
      skipped: notifications.filter((item) => item.status === 'skipped').length,
      success: notifications.filter((item) => item.status === 'success').length,
    }),
    [notifications]
  );

  return (
    <PageLayout title="Notifications" fluid withPadding>
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Stack gap={4}>
            <Group gap="xs">
              <IconBell size={20} />
              <Text fw={700} size="lg">
                Automation & System Messages
              </Text>
            </Group>
            <Text c="dimmed" size="sm">
              {getLatestTimestamp(notifications)}
            </Text>
          </Stack>

          <Button
            leftSection={<IconRefresh size={16} />}
            loading={loading}
            onClick={() => void fetchNotifications()}
            variant="light"
          >
            Refresh
          </Button>
        </Group>

        {error ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />}>
            {error}
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <Card withBorder radius="md" p="md">
            <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
              Total
            </Text>
            <Text fw={700} size="xl">
              {summary.total}
            </Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
              Completed
            </Text>
            <Text fw={700} size="xl" c="green">
              {summary.success}
            </Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
              Skipped
            </Text>
            <Text fw={700} size="xl" c="yellow">
              {summary.skipped}
            </Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text c="dimmed" size="xs" tt="uppercase" fw={700}>
              Errors
            </Text>
            <Text fw={700} size="xl" c="red">
              {summary.errors}
            </Text>
          </Card>
        </SimpleGrid>

        <Card withBorder radius="md" p="md">
          <SimpleGrid cols={{ base: 1, md: 2, lg: 4 }} spacing="md">
            <Select
              label="Category"
              value={categoryFilter}
              onChange={(value) => setCategoryFilter(value ?? ALL_VALUE)}
              data={[
                { label: 'All categories', value: ALL_VALUE },
                { label: 'Employee automation', value: 'employee-automation' },
                { label: 'Backups', value: 'backup' },
                { label: 'Documents', value: 'documents' },
              ]}
            />
            <Select
              label="Domain"
              value={domainFilter}
              onChange={(value) => setDomainFilter(value ?? ALL_VALUE)}
              data={[
                { label: 'All domains', value: ALL_VALUE },
                { label: 'System', value: 'system' },
                ...domains.map((domain) => ({
                  label: domain.label,
                  value: domain.value,
                })),
              ]}
            />
            <Select
              label="Type"
              value={typeFilter}
              onChange={(value) => setTypeFilter(value ?? ALL_VALUE)}
              data={[
                { label: 'All types', value: ALL_VALUE },
                {
                  label: AUTOMATION_LABELS['stay-in-attendance'],
                  value: 'stay-in-attendance',
                },
                {
                  label: AUTOMATION_LABELS['payroll-generation'],
                  value: 'payroll-generation',
                },
                { label: 'Backup', value: 'backup' },
                { label: 'Document', value: 'document' },
              ]}
            />
            <Select
              label="Status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value ?? ALL_VALUE)}
              data={[
                { label: 'All statuses', value: ALL_VALUE },
                { label: 'Completed', value: 'success' },
                { label: 'Skipped', value: 'skipped' },
                { label: 'Errors', value: 'error' },
              ]}
            />
          </SimpleGrid>
        </Card>

        <Card withBorder radius="md" p="xl">
          {loading ? (
            <Group justify="center" py="xl">
              <Loader size="sm" />
              <Text c="dimmed" size="sm">
                Loading notifications...
              </Text>
            </Group>
          ) : filteredNotifications.length === 0 ? (
            <Text c="dimmed" size="sm">
              No notifications match the selected filters.
            </Text>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>When</Table.Th>
                    <Table.Th>Domain</Table.Th>
                    <Table.Th>Type</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Target</Table.Th>
                    <Table.Th>Message</Table.Th>
                    <Table.Th>Trigger</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredNotifications.map((notification) => (
                    <Table.Tr
                      key={`${notification.domainValue}-${notification.id}`}
                    >
                      <Table.Td>
                        <Text size="sm">
                          {formatRunTimestamp(notification.createdAt)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light">
                          {notification.domainLabel}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {notification.automationType === 'backup'
                            ? 'Backup'
                            : notification.automationType === 'document'
                              ? 'Document'
                              : AUTOMATION_LABELS[notification.automationType]}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={4}>
                          <Badge
                            color={getStatusColor(notification.status)}
                            variant="light"
                          >
                            {getStatusTone(notification.status)}
                          </Badge>
                          <Text c="dimmed" size="xs">
                            {notification.status}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {notification.category === 'backup'
                            ? notification.target
                            : notification.category === 'documents'
                              ? notification.target
                              : formatRunTarget(notification)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={2}>
                          <Text size="sm">
                            {notification.message ?? 'No message available.'}
                          </Text>
                          <Text c="dimmed" size="xs">
                            Processed {notification.processed} | Inserted{' '}
                            {notification.inserted} | Skipped{' '}
                            {notification.skipped}
                          </Text>
                        </Stack>
                      </Table.Td>
                      <Table.Td>
                        <Stack gap={4}>
                          <Badge
                            color={getTriggerColor(notification.triggerSource)}
                            variant="light"
                          >
                            {notification.triggerSource}
                          </Badge>
                          <Text c="dimmed" size="xs">
                            {notification.category === 'backup'
                              ? notification.actor
                              : notification.category === 'documents'
                                ? notification.actor
                                : (notification.triggeredByUserName ??
                                  'System')}
                          </Text>
                        </Stack>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </Card>
      </Stack>
    </PageLayout>
  );
}
