import {
  Badge,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  ScrollArea,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import type { AttendanceRecord } from '@/app/clothing/employees/attendance/types';

interface AttendanceTabProps {
  isLoading: boolean;
  records: AttendanceRecord[];
  formatOptionalDate: (value?: string | null) => string;
  getStatusColor: (status: AttendanceRecord['status']) => string;
}

export function AttendanceTab({
  isLoading,
  records,
  formatOptionalDate,
  getStatusColor,
}: AttendanceTabProps) {
  return (
    <Stack gap="lg">
      <Card withBorder padding="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Attendance Records</Title>
            <Text size="sm" c="dimmed">
              Showing all {records.length} entries
            </Text>
          </div>
        </Group>
        <Divider my="md" />
        {isLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : records.length === 0 ? (
          <Text c="dimmed">No attendance entries found for this employee.</Text>
        ) : (
          <ScrollArea h="70vh">
            <Table highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Time In</Table.Th>
                  <Table.Th>Time Out</Table.Th>
                  <Table.Th>Total Hours</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {records.map((record) => (
                  <Table.Tr key={record.id}>
                    <Table.Td>{formatOptionalDate(record.date)}</Table.Td>
                    <Table.Td>{record.timeIn || '—'}</Table.Td>
                    <Table.Td>{record.timeOut || '—'}</Table.Td>
                    <Table.Td>
                      {Number.isFinite(record.totalHours)
                        ? record.totalHours.toFixed(2)
                        : '0.00'}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={getStatusColor(record.status)}
                        variant="light"
                      >
                        {record.status.replace('-', ' ').toUpperCase()}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Card>
    </Stack>
  );
}
