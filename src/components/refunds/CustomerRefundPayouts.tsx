'use client';

import React, { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { IconCashBanknote, IconRefresh } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { randomUuid } from '@/lib/utils/randomUuid';
import { getCurrentDateISO } from '@/utils/date';
import { useRefundObligations } from './RefundPending';

const currency = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

export function CustomerRefundPayouts({ customerId }: { customerId: string }) {
  const query = useRefundObligations();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | number>('');
  const [paymentDate, setPaymentDate] = useState(getCurrentDateISO());
  const [method, setMethod] = useState<string | null>('Cash');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const history = (query.data?.history ?? []).filter(
    (item) => String(item.customerId) === customerId
  );
  const pending = history.filter((item) => item.pendingAmount > 0);
  const selected =
    pending.find((item) => item.id === selectedId) ??
    (pending.length === 1 ? pending[0] : undefined);
  const total = pending.reduce((sum, item) => sum + item.pendingAmount, 0);
  const canSave =
    selected &&
    Number(amount) > 0 &&
    Number(amount) <= selected.pendingAmount &&
    method &&
    paymentDate >= selected.decisionDate &&
    paymentDate <= getCurrentDateISO();

  const save = async () => {
    if (!canSave || !selected || saving) {
      return;
    }
    const details = {
      cancellationId: selected.id,
      amount: Number(amount),
      paymentDate,
      method,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    const payload = JSON.stringify(details);
    if (request.current?.payload !== payload) {
      request.current = { payload, id: randomUuid() };
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/customers/${customerId}/refunds/payout`, details, {
        headers: { 'Idempotency-Key': request.current.id },
      });
      await queryClient.invalidateQueries();
      request.current = null;
      setOpened(false);
      setAmount('');
      setNotes('');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Unable to record the payout.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap">
        <div>
          <Text fw={600}>Approved refunds</Text>
          <Text size="sm" c="dimmed">
            {currency.format(total)} pending
          </Text>
        </div>
        <Group gap="xs">
          <Button
            variant="subtle"
            leftSection={<IconRefresh size={16} />}
            onClick={() => void query.refetch()}
          >
            Refresh
          </Button>
          <Button
            leftSection={<IconCashBanknote size={16} />}
            disabled={!pending.length}
            onClick={() => setOpened(true)}
          >
            Record payout
          </Button>
        </Group>
      </Group>
      {query.isLoading ? (
        <Loader size="sm" />
      ) : query.error ? (
        <Alert color="red" role="alert">
          Approved refunds could not be loaded.
        </Alert>
      ) : !history.length ? (
        <Text size="sm" c="dimmed">
          No approved cancellation refunds.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={650}>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order / Approval</Table.Th>
                <Table.Th>Approved</Table.Th>
                <Table.Th>Paid</Table.Th>
                <Table.Th>Pending</Table.Th>
                <Table.Th>Payment history</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {history.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td>
                    <Text size="sm">TX-{item.transactionId}</Text>
                    <Text size="xs" c="dimmed">
                      {item.decisionDate} | {item.createdBy}
                    </Text>
                  </Table.Td>
                  <Table.Td>{currency.format(item.approvedAmount)}</Table.Td>
                  <Table.Td>{currency.format(item.paidAmount)}</Table.Td>
                  <Table.Td>{currency.format(item.pendingAmount)}</Table.Td>
                  <Table.Td>
                    {item.payouts.length ? (
                      item.payouts.map((payout) => (
                        <Text size="xs" key={payout.id}>
                          {payout.paymentDate} |{' '}
                          {currency.format(payout.amount)} | {payout.method} |{' '}
                          {payout.createdBy} | Refund #{payout.refundId}
                        </Text>
                      ))
                    ) : (
                      <Text size="xs" c="dimmed">
                        No payout recorded
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      <UniversalModal
        opened={opened}
        onClose={() => setOpened(false)}
        title="Record actual refund payout"
        centered
        size="md"
        closeOnClickOutside={!saving}
        closeOnEscape={!saving}
        withCloseButton={!saving}
      >
        <Stack gap="md">
          <Select
            label="Approved refund"
            value={selected?.id ?? null}
            onChange={setSelectedId}
            allowDeselect={false}
            data={pending.map((item) => ({
              value: item.id,
              label: `TX-${item.transactionId} | ${currency.format(item.pendingAmount)} pending`,
            }))}
            disabled={saving}
            required
          />
          <NumberInput
            label="Payout amount"
            value={amount}
            onChange={setAmount}
            min={0.01}
            max={selected?.pendingAmount}
            decimalScale={2}
            disabled={saving}
            required
          />
          <TextInput
            label="Actual payment date"
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.currentTarget.value)}
            min={selected?.decisionDate}
            max={getCurrentDateISO()}
            disabled={saving}
            required
          />
          <Select
            label="Payment method"
            data={['Cash', 'GCash', 'Bank Transfer', 'Other']}
            value={method}
            onChange={setMethod}
            disabled={saving}
            required
          />
          <Textarea
            label="Payment notes"
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
            maxLength={1000}
            disabled={saving}
          />
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setOpened(false)}
              disabled={saving}
            >
              Back
            </Button>
            <Button
              leftSection={<IconCashBanknote size={16} />}
              disabled={!canSave}
              loading={saving}
              onClick={() => void save()}
            >
              Save actual payout
            </Button>
          </Group>
        </Stack>
      </UniversalModal>
    </Stack>
  );
}
