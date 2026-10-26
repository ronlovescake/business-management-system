'use client';

import React, { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react';
import { api } from '@/lib/api/client';
import { randomUuid } from '@/lib/utils/randomUuid';
import type {
  InventoryValuationIssue,
  InventoryValuationSummary,
} from '@/lib/accounting/inventoryCogsShared';

type Props = {
  valuation?: InventoryValuationSummary;
  canConfirm?: boolean;
  onConfirmed?: () => void | Promise<unknown>;
};

export function InventoryValuationNotice({
  valuation,
  canConfirm = false,
  onConfirmed,
}: Props) {
  const [selected, setSelected] = useState<InventoryValuationIssue | null>(
    null
  );
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  if (!valuation || valuation.complete) {
    return null;
  }

  const save = async () => {
    if (!selected?.movementId) {
      return;
    }
    const payload = { movementId: selected.movementId, reason: reason.trim() };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.fingerprint !== fingerprint) {
      request.current = { fingerprint, key: randomUuid() };
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/api/accounting/inventory-valuation', payload, {
        headers: { 'Idempotency-Key': request.current.key },
      });
      await onConfirmed?.();
      setSelected(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Zero-cost confirmation could not be saved.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Alert
        color="orange"
        title="Profit Incomplete"
        icon={<IconAlertTriangle size={19} />}
        role="alert"
      >
        <Text size="sm" mb="sm">
          Unconfirmed valuation: {valuation.affectedQuantity} units in{' '}
          {valuation.issues.length}{' '}
          {valuation.issues.length === 1 ? 'movement' : 'movements'}.
        </Text>
        <Table.ScrollContainer minWidth={560}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product / Movement</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th>Quantity</Table.Th>
                <Table.Th>Cost Status</Table.Th>
                {canConfirm && <Table.Th>Review</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {valuation.issues.map((issue) => (
                <Table.Tr
                  key={`${issue.movementId ?? `${issue.productCode}:${issue.date}:${issue.direction}`}:${issue.reason}`}
                >
                  <Table.Td>
                    {issue.productCode}
                    <Text size="xs">
                      {issue.movementId
                        ? `Movement #${issue.movementId}`
                        : 'Legacy movement'}{' '}
                      | {issue.direction}
                    </Text>
                  </Table.Td>
                  <Table.Td>{issue.date}</Table.Td>
                  <Table.Td>{issue.quantity}</Table.Td>
                  <Table.Td>
                    {issue.reason === 'LEGACY_PRODUCT_COST'
                      ? 'Current product cost used; snapshot missing'
                      : issue.reason === 'INVALID_COST'
                        ? 'Invalid cost'
                        : 'Cost unknown'}
                  </Table.Td>
                  {canConfirm && (
                    <Table.Td>
                      {issue.movementId && (
                        <Button
                          size="xs"
                          variant="subtle"
                          leftSection={<IconCheck size={14} />}
                          onClick={() => {
                            setSelected(issue);
                            setReason('');
                            setError(null);
                          }}
                        >
                          Confirm zero cost
                        </Button>
                      )}
                    </Table.Td>
                  )}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Alert>
      <UniversalModal
        opened={selected !== null}
        onClose={() => !saving && setSelected(null)}
        title="Confirm genuinely zero-cost goods"
        centered
        closeOnEscape={!saving}
        closeOnClickOutside={!saving}
        closeButtonProps={{ 'aria-label': 'Close valuation confirmation' }}
      >
        <Stack gap="md">
          <Text size="sm">
            {selected?.productCode} | Movement #{selected?.movementId} |{' '}
            {selected?.quantity} units
          </Text>
          <Textarea
            label="Confirmation reason"
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            required
            minRows={3}
            maxLength={1000}
          />
          {error && (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={saving}
              onClick={() => setSelected(null)}
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconCheck size={16} />}
              loading={saving}
              disabled={reason.trim().length < 10}
              onClick={() => void save()}
            >
              Confirm zero-cost goods
            </Button>
          </Group>
        </Stack>
      </UniversalModal>
    </>
  );
}
