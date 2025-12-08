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
import type { EmployeePayrollRecord } from '../../hooks/useEmployeeDetail';

interface PayrollHistoryTabProps {
  isLoading: boolean;
  payrollHistory: EmployeePayrollRecord[];
  totalPayrollAmount: number;
  formatCurrency: (value: number) => string;
  formatPayrollPeriod: (record: EmployeePayrollRecord) => string;
  getStatusColor: (status: EmployeePayrollRecord['status']) => string;
}

export function PayrollHistoryTab({
  isLoading,
  payrollHistory,
  totalPayrollAmount,
  formatCurrency,
  formatPayrollPeriod,
  getStatusColor,
}: PayrollHistoryTabProps) {
  return (
    <Stack gap="lg">
      <Card withBorder padding="lg">
        <Group justify="space-between" align="flex-start">
          <div>
            <Title order={4}>Payroll History</Title>
            <Text size="sm" c="dimmed">
              Total net pay recorded: {formatCurrency(totalPayrollAmount)}
            </Text>
          </div>
          <Badge variant="light" color="blue">
            {payrollHistory.length} records
          </Badge>
        </Group>
        <Divider my="md" />
        {isLoading ? (
          <Center py="xl">
            <Loader size="sm" />
          </Center>
        ) : payrollHistory.length === 0 ? (
          <Text c="dimmed">No payroll entries yet for this employee.</Text>
        ) : (
          <ScrollArea h="70vh">
            <Table highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Pay Period</Table.Th>
                  <Table.Th>Net Pay</Table.Th>
                  <Table.Th>Gross Pay</Table.Th>
                  <Table.Th>Deductions</Table.Th>
                  <Table.Th>Cash Advance</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {payrollHistory.map((record) => (
                  <Table.Tr key={record.id}>
                    <Table.Td>{formatPayrollPeriod(record)}</Table.Td>
                    <Table.Td>{formatCurrency(record.netPay)}</Table.Td>
                    <Table.Td>{formatCurrency(record.grossPay)}</Table.Td>
                    <Table.Td>
                      {formatCurrency(record.totalDeductions)}
                    </Table.Td>
                    <Table.Td>{formatCurrency(record.cashAdvance)}</Table.Td>
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
