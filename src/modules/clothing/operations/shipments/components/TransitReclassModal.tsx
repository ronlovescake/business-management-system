'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  Button,
  Text,
  Checkbox,
  Textarea,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconCheck, IconRefresh } from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import type { ShipmentData } from '../types/shipment.types';
import { ShipmentService } from '../services/ShipmentService';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';

type TransitBuildEntry = {
  id: string;
  postingDate: string;
  amount: number;
  debitAccount: string;
  creditAccount: string;
  idempotencyKey: string;
  notes: string | null;
};

interface TransitReclassModalProps {
  opened: boolean;
  onClose: () => void;
  shipment: ShipmentData | null;
  apiBasePath?: string;
  onSubmit: (input: {
    postingDate: Date;
    selectedIdempotencyKeys: string[];
    notes?: string;
  }) => Promise<boolean>;
}

export function TransitReclassModal({
  opened,
  onClose,
  shipment,
  apiBasePath,
  onSubmit,
}: TransitReclassModalProps) {
  const shipmentCode = (shipment?.['Shipment Code'] ?? '').trim();

  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<TransitBuildEntry[]>([]);
  const [expectedTotalAmount, setExpectedTotalAmount] = useState<number>(0);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const [postingDate, setPostingDate] = useState<Date | null>(new Date());
  const [notes, setNotes] = useState<string>('');

  const refresh = async () => {
    if (!shipment) {
      return;
    }

    setLoading(true);
    try {
      const result = await ShipmentService.fetchTransitBuildEntries(
        shipment.id,
        apiBasePath
      );

      const nextEntries = (result.entries ?? []).slice();
      setEntries(nextEntries);
      setExpectedTotalAmount(Number(result.expectedTotalAmount ?? 0));

      // Default: select all existing entries.
      setSelectedKeys(new Set(nextEntries.map((e) => e.idempotencyKey)));
    } catch {
      setEntries([]);
      setExpectedTotalAmount(0);
      setSelectedKeys(new Set());

      showNotification({
        title: '❌ Error',
        message: 'Failed to load transit build-up entries. Please try again.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!opened) {
      return;
    }

    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, shipment?.id, apiBasePath]);

  const selectedTotal = useMemo(() => {
    const selectedKeySet = selectedKeys;
    return entries
      .filter((e) => selectedKeySet.has(e.idempotencyKey))
      .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
  }, [entries, selectedKeys]);

  const canSubmit =
    Boolean(shipment) &&
    Boolean(shipmentCode) &&
    Boolean(postingDate) &&
    entries.length > 0 &&
    selectedKeys.size > 0;

  const toggleKey = (key: string, checked: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!shipment || !postingDate) {
      return;
    }

    const ok = await onSubmit({
      postingDate,
      selectedIdempotencyKeys: Array.from(selectedKeys),
      notes: notes.trim() ? notes.trim() : undefined,
    });

    if (ok) {
      setNotes('');
      onClose();
    }
  };

  const mismatch =
    Number.isFinite(expectedTotalAmount) &&
    expectedTotalAmount > 0 &&
    Math.abs(expectedTotalAmount - selectedTotal) > 0.01;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        shipmentCode
          ? `Reclass to Stock on Hand • ${shipmentCode}`
          : 'Reclass to Stock on Hand'
      }
      centered
      size="lg"
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Creates: Dr Stock on Hand / Cr Inventory in Transit (per product).
        </Text>

        <Group justify="space-between" align="flex-start">
          <Text size="sm" c={mismatch ? 'red' : 'dimmed'}>
            Expected shipment total: ₱
            {Number(expectedTotalAmount ?? 0).toFixed(2)}
          </Text>
          <Text size="sm" c={mismatch ? 'red' : 'dimmed'}>
            Selected build-up total: ₱{Number(selectedTotal ?? 0).toFixed(2)}
          </Text>
        </Group>

        <Divider />

        <Group justify="space-between">
          <Text fw={600}>Transit build-up entries</Text>
          <Button
            variant="subtle"
            leftSection={<IconRefresh size={16} />}
            onClick={() => void refresh()}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>

        {entries.length === 0 ? (
          <Text size="sm" c="dimmed">
            No transit build-up entries found for this shipment.
          </Text>
        ) : (
          <Stack gap={6}>
            {entries.map((entry) => (
              <Checkbox
                key={entry.idempotencyKey}
                checked={selectedKeys.has(entry.idempotencyKey)}
                onChange={(e) =>
                  toggleKey(entry.idempotencyKey, e.currentTarget.checked)
                }
                label={`${entry.creditAccount} • ₱${Number(entry.amount ?? 0).toFixed(2)}`}
                description={`Posting date: ${entry.postingDate.slice(0, 10)} • ${entry.debitAccount} → ${entry.creditAccount}`}
              />
            ))}
          </Stack>
        )}

        <Divider />

        <DateInput
          label="Posting Date"
          placeholder="Select posting date"
          required
          {...COMMON_DATE_INPUT_PROPS}
          value={postingDate}
          onChange={setPostingDate}
        />

        <Textarea
          label="Notes (optional)"
          placeholder="Optional memo"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            leftSection={<IconCheck size={16} />}
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            Create Reclass Entry
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
