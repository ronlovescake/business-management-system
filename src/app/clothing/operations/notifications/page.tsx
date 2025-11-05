'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Center,
  Loader,
  Paper,
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

const TAB_ITEMS = [
  { value: 'transactions', label: 'Transactions' },
  { value: 'products', label: 'Products' },
  { value: 'prices', label: 'Prices' },
  { value: 'shipments', label: 'Shipments' },
];

const TABLE_HEADERS = ['Date', 'Time', 'User', 'Changes'];

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function formatDateParts(isoDate: string): { date: string; time: string } {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return { date: '-', time: '-' };
  }
  return {
    date: dateFormatter.format(parsed),
    time: timeFormatter.format(parsed),
  };
}

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

function GroupedTransactionRow({ group }: { group: GroupedNotification }) {
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
                const { date, time } = formatDateParts(record.createdAt);
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
      const { date, time } = formatDateParts(latest.createdAt);

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
  }, [records, category]);

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
    const { groups, ungroupedRecords } = groupedNotifications;

    tableBody = (
      <>
        {/* Render grouped transactions */}
        {groups.map((group) => (
          <GroupedTransactionRow key={group.id} group={group} />
        ))}

        {/* Render ungrouped records */}
        {ungroupedRecords.map((record: OperationsNotificationRecord) => {
          const { date, time } = formatDateParts(record.createdAt);
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

  return (
    <div style={{ overflowX: 'auto', maxHeight: '75vh', position: 'relative' }}>
      <Table striped highlightOnHover withColumnBorders>
        <Table.Thead
          style={{
            position: 'sticky',
            top: 0,
            backgroundColor: '#f1f3f5',
            zIndex: 10,
          }}
        >
          <Table.Tr>
            {TABLE_HEADERS.map((header) => (
              <Table.Th
                key={header}
                style={{
                  textAlign: 'center',
                  backgroundColor: '#f1f3f5',
                  fontWeight: 600,
                }}
              >
                {header}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{tableBody}</Table.Tbody>
      </Table>
    </div>
  );
}

export default function OperationsNotifications() {
  const [activeTab, setActiveTab] = useState<string>('transactions');

  return (
    <PageLayout size="100%" withPadding={false}>
      <Stack px={40} py="xl" gap="xl">
        <Tabs
          value={activeTab}
          onChange={(value) => setActiveTab(value || 'transactions')}
          style={{
            width: '100%',
            maxWidth: 'min(1800px, 98vw)',
            margin: '0 auto',
          }}
        >
          <Tabs.List grow>
            {TAB_ITEMS.map((tab) => (
              <Tabs.Tab key={tab.value} value={tab.value}>
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>

        <Paper
          withBorder
          radius="lg"
          shadow="md"
          p="xl"
          style={{
            width: '100%',
            maxWidth: 'min(1800px, 98vw)',
            margin: '0 auto',
            minHeight: '90vh',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <NotificationsPanel
            category={activeTab as OperationsNotificationCategory}
            label={
              TAB_ITEMS.find((tab) => tab.value === activeTab)?.label ||
              'Notifications'
            }
          />
        </Paper>
      </Stack>
    </PageLayout>
  );
}
