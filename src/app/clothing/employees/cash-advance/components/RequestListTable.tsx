import {
  Card,
  Table,
  Badge,
  ActionIcon,
  Group,
  Box,
  Text,
  Stack,
} from '@mantine/core';
import {
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
  IconCurrencyPeso,
} from '@tabler/icons-react';
import { getActionLabel } from '@/lib/accessibility';
import type { CashAdvance } from '../types';

interface RequestListTableProps {
  requests: CashAdvance[];
  formatDate: (date: string) => string;
  formatCurrency: (amount: number) => string;
  getStatusColor: (status: CashAdvance['status']) => string;
  onEdit: (request: CashAdvance) => void;
  onDelete: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onMarkAsPaid: (id: string) => void;
}

export function RequestListTable({
  requests,
  formatDate,
  formatCurrency,
  getStatusColor,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onMarkAsPaid,
}: RequestListTableProps) {
  const totalAmount = requests.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Card
      shadow="sm"
      radius="md"
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
    >
      <Box style={{ overflowX: 'auto', maxHeight: '71vh', overflowY: 'auto' }}>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Employee</Table.Th>
              <Table.Th>Amount</Table.Th>
              <Table.Th>Purpose</Table.Th>
              <Table.Th>Terms</Table.Th>
              <Table.Th>Request Date</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {requests.length === 0 ? (
              <Table.Tr>
                <Table.Td
                  colSpan={7}
                  style={{ textAlign: 'center', padding: '2rem' }}
                >
                  <Text c="dimmed">No cash advance requests found</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              requests.map((request) => (
                <Table.Tr key={request.id}>
                  <Table.Td>
                    <Text fw={500}>{request.employee}</Text>
                    {request.notes && (
                      <Text size="xs" c="dimmed">
                        {request.notes}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text fw={600}>{formatCurrency(request.amount)}</Text>
                  </Table.Td>
                  <Table.Td>{request.purpose}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{request.terms}</Text>
                  </Table.Td>
                  <Table.Td>{formatDate(request.requestDate)}</Table.Td>
                  <Table.Td>
                    <Stack gap={4}>
                      <Badge
                        color={getStatusColor(request.status)}
                        variant="light"
                      >
                        {request.status.toUpperCase()}
                      </Badge>
                      {request.status === 'approved' && request.approvedBy && (
                        <Text size="xs" c="dimmed">
                          by {request.approvedBy}
                        </Text>
                      )}
                      {request.status === 'rejected' && request.rejectedBy && (
                        <Text size="xs" c="dimmed">
                          by {request.rejectedBy}
                        </Text>
                      )}
                      {request.rejectionReason && (
                        <Text size="xs" c="red">
                          {request.rejectionReason}
                        </Text>
                      )}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      {request.status === 'pending' && (
                        <>
                          <ActionIcon
                            color="green"
                            variant="light"
                            onClick={() => onApprove(request.id)}
                            {...getActionLabel('Approve', 'cash advance request', request.employee)}
                          >
                            <IconCheck size={16} />
                          </ActionIcon>
                          <ActionIcon
                            color="red"
                            variant="light"
                            onClick={() => onReject(request.id)}
                            {...getActionLabel('Reject', 'cash advance request', request.employee)}
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        </>
                      )}
                      {request.status === 'approved' && (
                        <ActionIcon
                          color="blue"
                          variant="light"
                          onClick={() => onMarkAsPaid(request.id)}
                          {...getActionLabel('Mark as paid', 'cash advance', request.employee)}
                        >
                          <IconCurrencyPeso size={16} />
                        </ActionIcon>
                      )}
                      <ActionIcon
                        color="blue"
                        variant="light"
                        onClick={() => onEdit(request)}
                        {...getActionLabel('Edit', 'cash advance request', request.employee)}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="red"
                        variant="light"
                        onClick={() => onDelete(request.id)}
                        {...getActionLabel('Delete', 'cash advance request', request.employee)}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
          {requests.length > 0 && (
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th>Total ({requests.length} requests)</Table.Th>
                <Table.Th>
                  <Text fw={700}>{formatCurrency(totalAmount)}</Text>
                </Table.Th>
                <Table.Th colSpan={5}></Table.Th>
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </Box>
    </Card>
  );
}
