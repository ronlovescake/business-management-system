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
import type { CashAdvance } from '@/app/trucking/employees/cash-advance/types';

interface CashAdvanceTabProps {
  isLoading: boolean;
  cashAdvanceRecords: CashAdvance[];
  outstandingCashAdvance: number;
  formatCurrency: (value: number) => string;
  getStatusColor: (status: CashAdvance['status']) => string;
  formatOptionalDate: (value?: string | null) => string;
}

export function CashAdvanceTab({
  isLoading,
  cashAdvanceRecords,
  outstandingCashAdvance,
  formatCurrency,
  getStatusColor,
  formatOptionalDate,
}: CashAdvanceTabProps) {
  return (
    <Stack gap="lg">
      <Card withBorder padding="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Cash Advance Summary</Title>
            <Text size="sm" c="dimmed">
              Outstanding balance: {formatCurrency(outstandingCashAdvance)}
            </Text>
          </div>
          <Badge variant="light" color="grape">
            {cashAdvanceRecords.length} requests
          </Badge>
        </Group>
        <Divider my="md" />
        {isLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : cashAdvanceRecords.length === 0 ? (
          <Text c="dimmed">
            No cash advance history yet. When this employee requests a cash
            advance it will appear here.
          </Text>
        ) : (
          <ScrollArea h="70vh">
            <Table highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Request Date</Table.Th>
                  <Table.Th>Amount</Table.Th>
                  <Table.Th>Settled</Table.Th>
                  <Table.Th>Remaining</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {cashAdvanceRecords.map((record) => (
                  <Table.Tr key={record.id}>
                    <Table.Td>
                      {formatOptionalDate(record.requestDate)}
                    </Table.Td>
                    <Table.Td>{formatCurrency(record.amount)}</Table.Td>
                    <Table.Td>
                      {formatCurrency(record.settledAmount ?? 0)}
                    </Table.Td>
                    <Table.Td>
                      {formatCurrency(record.remainingBalance ?? 0)}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={getStatusColor(record.status)}
                        variant="light"
                      >
                        {record.status.toUpperCase()}
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
