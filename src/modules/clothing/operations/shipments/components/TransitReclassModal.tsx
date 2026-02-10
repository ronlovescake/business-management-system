'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Stack,
  Group,
  Button,
  Text,
  Checkbox,
  Textarea,
  NumberInput,
  Select,
  Divider,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconCheck,
  IconPencil,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import type { ShipmentData } from '../types/shipment.types';
import { ShipmentService } from '../services/ShipmentService';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { showConfirm } from '@/lib/alerts';
import { UniversalModal } from '@/components/modals/UniversalModal';

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

  const [editingEntry, setEditingEntry] = useState<TransitBuildEntry | null>(
    null
  );
  const [editOpened, setEditOpened] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);

  const [editPostingDate, setEditPostingDate] = useState<Date | null>(null);
  const [editAmount, setEditAmount] = useState<number>(0);
  const [editCreditAccount, setEditCreditAccount] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');

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

  const creditAccountOptions = useMemo(
    () => [
      { value: 'Cash', label: 'Cash' },
      { value: 'Bank', label: 'Bank' },
      { value: 'E-Wallet', label: 'E-Wallet' },
      { value: 'Accounts Payable', label: 'Accounts Payable' },
      { value: 'Forwarder Payable', label: 'Forwarder Payable' },
      { value: 'Courier Payable', label: 'Courier Payable' },
    ],
    []
  );

  const openEdit = (entry: TransitBuildEntry) => {
    setEditingEntry(entry);
    setEditPostingDate(new Date(entry.postingDate));
    setEditAmount(Number(entry.amount ?? 0));
    setEditCreditAccount(entry.creditAccount);
    setEditNotes(entry.notes ?? '');
    setEditOpened(true);
  };

  const closeEdit = () => {
    setEditOpened(false);
    setEditingEntry(null);
    setEditPostingDate(null);
    setEditAmount(0);
    setEditCreditAccount('');
    setEditNotes('');
  };

  const saveEdit = async () => {
    if (!shipment || !editingEntry || !editPostingDate) {
      return;
    }

    setEditSaving(true);
    try {
      await ShipmentService.updateTransitBuildEntry(
        shipment.id,
        {
          entryId: editingEntry.id,
          postingDate: editPostingDate,
          amount: Number(editAmount ?? 0),
          creditAccount: editCreditAccount,
          notes: editNotes.trim() ? editNotes.trim() : null,
        },
        apiBasePath
      );

      showNotification({
        title: '✅ Updated',
        message: 'Transit build-up entry updated successfully.',
        color: 'green',
      });

      closeEdit();
      await refresh();
    } catch {
      showNotification({
        title: '❌ Error',
        message: 'Failed to update transit build-up entry. Please try again.',
        color: 'red',
      });
    } finally {
      setEditSaving(false);
    }
  };

  const deleteEntry = async (entry: TransitBuildEntry) => {
    if (!shipment) {
      return;
    }

    const confirmed = await showConfirm({
      title: 'Delete Transit Build-Up Entry',
      message: `Delete this entry (${entry.creditAccount} • ₱${Number(entry.amount ?? 0).toFixed(2)})? This is a soft delete and will remove it from selection for reclass.`,
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      type: 'warning',
    });

    if (!confirmed) {
      return;
    }

    setDeleteLoadingId(entry.id);
    try {
      await ShipmentService.deleteTransitBuildEntry(
        shipment.id,
        entry.id,
        apiBasePath
      );

      showNotification({
        title: '🗑️ Deleted',
        message: 'Transit build-up entry deleted.',
        color: 'green',
      });

      await refresh();
    } catch {
      showNotification({
        title: '❌ Error',
        message: 'Failed to delete transit build-up entry. Please try again.',
        color: 'red',
      });
    } finally {
      setDeleteLoadingId(null);
    }
  };

  useEffect(() => {
    if (!opened) {
      return;
    }

    setPostingDate(new Date());
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
    <>
      <UniversalModal
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
                <Group
                  key={entry.idempotencyKey}
                  justify="space-between"
                  align="flex-start"
                  wrap="nowrap"
                  gap="sm"
                >
                  <Checkbox
                    checked={selectedKeys.has(entry.idempotencyKey)}
                    onChange={(e) =>
                      toggleKey(entry.idempotencyKey, e.currentTarget.checked)
                    }
                    label={`${entry.creditAccount} • ₱${Number(entry.amount ?? 0).toFixed(2)}`}
                    description={`Posting date: ${entry.postingDate.slice(0, 10)} • ${entry.debitAccount} → ${entry.creditAccount}`}
                  />

                  <Group gap="xs" wrap="nowrap">
                    <Button
                      size="xs"
                      variant="subtle"
                      leftSection={<IconPencil size={14} />}
                      onClick={() => openEdit(entry)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      leftSection={<IconTrash size={14} />}
                      loading={deleteLoadingId === entry.id}
                      onClick={() => void deleteEntry(entry)}
                    >
                      Delete
                    </Button>
                  </Group>
                </Group>
              ))}
            </Stack>
          )}

          <Divider />

          <DateInput
            label="Posting Date"
            placeholder="Select posting date"
            valueFormat="YYYY-MM-DD"
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
      </UniversalModal>

      <UniversalModal
        opened={editOpened}
        onClose={closeEdit}
        title="Edit Transit Build-Up Entry"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Tip: Editing amounts can affect the reclass total check.
          </Text>

          <DateInput
            label="Posting Date"
            required
            valueFormat="YYYY-MM-DD"
            {...COMMON_DATE_INPUT_PROPS}
            value={editPostingDate}
            onChange={setEditPostingDate}
          />

          <NumberInput
            label="Amount"
            prefix="₱ "
            decimalScale={2}
            min={0}
            value={editAmount}
            onChange={(value) => setEditAmount(Number(value ?? 0))}
          />

          <Select
            label="Credit Account"
            placeholder="Select account"
            data={creditAccountOptions}
            value={editCreditAccount}
            onChange={(value) => setEditCreditAccount(value ?? '')}
            required
          />

          <Textarea
            label="Notes (optional)"
            rows={3}
            value={editNotes}
            onChange={(e) => setEditNotes(e.currentTarget.value)}
          />

          <Group justify="flex-end">
            <Button variant="outline" onClick={closeEdit} disabled={editSaving}>
              Cancel
            </Button>
            <Button onClick={() => void saveEdit()} loading={editSaving}>
              Save
            </Button>
          </Group>
        </Stack>
      </UniversalModal>
    </>
  );
}
