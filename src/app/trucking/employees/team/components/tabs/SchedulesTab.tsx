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
import type { Schedule } from '@/app/clothing/employees/schedules/types';

interface SchedulesTabProps {
  isLoading: boolean;
  schedules: Schedule[];
  formatOptionalDate: (value?: string | null) => string;
  formatShiftLabel: (shift: Schedule['shiftType']) => string;
  getStatusColor: (status: Schedule['status']) => string;
}

export function SchedulesTab({
  isLoading,
  schedules,
  formatOptionalDate,
  formatShiftLabel,
  getStatusColor,
}: SchedulesTabProps) {
  return (
    <Stack gap="lg">
      <Card withBorder padding="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Schedules</Title>
            <Text size="sm" c="dimmed">
              Showing all {schedules.length} schedules
            </Text>
          </div>
        </Group>
        <Divider my="md" />
        {isLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : schedules.length === 0 ? (
          <Text c="dimmed">No schedules assigned to this employee yet.</Text>
        ) : (
          <ScrollArea h="70vh">
            <Table highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Shift</Table.Th>
                  <Table.Th>Start</Table.Th>
                  <Table.Th>End</Table.Th>
                  <Table.Th>Department</Table.Th>
                  <Table.Th>Position</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {schedules.map((schedule) => (
                  <Table.Tr key={schedule.id}>
                    <Table.Td>{formatOptionalDate(schedule.date)}</Table.Td>
                    <Table.Td>{formatShiftLabel(schedule.shiftType)}</Table.Td>
                    <Table.Td>{schedule.startTime || '—'}</Table.Td>
                    <Table.Td>{schedule.endTime || '—'}</Table.Td>
                    <Table.Td>{schedule.department || '—'}</Table.Td>
                    <Table.Td>{schedule.position || '—'}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={getStatusColor(schedule.status)}
                        variant="light"
                      >
                        {schedule.status.toUpperCase()}
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
