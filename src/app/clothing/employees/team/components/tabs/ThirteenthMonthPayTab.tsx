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
import type { EmployeeThirteenthMonthRecord } from '../../hooks/useEmployeeDetail';

interface ThirteenthMonthPayTabProps {
  isLoading: boolean;
  records: EmployeeThirteenthMonthRecord[];
  totalThirteenthMonthPay: number;
  formatCurrency: (value: number) => string;
  formatOptionalDate: (value?: string | null) => string;
  getStatusColor: (status: EmployeeThirteenthMonthRecord['status']) => string;
}

export function ThirteenthMonthPayTab({
  isLoading,
  records,
  totalThirteenthMonthPay,
  formatCurrency,
  formatOptionalDate,
  getStatusColor,
}: ThirteenthMonthPayTabProps) {
  return (
    <Stack gap="lg">
      <Card withBorder padding="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>13th Month Pay Records</Title>
            <Text size="sm" c="dimmed">
              Total recorded: {formatCurrency(totalThirteenthMonthPay)}
            </Text>
          </div>
          <Badge variant="light" color="violet">
            {records.length} records
          </Badge>
        </Group>
        <Divider my="md" />
        {isLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : records.length === 0 ? (
          <Text c="dimmed">No 13th month entries found for this employee.</Text>
        ) : (
          <ScrollArea h="70vh">
            <Table highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Year</Table.Th>
                  <Table.Th>Net Basic Salary</Table.Th>
                  <Table.Th>13th Month Pay</Table.Th>
                  <Table.Th>Months Credited</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Calculated</Table.Th>
                  <Table.Th>Approved</Table.Th>
                  <Table.Th>Paid</Table.Th>
                  <Table.Th>Notes</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {records.map((record) => (
                  <Table.Tr key={record.id}>
                    <Table.Td>{record.year}</Table.Td>
                    <Table.Td>{formatCurrency(record.netBasicSalary)}</Table.Td>
                    <Table.Td>
                      {formatCurrency(record.thirteenthMonthPay)}
                    </Table.Td>
                    <Table.Td>{record.monthsWorked} mos.</Table.Td>
                    <Table.Td>
                      <Badge
                        color={getStatusColor(record.status)}
                        variant="light"
                      >
                        {record.status.toUpperCase()}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {formatOptionalDate(record.calculatedDate)}
                    </Table.Td>
                    <Table.Td>
                      {formatOptionalDate(record.approvedDate)}
                    </Table.Td>
                    <Table.Td>{formatOptionalDate(record.paidDate)}</Table.Td>
                    <Table.Td>{record.notes?.trim() || '—'}</Table.Td>
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
