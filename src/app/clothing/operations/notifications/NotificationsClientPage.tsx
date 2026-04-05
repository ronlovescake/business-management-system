'use client';

import {
  useCallback,
  useMemo,
  useState,
  Fragment,
  type ReactNode,
} from 'react';
import {
  Alert,
  Center,
  Loader,
  Stack,
  Tabs,
  Table,
  Text,
  ActionIcon,
  Collapse,
  Group,
  Badge,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconChevronDown,
  IconChevronRight,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { PageLayout } from '../../../../components/layout/PageLayout';
import {
  OperationsNotificationsService,
  type OperationsNotificationCategory,
  type OperationsNotificationRecord,
} from '../../../../modules/clothing/operations/notifications/services/OperationsNotificationsService';
import { queryKeys } from '@/lib/queryKeys';
import { StandardDataTable } from '@/components/tables/StandardDataTable';

const TAB_ITEMS = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'products', label: 'Products' },
  { value: 'prices', label: 'Prices' },
  { value: 'shipments', label: 'Shipments' },
];

const TABLE_HEADERS = ['Date', 'Time', 'User', 'Changes'];

interface NotificationsPanelProps {
  category: OperationsNotificationCategory;
  label: string;
  apiBasePath?: string;
}

interface GroupedNotification {
  id: string;
  transactionId: string | null;
  action: string;
  createdAt: Date;
  userName: string;
  changes: OperationsNotificationRecord[];
  isOpen: boolean;
}

// Truncate long text for display in summary rows
function truncateText(text: string, max = 80): string {
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max) + '…';
}

function NotificationsPanel({
  category,
  label,
  apiBasePath,
}: NotificationsPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: [
      ...queryKeys.operationsNotifications.byCategory(category),
      apiBasePath ?? 'default',
    ],
    queryFn: () =>
      OperationsNotificationsService.fetchList({ category }, apiBasePath),
    staleTime: 0,
    refetchOnMount: true,
  });

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((groupId: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const groupedNotifications = useMemo(() => {
    if (!data) {
      return [];
    }

    // Group by entity (transactionId/productId) + user + date
    const groups = new Map<string, OperationsNotificationRecord[]>();

    for (const notification of data) {
      const dateKey = new Date(notification.createdAt).toDateString();

      const key = [
        notification.transactionId || 'no-entity',
        notification.userName || 'Operations',
        dateKey,
      ].join('||');

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      const group = groups.get(key);
      if (group) {
        group.push(notification);
      }
    }

    const result: GroupedNotification[] = [];

    for (const [key, changes] of Array.from(groups.entries())) {
      // Sort changes within group by time (most recent first)
      changes.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Use the most recent change's data for the group header
      const first = changes[0];
      result.push({
        id: key,
        transactionId: first.transactionId,
        action: first.action || 'Update',
        createdAt: new Date(first.createdAt),
        userName: first.userName || first.user || 'Operations',
        changes,
        isOpen: openGroups.has(key),
      });
    }

    // Sort groups by most recent date first
    result.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return result;
  }, [data, openGroups]);

  if (isLoading) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (error) {
    return (
      <Alert color="red" icon={<IconAlertCircle />}>
        Failed to load {label.toLowerCase()} notifications.
      </Alert>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Center py="xl">
        <Text c="dimmed">No {label.toLowerCase()} notifications found.</Text>
      </Center>
    );
  }

  // Helper function to format the date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  // Helper function to format the time
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).format(date);
  };

  const createBadgeContent = (group: GroupedNotification): ReactNode => {
    if (group.changes.length === 1) {
      const change = group.changes[0];
      // For single changes: show the field name or a summary
      const label = change.field || group.action;
      return (
        <Badge size="sm" variant="light">
          {label}
        </Badge>
      );
    }

    return (
      <Badge size="sm" color="blue">
        {group.changes.length} changes
      </Badge>
    );
  };

  return (
    <Stack gap="md">
      <StandardDataTable headers={TABLE_HEADERS} colSpan={TABLE_HEADERS.length}>
        {groupedNotifications.map((group) => {
          const date = group.createdAt;
          const isOpen = openGroups.has(group.id);
          const isExpandable = group.changes.length > 1;

          return (
            <Fragment key={group.id}>
              {/* Main row */}
              <Table.Tr
                style={{
                  cursor: isExpandable ? 'pointer' : undefined,
                }}
                onClick={isExpandable ? () => toggleGroup(group.id) : undefined}
              >
                <Table.Td>{formatDate(date)}</Table.Td>
                <Table.Td>{formatTime(date)}</Table.Td>
                <Table.Td>{group.userName}</Table.Td>
                <Table.Td>
                  <Group gap="xs" wrap="nowrap" justify="space-between">
                    {isExpandable ? (
                      <>
                        {createBadgeContent(group)}
                        <ActionIcon variant="subtle" size="sm">
                          {isOpen ? (
                            <IconChevronDown />
                          ) : (
                            <IconChevronRight />
                          )}
                        </ActionIcon>
                      </>
                    ) : (
                      <Text size="sm">
                        {truncateText(group.changes[0].changes)}
                      </Text>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>

              {/* Expandable details */}
              {isExpandable && isOpen && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Collapse in={isOpen}>
                      <Stack gap="xs" p="sm" bg="gray.0">
                        <Text size="sm" fw={600} c="dimmed">
                          Individual Changes:
                        </Text>
                        <Table striped highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Time</Table.Th>
                              <Table.Th>Description</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {group.changes.map((change) => (
                              <Table.Tr key={change.id}>
                                <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                  {formatTime(new Date(change.createdAt))}
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm">{change.changes}</Text>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Stack>
                    </Collapse>
                  </Table.Td>
                </Table.Tr>
              )}
            </Fragment>
          );
        })}
      </StandardDataTable>
    </Stack>
  );
}

export function NotificationsClientPage({
  apiBasePath,
}: {
  apiBasePath?: string;
}) {
  return (
    <PageLayout title="Notifications">
      <Tabs defaultValue="transactions">
        <Tabs.List>
          {TAB_ITEMS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {TAB_ITEMS.map((tab) => (
          <Tabs.Panel key={tab.value} value={tab.value} pt="md">
            <NotificationsPanel
              category={tab.value as OperationsNotificationCategory}
              label={tab.label}
              apiBasePath={apiBasePath}
            />
          </Tabs.Panel>
        ))}
      </Tabs>
    </PageLayout>
  );
}
