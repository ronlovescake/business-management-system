'use client';

import React, { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Radio,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
} from '@mantine/core';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { IconCheck } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { OrderCancellationPreview } from '@/lib/accounting/customer-money';

type Props = {
  preview: OrderCancellationPreview;
  kind: 'CANCELLED' | 'VOIDED';
  onClose: () => void;
  onSaved: () => void;
};

const currency = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
});

export function OrderCancellationModal({
  preview,
  kind,
  onClose,
  onSaved,
}: Props) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState(kind === 'VOIDED' ? 'REFUND_ALL' : '');
  const [originalDeposit, setOriginalDeposit] = useState<number | string>('');
  const [rate, setRate] = useState('10');
  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const isAdmin =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
  const needsConfirmation =
    mode === 'RETAIN_DEPOSIT' && preview.initialDepositAmount === null;
  const deposit =
    preview.initialDepositAmount ?? (Number(originalDeposit) || 0);
  const retained = mode === 'RETAIN_DEPOSIT' ? deposit : 0;
  const pending =
    Math.round(
      (preview.collectedAmount - preview.priorRefundAmount - retained) * 100
    ) / 100;
  const canSave =
    isAdmin &&
    !preview.reviewRequired &&
    !preview.closed &&
    reason.trim().length >= 3 &&
    (mode === 'RETAIN_DEPOSIT' || mode === 'REFUND_ALL') &&
    pending >= 0 &&
    (!needsConfirmation || (confirmed && Number(originalDeposit) > 0));

  const save = async () => {
    if (!canSave || saving) {
      return;
    }
    const details = {
      kind,
      mode,
      reason: reason.trim(),
      ...(needsConfirmation
        ? {
            originalDeposit: {
              amount: Number(originalDeposit),
              rate: Number(rate),
            },
          }
        : {}),
    };
    const payload = JSON.stringify(details);
    if (request.current?.payload !== payload) {
      request.current = { payload, id: crypto.randomUUID() };
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(
        `/api/transactions/${preview.transactionId}/cancellation`,
        details,
        {
          headers: { 'Idempotency-Key': request.current.id },
        }
      );
      await queryClient.invalidateQueries();
      onSaved();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Unable to save the decision.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <UniversalModal
      opened
      onClose={onClose}
      title={
        kind === 'VOIDED'
          ? 'Supplier failure decision'
          : 'Cancellation decision'
      }
      centered
      size="md"
      closeOnClickOutside={!saving}
      closeOnEscape={!saving}
      withCloseButton={!saving}
    >
      <Stack gap="md">
        {!isAdmin && (
          <Alert color="orange">Administrator approval required.</Alert>
        )}
        {preview.reviewRequired && (
          <Alert color="red">
            Recorded payment history needs administrator review.
          </Alert>
        )}
        {preview.closed && (
          <Alert color="orange">This order is already closed.</Alert>
        )}
        <Group justify="space-between">
          <Text size="sm">Collected</Text>
          <Text fw={600}>{currency.format(preview.collectedAmount)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm">Already repaid</Text>
          <Text fw={600}>{currency.format(preview.priorRefundAmount)}</Text>
        </Group>
        {kind === 'CANCELLED' && (
          <Radio.Group label="Money decision" value={mode} onChange={setMode}>
            <Stack gap="xs" mt="xs">
              <Radio
                value="RETAIN_DEPOSIT"
                label="Keep the agreed original deposit"
                disabled={!isAdmin || saving}
              />
              <Radio
                value="REFUND_ALL"
                label="Emergency full refund"
                disabled={!isAdmin || saving}
              />
            </Stack>
          </Radio.Group>
        )}
        {needsConfirmation && (
          <Stack gap="xs">
            <SegmentedControl
              aria-label="Original deposit rate"
              value={rate}
              onChange={setRate}
              data={[
                { label: '10%', value: '10' },
                { label: '20%', value: '20' },
              ]}
              disabled={!isAdmin || saving}
            />
            <NumberInput
              label="Confirmed original deposit amount"
              value={originalDeposit}
              onChange={setOriginalDeposit}
              min={0.01}
              max={preview.collectedAmount}
              decimalScale={2}
              disabled={!isAdmin || saving}
              required
            />
            <Checkbox
              label="I confirmed the customer's original deposit agreement"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.currentTarget.checked)}
              disabled={!isAdmin || saving}
            />
          </Stack>
        )}
        <Group justify="space-between">
          <Text size="sm">Retained deposit</Text>
          <Text fw={600}>{currency.format(retained)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm">Refund to approve</Text>
          <Text fw={700} c={pending < 0 ? 'red' : undefined}>
            {currency.format(pending)}
          </Text>
        </Group>
        <Textarea
          label="Decision reason"
          required
          value={reason}
          onChange={(event) => setReason(event.currentTarget.value)}
          disabled={!isAdmin || saving}
          maxLength={1000}
          minRows={2}
        />
        {error && (
          <Alert color="red" role="alert">
            {error}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={saving}>
            Back
          </Button>
          <Button
            leftSection={<IconCheck size={16} />}
            onClick={() => void save()}
            loading={saving}
            disabled={!canSave}
          >
            Approve cancellation
          </Button>
        </Group>
      </Stack>
    </UniversalModal>
  );
}
