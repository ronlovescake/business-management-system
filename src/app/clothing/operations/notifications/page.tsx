'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
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
import {
  StandardDataTable,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';

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
}

interface GroupedNotification {
  id: string;
  transactionId: string | null;
  customerName: string | null;
  productCode: string | null;
  latestDate: string;
  latestTime: string;
  user: string;
  count: number;
  records: OperationsNotificationRecord[];
}

function extractTransactionId(changes: string): string | null {
  // Extract transaction ID from patterns like "Updated transaction #169"
  const match = changes.match(/transaction #(\d+)/i);
  return match ? match[1] : null;
}

function extractCustomerName(changes: string): string | null {
  // Extract customer name from patterns like "Updated transaction #169 - CustomerName (ProductCode)"
  const match = changes.match(/transaction #\d+ - ([^(]+) \(/i);
  return match ? match[1].trim() : null;
}

function extractProductCode(changes: string): string | null {
  // Extract product code from patterns like "Updated transaction #169 - CustomerName (ProductCode)"
  const match = changes.match(/\(([^)]+)\) - Modified:/i);
  return match ? match[1].trim() : null;
}

function GroupedTransactionRow({
  group,
  formatRecordDate,
}: {
  group: GroupedNotification;
  formatRecordDate: (record: OperationsNotificationRecord) => {
    date: string;
    time: string;
  };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <Table.Tr
        style={{
          cursor: 'pointer',
          backgroundColor: expanded ? '#f8f9fa' : undefined,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Table.Td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
          {group.latestDate}
        </Table.Td>
        <Table.Td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
          {group.latestTime}
        </Table.Td>
        <Table.Td style={{ textAlign: 'center' }}>{group.user}</Table.Td>
        <Table.Td>
          <Group gap="xs" wrap="nowrap">
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
            >
              {expanded ? (
                <IconChevronDown size={16} />
              ) : (
                <IconChevronRight size={16} />
              )}
            </ActionIcon>
            <Stack gap={2}>
              <Group gap="xs">
                <Text size="sm" fw={500}>
                  Transaction #{group.transactionId}
                </Text>
                {group.count > 1 && (
                  <Badge size="sm" variant="light" color="blue">
                    {group.count} updates
                  </Badge>
                )}
              </Group>
              {group.customerName && (
                <Text size="xs" c="dimmed">
                  Customer:{' '}
                  <Text span fw={500}>
                    {group.customerName}
                  </Text>
                  {group.productCode && (
                    <Text span> · Product: {group.productCode}</Text>
                  )}
                </Text>
              )}
            </Stack>
          </Group>
        </Table.Td>
      </Table.Tr>
      <Table.Tr>
        <Table.Td colSpan={4} p={0}>
          <Collapse in={expanded}>
            <Stack gap={0} p="xs" pl="xl" bg="#f8f9fa">
              {group.records.map((record) => {
                const { date, time } = formatRecordDate(record);
                return (
                  <Group key={record.id} gap="md" py="xs" px="md">
                    <Text size="xs" c="dimmed" style={{ minWidth: 80 }}>
                      {date}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ minWidth: 90 }}>
                      {time}
                    </Text>
                    <Text size="sm" style={{ flex: 1 }}>
                      {record.changes}
                    </Text>
                  </Group>
                );
              })}
            </Stack>
          </Collapse>
        </Table.Td>
      </Table.Tr>
    </>
  );
}

function NotificationsPanel({ category, label }: NotificationsPanelProps) {
  // Force Asia/Manila timezone for Philippines
  const timezone = 'Asia/Manila';

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
        timeZone: timezone,
      }),
    []
  );

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: timezone,
      }),
    []
  );

  const getRecordDateParts = useCallback(
    (record: OperationsNotificationRecord): { date: string; time: string } => {
      const parsed = new Date(record.createdAt);
      if (Number.isNaN(parsed.getTime())) {
        return { date: '-', time: '-' };
      }

      return {
        date: dateFormatter.format(parsed),
        time: timeFormatter.format(parsed),
      };
    },
    [dateFormatter, timeFormatter]
  );

  const [searchQuery, setSearchQuery] = useState('');

  const queryKey = useMemo(
    () => queryKeys.operationsNotifications.list(category),
    [category]
  );

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () =>
      OperationsNotificationsService.fetchList({
        category,
        limit: 200,
      }),
    staleTime: 30_000,
  });

  const records = useMemo(() => data ?? [], [data]);

  // Group notifications by transaction ID
  const groupedNotifications = useMemo(() => {
    const groups: GroupedNotification[] = [];
    const transactionGroups = new Map<string, OperationsNotificationRecord[]>();
    const ungroupedRecords: OperationsNotificationRecord[] = [];

    // First pass: group by transaction ID
    records.forEach((record) => {
      const transactionId = extractTransactionId(record.changes);

      if (transactionId && category === 'transactions') {
        const existing = transactionGroups.get(transactionId);
        if (existing) {
          existing.push(record);
        } else {
          transactionGroups.set(transactionId, [record]);
        }
      } else {
        ungroupedRecords.push(record);
      }
    });

    // Convert transaction groups to GroupedNotification objects
    transactionGroups.forEach((groupRecords, transactionId) => {
      // Sort by date descending (most recent first)
      groupRecords.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const latest = groupRecords[0];
      const { date, time } = getRecordDateParts(latest);

      // Extract customer name and product code from the latest record
      const customerName = extractCustomerName(latest.changes);
      const productCode = extractProductCode(latest.changes);

      groups.push({
        id: `group-${transactionId}`,
        transactionId,
        customerName,
        productCode,
        latestDate: date,
        latestTime: time,
        user: latest.user ?? 'Operations',
        count: groupRecords.length,
        records: groupRecords,
      });
    });

    // Sort groups by latest date descending
    groups.sort(
      (a, b) =>
        new Date(b.records[0].createdAt).getTime() -
        new Date(a.records[0].createdAt).getTime()
    );

    return { groups, ungroupedRecords };
  }, [records, category, getRecordDateParts]);

  // Filter based on search query
  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) {
      return groupedNotifications;
    }

    const query = searchQuery.toLowerCase();
    const { groups, ungroupedRecords } = groupedNotifications;

    // Filter grouped transactions
    const filteredGroups = groups.filter((group) => {
      // Check transaction ID
      if (group.transactionId?.includes(query)) {
        return true;
      }

      // Check customer name
      if (group.customerName?.toLowerCase().includes(query)) {
        return true;
      }

      // Check product code
      if (group.productCode?.toLowerCase().includes(query)) {
        return true;
      }

      // Check user
      if (group.user.toLowerCase().includes(query)) {
        return true;
      }

      // Check date or time
      if (group.latestDate.toLowerCase().includes(query)) {
        return true;
      }
      if (group.latestTime.toLowerCase().includes(query)) {
        return true;
      }

      // Check any of the individual record changes
      return group.records.some((record) =>
        record.changes.toLowerCase().includes(query)
      );
    });

    // Filter ungrouped records
    const filteredUngrouped = ungroupedRecords.filter((record) => {
      const { date, time } = getRecordDateParts(record);
      return (
        record.changes.toLowerCase().includes(query) ||
        (record.user ?? 'Operations').toLowerCase().includes(query) ||
        date.toLowerCase().includes(query) ||
        time.toLowerCase().includes(query)
      );
    });

    return { groups: filteredGroups, ungroupedRecords: filteredUngrouped };
  }, [groupedNotifications, searchQuery, getRecordDateParts]);

  let tableBody: ReactNode;

  if (isLoading) {
    tableBody = (
      <Table.Tr>
        <Table.Td colSpan={TABLE_HEADERS.length}>
          <Center mih={120}>
            <Loader size="sm" />
          </Center>
        </Table.Td>
      </Table.Tr>
    );
  } else if (isError) {
    tableBody = (
      <Table.Tr>
        <Table.Td colSpan={TABLE_HEADERS.length}>
          <Alert
            variant="light"
            color="red"
            icon={<IconAlertCircle size={16} />}
          >
            Failed to load {label.toLowerCase()}.
          </Alert>
        </Table.Td>
      </Table.Tr>
    );
  } else if (records.length === 0) {
    tableBody = (
      <Table.Tr>
        <Table.Td colSpan={TABLE_HEADERS.length}>
          <Text size="sm" c="dimmed" ta="center">
            No {label.toLowerCase()} yet.
          </Text>
        </Table.Td>
      </Table.Tr>
    );
  } else {
    const { groups, ungroupedRecords } = filteredNotifications;

    // Check if search returned no results
    if (groups.length === 0 && ungroupedRecords.length === 0) {
      tableBody = (
        <Table.Tr>
          <Table.Td colSpan={TABLE_HEADERS.length}>
            <Text size="sm" c="dimmed" ta="center">
              No notifications found matching &quot;{searchQuery}&quot;
            </Text>
          </Table.Td>
        </Table.Tr>
      );
    } else {
      tableBody = (
        <>
          {/* Render grouped transactions */}
          {groups.map((group) => (
            <GroupedTransactionRow
              key={group.id}
              group={group}
              formatRecordDate={getRecordDateParts}
            />
          ))}

          {/* Render ungrouped records */}
          {ungroupedRecords.map((record: OperationsNotificationRecord) => {
            const { date, time } = getRecordDateParts(record);
            return (
              <Table.Tr key={record.id}>
                <Table.Td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {date}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {time}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {record.user ?? 'Operations'}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{record.changes}</Text>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </>
      );
    }
  }

  return (
    <Stack gap="md">
      <StandardTableControls
        searchPlaceholder="Search notifications..."
        onSearch={setSearchQuery}
        hideImport
        hideExport
        hideAddNew
      />
      <StandardDataTable headers={TABLE_HEADERS}>{tableBody}</StandardDataTable>
    </Stack>
  );
}

export default function OperationsNotifications() {
  const [activeTab, setActiveTab] = useState<string>('transactions');

  return (
    <PageLayout fluid withPadding>
      <Stack gap="lg">
        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value || 'transactions')}
        >
          <Tabs.List grow>
            {TAB_ITEMS.map((tab) => (
              <Tabs.Tab key={tab.value} value={tab.value}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        <NotificationsPanel
          category={activeTab as OperationsNotificationCategory}
          label={
            TAB_ITEMS.find((tab) => tab.value === activeTab)?.label ||
            'Notifications'
          }
        />
      </Stack>
    </PageLayout>
  );
}
