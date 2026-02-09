import { memo, useMemo, useState } from 'react';
import {
  Card,
  Tabs,
  Stack,
  Text,
  Table,
  Badge,
  Group,
  Button,
  Select,
  NumberInput,
  TextInput,
  Textarea,
  ActionIcon,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import Swal from 'sweetalert2';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { showNotification } from '@mantine/notifications';
import { api, ApiError } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import {
  isCancelledOrderStatus,
  normalizeOrderStatus,
} from '@/lib/transactions/order-status';
import type {
  Order,
  Transaction,
  CustomerStats,
  TransactionRefund,
} from '../types';
import { formatCurrency, formatDate } from '../utils';
import { UniversalModal } from '@/components/modals/UniversalModal';

// ============================================================================
// ORDERS AND TRANSACTIONS TABS
// ============================================================================

interface OrdersAndTransactionsProps {
  customerId: string;
  orders: Order[];
  transactions: Transaction[];
  stats: CustomerStats;
  apiBasePath?: string;
}

export const OrdersAndTransactions = memo(function OrdersAndTransactions({
  customerId,
  orders: _orders,
  transactions,
  stats: _stats,
  apiBasePath,
}: OrdersAndTransactionsProps) {
  const queryClient = useQueryClient();
  const [refundModalOpen, setRefundModalOpen] = useState(false);

  const [refundTransactionId, setRefundTransactionId] = useState<string | null>(
    null
  );
  const [refundDate, setRefundDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState<string>('');
  const [returnedQuantity, setReturnedQuantity] = useState<number | null>(null);
  const [restockBucket, setRestockBucket] = useState<string | null>(null);
  const [refundNotes, setRefundNotes] = useState<string>('');

  const transactionById = useMemo(() => {
    return new Map(transactions.map((t) => [t.id, t] as const));
  }, [transactions]);

  const refundQueryKey = useMemo(
    () =>
      [
        ...queryKeys.customers.detail(customerId),
        'refunds',
        apiBasePath ?? 'default',
      ] as const,
    [apiBasePath, customerId]
  );

  const {
    data: refunds = [],
    isLoading: refundsLoading,
    refetch: refetchRefunds,
  } = useQuery({
    queryKey: refundQueryKey,
    queryFn: async (): Promise<TransactionRefund[]> => {
      try {
        return await api.get<TransactionRefund[]>(
          buildApiPath(apiBasePath, `/customers/${customerId}/refunds`)
        );
      } catch (error) {
        logger.error('Failed to fetch customer refunds:', error);
        return [];
      }
    },
    enabled: !!customerId,
    staleTime: 30 * 1000,
  });

  const totalRefunded = useMemo(() => {
    return refunds.reduce((sum, r) => sum + (r.amount || 0), 0);
  }, [refunds]);

  const getRefundErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError) {
      const payload = error.data;

      if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>;
        const details = record.details;
        if (typeof details === 'string' && details.trim().length > 0) {
          return details;
        }

        const explicit = record.error;
        if (typeof explicit === 'string' && explicit.trim().length > 0) {
          return explicit;
        }

        const message = record.message;
        if (typeof message === 'string' && message.trim().length > 0) {
          return message;
        }
      }

      return `Request failed (${error.status}). Please try again.`;
    }

    return error instanceof Error
      ? error.message
      : 'An unexpected error occurred. Please try again.';
  };

  const createRefundMutation = useMutation({
    mutationFn: async (): Promise<TransactionRefund> => {
      const transactionId = refundTransactionId
        ? Number(refundTransactionId)
        : NaN;

      if (!refundTransactionId || Number.isNaN(transactionId)) {
        throw new Error('Please select a transaction.');
      }

      if (!refundDate || refundDate.trim().length === 0) {
        throw new Error('Please provide a refund date.');
      }

      if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
        throw new Error('Refund amount must be greater than 0.');
      }

      return api.post<TransactionRefund>(
        buildApiPath(apiBasePath, `/customers/${customerId}/refunds`),
        {
          transactionId,
          refundDate,
          amount: refundAmount,
          reason:
            refundReason.trim().length > 0 ? refundReason.trim() : undefined,
          returnedQuantity,
          restockBucket: restockBucket || undefined,
          notes: refundNotes.trim().length > 0 ? refundNotes.trim() : undefined,
        }
      );
    },
    onSuccess: async () => {
      showNotification({
        title: '✅ Refund recorded',
        message: 'The refund has been saved successfully.',
        color: 'green',
        autoClose: 4000,
      });

      setRefundModalOpen(false);
      setRefundTransactionId(null);
      setRefundDate(new Date().toISOString().slice(0, 10));
      setRefundAmount(0);
      setRefundReason('');
      setReturnedQuantity(null);
      setRestockBucket(null);
      setRefundNotes('');

      await queryClient.invalidateQueries({ queryKey: refundQueryKey });
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: getRefundErrorMessage(error),
        color: 'red',
      });
    },
  });

  const deleteRefundMutation = useMutation({
    mutationFn: async (refundId: number): Promise<void> => {
      await api.delete(
        buildApiPath(
          apiBasePath,
          `/customers/${customerId}/refunds/${refundId}`
        )
      );
    },
    onSuccess: async () => {
      showNotification({
        title: 'Refund deleted',
        message: 'The refund has been removed.',
        color: 'green',
        autoClose: 3000,
      });
      await queryClient.invalidateQueries({ queryKey: refundQueryKey });
    },
    onError: (error) => {
      showNotification({
        title: 'Error',
        message: getRefundErrorMessage(error),
        color: 'red',
      });
    },
  });

  const transactionOptions = useMemo(() => {
    return transactions.map((t) => {
      const date = t.orderDate ? formatDate(t.orderDate) : 'No date';
      const code = t.productCode || 'No product code';
      return {
        value: String(t.id),
        label: `#${t.id} • ${code} • ${date}`,
      };
    });
  }, [transactions]);

  const handleDeleteRefund = async (refund: TransactionRefund) => {
    const result = await Swal.fire({
      title: 'Delete refund?',
      text: 'This will hide the refund record (soft delete).',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d33',
    });

    if (!result.isConfirmed) {
      return;
    }

    await deleteRefundMutation.mutateAsync(refund.id);
  };

  const shippedTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const status = normalizeOrderStatus(transaction.orderStatus);
      return status === 'shipped' || status === 'delivered';
    });
  }, [transactions]);

  const cancelledTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      return isCancelledOrderStatus(transaction.orderStatus);
    });
  }, [transactions]);

  const otherTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const status = normalizeOrderStatus(transaction.orderStatus);
      if (isCancelledOrderStatus(status)) {
        return false;
      }
      return status !== 'shipped' && status !== 'delivered';
    });
  }, [transactions]);

  const otherTransactionsTotal = useMemo(() => {
    return otherTransactions.reduce((sum, transaction) => {
      return sum + (transaction.lineTotal ?? 0);
    }, 0);
  }, [otherTransactions]);

  const renderTransactionsTable = (rows: Transaction[]) => {
    if (rows.length === 0) {
      return (
        <Text ta="center" c="dimmed" py="xl">
          No transactions found for this customer
        </Text>
      );
    }

    return (
      <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        <Table striped highlightOnHover>
          <Table.Thead
            style={{
              position: 'sticky',
              top: 0,
              backgroundColor: 'var(--mantine-color-body)',
              zIndex: 1,
            }}
          >
            <Table.Tr>
              <Table.Th>Order Date</Table.Th>
              <Table.Th>Product Code</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Unit Price</Table.Th>
              <Table.Th>Line Total</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((transaction) => (
              <Table.Tr key={transaction.id}>
                <Table.Td>
                  <Text size="sm">{transaction.orderDate || '-'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{transaction.productCode || '-'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{transaction.quantity || 0}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">
                    {formatCurrency(transaction.unitPrice || 0)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text fw={500}>
                    {formatCurrency(transaction.lineTotal || 0)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={
                      normalizeOrderStatus(transaction.orderStatus) ===
                        'shipped' ||
                      normalizeOrderStatus(transaction.orderStatus) ===
                        'delivered'
                        ? 'green'
                        : isCancelledOrderStatus(transaction.orderStatus)
                          ? 'red'
                          : 'blue'
                    }
                    variant="light"
                  >
                    {transaction.orderStatus || 'Pending'}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </div>
    );
  };

  return (
    <Card
      shadow="sm"
      padding="lg"
      radius="md"
      withBorder
      style={{ gridColumn: 'span 2' }}
    >
      <Tabs defaultValue="transactions" keepMounted={false}>
        <Tabs.List grow>
          <Tabs.Tab value="transactions">
            <Stack gap={2} align="center">
              <Text size="sm">Transactions ({otherTransactions.length})</Text>
              <Text size="xs" c="dimmed">
                {formatCurrency(otherTransactionsTotal)} total
              </Text>
            </Stack>
          </Tabs.Tab>
          <Tabs.Tab value="refunds">
            <Stack gap={2} align="center">
              <Text size="sm">Return/Refund ({refunds.length})</Text>
              <Text size="xs" c="dimmed">
                {formatCurrency(totalRefunded)} refunded
              </Text>
            </Stack>
          </Tabs.Tab>
          <Tabs.Tab value="shipped">
            <Stack gap={2} align="center">
              <Text size="sm">Shipped ({shippedTransactions.length})</Text>
              <Text size="xs" c="dimmed">
                Orders in transit
              </Text>
            </Stack>
          </Tabs.Tab>
          <Tabs.Tab value="cancelled">
            <Stack gap={2} align="center">
              <Text size="sm">Cancelled ({cancelledTransactions.length})</Text>
              <Text size="xs" c="dimmed">
                Cancelled orders
              </Text>
            </Stack>
          </Tabs.Tab>
        </Tabs.List>

        {/* Transactions Tab */}
        <Tabs.Panel value="transactions" pt="md">
          {renderTransactionsTable(otherTransactions)}
        </Tabs.Panel>

        {/* Return/Refund Tab */}
        <Tabs.Panel value="refunds" pt="md">
          <Group justify="space-between" mb="sm">
            <Stack gap={0}>
              <Text fw={600}>Refunds</Text>
              <Text size="xs" c="dimmed">
                Record partial refunds and (optional) item returns.
              </Text>
            </Stack>
            <Group gap="xs">
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={() => setRefundModalOpen(true)}
              >
                Record Refund
              </Button>
              <Button variant="light" onClick={() => void refetchRefunds()}>
                Refresh
              </Button>
            </Group>
          </Group>

          {refundsLoading ? (
            <Text ta="center" c="dimmed" py="xl">
              Loading refunds...
            </Text>
          ) : refunds.length === 0 ? (
            <Text ta="center" c="dimmed" py="xl">
              No refunds recorded for this customer
            </Text>
          ) : (
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              <Table striped highlightOnHover>
                <Table.Thead
                  style={{
                    position: 'sticky',
                    top: 0,
                    backgroundColor: 'var(--mantine-color-body)',
                    zIndex: 1,
                  }}
                >
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Transaction</Table.Th>
                    <Table.Th>Returned Qty</Table.Th>
                    <Table.Th>Restock</Table.Th>
                    <Table.Th>Reason</Table.Th>
                    <Table.Th>Notes</Table.Th>
                    <Table.Th style={{ width: 60 }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {refunds.map((refund) => {
                    const tx = transactionById.get(refund.transactionId);
                    const txLabel = tx
                      ? `${tx.productCode || 'No product'} • #${tx.id}`
                      : `#${refund.transactionId}`;

                    return (
                      <Table.Tr key={refund.id}>
                        <Table.Td>
                          <Text size="sm">{formatDate(refund.refundDate)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw={500} c="red">
                            {formatCurrency(refund.amount)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{txLabel}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {refund.returnedQuantity ?? '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{refund.restockBucket ?? '-'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" truncate="end" maw={160}>
                            {refund.reason ?? '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" truncate="end" maw={220}>
                            {refund.notes ?? '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <ActionIcon
                            variant="light"
                            color="red"
                            disabled={deleteRefundMutation.isPending}
                            onClick={() => void handleDeleteRefund(refund)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
          )}

          <UniversalModal
            opened={refundModalOpen}
            onClose={() => setRefundModalOpen(false)}
            title="Record Refund"
            centered
            size="lg"
          >
            <Stack gap="md">
              <Select
                label="Transaction"
                placeholder={
                  transactions.length > 0
                    ? 'Select a transaction'
                    : 'No transactions available'
                }
                data={transactionOptions}
                value={refundTransactionId}
                onChange={setRefundTransactionId}
                searchable
                withAsterisk
                disabled={transactions.length === 0}
              />
              <Group grow>
                <TextInput
                  label="Refund Date"
                  placeholder="YYYY-MM-DD"
                  value={refundDate}
                  onChange={(e) => setRefundDate(e.currentTarget.value)}
                  withAsterisk
                />
                <NumberInput
                  label="Refund Amount"
                  hideControls
                  decimalScale={2}
                  min={0}
                  value={refundAmount === 0 ? undefined : refundAmount}
                  onChange={(value) => {
                    const next =
                      typeof value === 'number' ? value : Number(value);
                    setRefundAmount(Number.isFinite(next) ? next : 0);
                  }}
                  withAsterisk
                />
              </Group>

              <Group grow>
                <NumberInput
                  label="Returned Quantity (optional)"
                  hideControls
                  decimalScale={3}
                  min={0}
                  value={returnedQuantity ?? undefined}
                  onChange={(value) => {
                    if (value === '' || value === undefined || value === null) {
                      setReturnedQuantity(null);
                      return;
                    }
                    const next =
                      typeof value === 'number' ? value : Number(value);
                    setReturnedQuantity(Number.isFinite(next) ? next : null);
                  }}
                />
                <Select
                  label="Restock Bucket (optional)"
                  placeholder="Choose bucket"
                  data={[
                    { value: 'sellable', label: 'sellable' },
                    { value: 'damaged_hold', label: 'damaged_hold' },
                    { value: 'reserved', label: 'reserved' },
                    { value: 'assembly_wip', label: 'assembly_wip' },
                    { value: 'scrap', label: 'scrap' },
                    { value: 'sold', label: 'sold' },
                  ]}
                  value={restockBucket}
                  onChange={setRestockBucket}
                  clearable
                />
              </Group>

              <TextInput
                label="Reason (optional)"
                placeholder="e.g. damaged item"
                value={refundReason}
                onChange={(e) => setRefundReason(e.currentTarget.value)}
              />
              <Textarea
                label="Notes (optional)"
                placeholder="Any additional details..."
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.currentTarget.value)}
                minRows={3}
              />

              <Group justify="flex-end">
                <Button
                  variant="default"
                  onClick={() => setRefundModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  loading={createRefundMutation.isPending}
                  onClick={() => void createRefundMutation.mutateAsync()}
                >
                  Save Refund
                </Button>
              </Group>
            </Stack>
          </UniversalModal>
        </Tabs.Panel>

        {/* Shipped Tab */}
        <Tabs.Panel value="shipped" pt="md">
          {renderTransactionsTable(shippedTransactions)}
        </Tabs.Panel>

        {/* Cancelled Tab */}
        <Tabs.Panel value="cancelled" pt="md">
          {renderTransactionsTable(cancelledTransactions)}
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
});
