'use client';

import React, { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Group,
  Indicator,
  Loader,
  Stack,
  Table,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { IconCashBanknote, IconRefresh } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { RefundObligations } from '@/lib/accounting/refund-obligations';

type Props = {
  variant?: 'card' | 'icon';
  asOf?: string;
  from?: string;
  showPaid?: boolean;
  showTrends?: boolean;
};
const currency = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

export function useRefundObligations(
  asOf?: string,
  from?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['clothing-refund-obligations', asOf ?? 'today', from ?? 'all'],
    queryFn: () => {
      const params = new URLSearchParams();
      if (asOf) {
        params.set('asOf', asOf);
      }
      if (from) {
        params.set('from', from);
      }
      const search = params.toString();
      return api.get<RefundObligations>(
        `/api/customers/refund-pending${search ? `?${search}` : ''}`
      );
    },
    staleTime: 15000,
    refetchInterval: 60000,
    enabled,
  });
}

export function RefundPending({
  variant = 'card',
  asOf,
  from,
  showPaid = false,
  showTrends = false,
}: Props) {
  const [opened, setOpened] = useState(false);
  const query = useRefundObligations(asOf, from);
  const { data } = query;
  const summary = data
    ? `${currency.format(data.pendingAmount)} | ${data.transactionCount} orders`
    : 'Refund Pending';
  const list = (
    <UniversalModal
      opened={opened}
      onClose={() => setOpened(false)}
      title="Refund Pending"
      size="xl"
      centered
      closeOnEscape
      closeOnClickOutside
    >
      <Stack gap="md">
        <Group justify="space-between">
          <Text fw={600}>{summary}</Text>
          <Tooltip label="Refresh refunds">
            <ActionIcon
              aria-label="Refresh refunds"
              variant="subtle"
              loading={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
        {query.error && (
          <Alert color="red" role="alert">
            Refund totals could not be loaded.
          </Alert>
        )}
        {query.isLoading ? (
          <Loader size="sm" />
        ) : !data?.items.length ? (
          <Text c="dimmed">No approved refunds pending.</Text>
        ) : (
          <Table.ScrollContainer minWidth={620}>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Customer / Order</Table.Th>
                  <Table.Th>Approved</Table.Th>
                  <Table.Th>Paid</Table.Th>
                  <Table.Th>Pending</Table.Th>
                  <Table.Th>Age</Table.Th>
                  <Table.Th>Decision</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.items.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      {item.customerId ? (
                        <Anchor
                          href={`/clothing/operations/customers/${item.customerId}?refund=${item.id}`}
                        >
                          {item.customerName}
                        </Anchor>
                      ) : (
                        <Text size="sm">{item.customerName}</Text>
                      )}
                      <Text size="xs" c="dimmed">
                        TX-{item.transactionId} | {item.productCode}
                      </Text>
                    </Table.Td>
                    <Table.Td>{currency.format(item.approvedAmount)}</Table.Td>
                    <Table.Td>{currency.format(item.paidAmount)}</Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={700}>
                        {currency.format(item.pendingAmount)}
                      </Text>
                    </Table.Td>
                    <Table.Td>{item.ageDays}d</Table.Td>
                    <Table.Td>
                      <Text size="xs">{item.decisionDate}</Text>
                      <Text size="xs" c="dimmed">
                        {item.reason}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Stack>
    </UniversalModal>
  );

  return (
    <>
      {variant === 'icon' ? (
        <Tooltip
          label={
            query.error
              ? 'Refund totals unavailable'
              : `Refund Pending: ${summary}`
          }
        >
          <Indicator
            label={data?.transactionCount ?? '!'}
            disabled={!query.error && !data?.transactionCount}
            color={query.error ? 'red' : 'orange'}
            size={18}
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              aria-label={`Refund Pending: ${summary}`}
              onClick={() => setOpened(true)}
            >
              {query.isLoading ? (
                <Loader size={16} />
              ) : (
                <IconCashBanknote size={21} />
              )}
            </ActionIcon>
          </Indicator>
        </Tooltip>
      ) : (
        <Group align="stretch" gap="md" mb="md">
          <UnstyledButton
            aria-label="Refund Pending"
            onClick={() => setOpened(true)}
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 8,
              padding: '12px 16px',
              minWidth: 220,
            }}
          >
            <Group justify="space-between" gap="md">
              <Text size="sm" c="dimmed">
                Refund Pending
              </Text>
              <IconCashBanknote size={19} />
            </Group>
            {query.isLoading ? (
              <Loader size="xs" mt="xs" />
            ) : query.error ? (
              <Text size="sm" c="red">
                Unavailable
              </Text>
            ) : (
              <>
                <Text fw={700} size="xl">
                  {currency.format(data?.pendingAmount ?? 0)}
                </Text>
                <Text size="xs" c="dimmed">
                  {data?.transactionCount ?? 0} orders | Oldest{' '}
                  {data?.oldestAgeDays ?? 0}d
                </Text>
              </>
            )}
          </UnstyledButton>
          {showPaid && data && (
            <Stack gap={4} justify="center">
              <Text size="xs" c="dimmed">
                Approved Refunds Paid
              </Text>
              <Text fw={700}>
                {currency.format(data.paidApprovedRefundAmount)}
              </Text>
              <Text size="xs" c="dimmed">
                Approved Retained Deposits
              </Text>
              <Text fw={600}>
                {currency.format(data.retainedDepositAmount)}
              </Text>
            </Stack>
          )}
          {query.error && (
            <Button
              variant="subtle"
              leftSection={<IconRefresh size={16} />}
              onClick={() => void query.refetch()}
            >
              Retry
            </Button>
          )}
        </Group>
      )}
      {showTrends && variant === 'card' && data && (
        <Stack gap="xs" mb="md">
          <Text size="sm" fw={600}>
            Approved Refunds Paid by Month
          </Text>
          {data.paidRefundTrends.length ? (
            <Table aria-label="Approved refunds paid by month" maw={520}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Month</Table.Th>
                  <Table.Th ta="right">Paid</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.paidRefundTrends.map((point) => (
                  <Table.Tr key={point.month}>
                    <Table.Td>{point.month}</Table.Td>
                    <Table.Td ta="right">
                      {currency.format(point.amount)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="sm" c="dimmed">
              No approved refund payouts in this period.
            </Text>
          )}
        </Stack>
      )}
      {list}
    </>
  );
}
