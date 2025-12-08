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
import type { LeaveRequest } from '@/app/trucking/employees/leave-tracker/types';

interface LeaveRequestsTabProps {
  isLoading: boolean;
  leaveRequests: LeaveRequest[];
  currentYear: number;
  annualEntitlement: number;
  usedPaidLeaveDays: number;
  remainingLeaveDays: number;
  formatOptionalDate: (value?: string | null) => string;
  getStatusColor: (status: LeaveRequest['status']) => string;
}

export function LeaveRequestsTab({
  isLoading,
  leaveRequests,
  currentYear,
  annualEntitlement,
  usedPaidLeaveDays,
  remainingLeaveDays,
  formatOptionalDate,
  getStatusColor,
}: LeaveRequestsTabProps) {
  return (
    <Stack gap="lg">
      <Card withBorder padding="lg" bg="blue.0">
        <Group justify="space-between" wrap="nowrap">
          <div>
            <Text size="sm" fw={500} c="dimmed">
              Annual Leave Allocation ({currentYear})
            </Text>
            <Title order={3} mt={4}>
              {remainingLeaveDays} {remainingLeaveDays === 1 ? 'Day' : 'Days'}{' '}
              Remaining
            </Title>
            <Text size="sm" c="dimmed" mt={4}>
              {usedPaidLeaveDays} of {annualEntitlement} days used
            </Text>
          </div>
          <Group gap="xl">
            <div style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed" mb={4}>
                Total Entitlement
              </Text>
              <Badge size="xl" variant="filled" color="blue">
                {annualEntitlement} days
              </Badge>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed" mb={4}>
                Used
              </Text>
              <Badge size="xl" variant="filled" color="orange">
                {usedPaidLeaveDays} days
              </Badge>
            </div>
            <div style={{ textAlign: 'center' }}>
              <Text size="xs" c="dimmed" mb={4}>
                Remaining
              </Text>
              <Badge
                size="xl"
                variant="filled"
                color={remainingLeaveDays > 0 ? 'green' : 'red'}
              >
                {remainingLeaveDays} days
              </Badge>
            </div>
          </Group>
        </Group>
      </Card>

      <Card withBorder padding="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Leave Requests</Title>
            <Text size="sm" c="dimmed">
              Showing all {leaveRequests.length} requests
            </Text>
          </div>
        </Group>
        <Divider my="md" />
        {isLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : leaveRequests.length === 0 ? (
          <Text c="dimmed">No leave requests recorded for this employee.</Text>
        ) : (
          <ScrollArea h="63vh">
            <Table highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Date Range</Table.Th>
                  <Table.Th>Days</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Payment</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {leaveRequests.map((request) => (
                  <Table.Tr key={request.id}>
                    <Table.Td>{request.leaveType}</Table.Td>
                    <Table.Td>
                      {`${formatOptionalDate(request.startDate)} - ${formatOptionalDate(request.endDate)}`}
                    </Table.Td>
                    <Table.Td>{request.numberOfDays}</Table.Td>
                    <Table.Td>
                      <Badge
                        color={getStatusColor(request.status)}
                        variant="light"
                      >
                        {request.status.toUpperCase()}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="outline">
                        {request.paymentStatus.toUpperCase()}
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
