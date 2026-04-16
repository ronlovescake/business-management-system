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
  Paper,
  SimpleGrid,
  ThemeIcon,
  Table,
  Badge,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconCheck,
  IconPencil,
  IconRefresh,
  IconTrash,
  IconArrowsExchange,
} from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import type { ShipmentData } from '../types/shipment.types';
import { ShipmentService } from '../services/ShipmentService';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { showConfirm, showCustomAlert } from '@/lib/alerts';
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

const formatPhpAmount = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const escapeHtml = (value: unknown) =>
  (value ?? '').toString().replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });

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
      message: `Delete this entry (${entry.creditAccount} • ₱${formatPhpAmount(Number(entry.amount ?? 0))})? This is a soft delete and will remove it from selection for reclass.`,
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

    const selectedCount = entries.filter((entry) =>
      selectedKeys.has(entry.idempotencyKey)
    ).length;

    const promptResult = await showCustomAlert({
      title: `Confirm Reclass • ${shipmentCode || 'Shipment'}`,
      icon: 'question',
      width: '44rem',
      showCancelButton: true,
      confirmButtonText: 'Create Reclass Entry',
      cancelButtonText: 'Cancel',
      focusCancel: true,
      html: `
        <div style="text-align: left;">
          <div style="border: 1px solid #dee2e6; border-radius: 10px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tbody>
                <tr>
                  <td style="padding: 10px 12px; background: #f8f9fa; font-weight: 600; width: 42%;">Posting Date</td>
                  <td style="padding: 10px 12px;">${escapeHtml(postingDate.toISOString().slice(0, 10))}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; background: #f8f9fa; font-weight: 600;">Selected Entries</td>
                  <td style="padding: 10px 12px;">${escapeHtml(selectedCount)}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; background: #f8f9fa; font-weight: 600;">Expected Reclass Total</td>
                  <td style="padding: 10px 12px;">₱${escapeHtml(formatPhpAmount(expectedTotalAmount))}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 12px; background: #f8f9fa; font-weight: 700;">Selected Build-Up Total</td>
                  <td style="padding: 10px 12px; font-weight: 700;">₱${escapeHtml(formatPhpAmount(selectedTotal))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `,
    });

    if (!promptResult.isConfirmed) {
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
        size="72rem"
      >
        <Stack gap="lg">
          <Stack align="center" gap="xs">
            <ThemeIcon size={72} radius="xl" variant="light" color="blue">
              <IconArrowsExchange size={36} />
            </ThemeIcon>

            <Text size="sm" c="dimmed" ta="center" maw={760}>
              Creates: Dr Stock on Hand / Cr Inventory in Transit (per product).
              Select which active transit build-up entries should be included in
              this reclass.
            </Text>
          </Stack>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper
              withBorder
              radius="md"
              p="md"
              style={{
                background: mismatch ? '#fff5f5' : '#f8fbff',
                borderColor: mismatch ? '#ffc9c9' : '#d0ebff',
              }}
            >
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                Expected Reclass Total
              </Text>
              <Text size="xl" fw={700} c={mismatch ? 'red' : 'dark'}>
                ₱{formatPhpAmount(Number(expectedTotalAmount ?? 0))}
              </Text>
            </Paper>

            <Paper
              withBorder
              radius="md"
              p="md"
              style={{
                background: mismatch ? '#fff5f5' : '#f8fbff',
                borderColor: mismatch ? '#ffc9c9' : '#d0ebff',
              }}
            >
              <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                Selected Build-Up Total
              </Text>
              <Text size="xl" fw={700} c={mismatch ? 'red' : 'dark'}>
                ₱{formatPhpAmount(Number(selectedTotal ?? 0))}
              </Text>
            </Paper>
          </SimpleGrid>

          <Paper withBorder radius="md" p="md">
            <Stack gap="md">
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={700}>Transit build-up entries</Text>
                  <Text size="sm" c="dimmed">
                    Review the active transit build-up lines before creating the
                    stock-on-hand reclass.
                  </Text>
                </div>

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
                <div
                  style={{
                    border: '1px solid #e9ecef',
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  <Table striped highlightOnHover withTableBorder={false}>
                    <Table.Thead style={{ background: '#f8f9fa' }}>
                      <Table.Tr>
                        <Table.Th style={{ width: '10rem' }}>Include</Table.Th>
                        <Table.Th>Credit Account</Table.Th>
                        <Table.Th>Posting Date</Table.Th>
                        <Table.Th ta="right">Amount</Table.Th>
                        <Table.Th style={{ width: '12rem' }}>Actions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {entries.map((entry) => (
                        <Table.Tr key={entry.idempotencyKey}>
                          <Table.Td>
                            <Checkbox
                              checked={selectedKeys.has(entry.idempotencyKey)}
                              onChange={(e) =>
                                toggleKey(
                                  entry.idempotencyKey,
                                  e.currentTarget.checked
                                )
                              }
                              label="Use"
                            />
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={4}>
                              <Text fw={600}>{entry.creditAccount}</Text>
                              <Badge
                                variant="light"
                                color="gray"
                                w="fit-content"
                              >
                                {entry.debitAccount} → {entry.creditAccount}
                              </Badge>
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <Text>{entry.postingDate.slice(0, 10)}</Text>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600}>
                              ₱{formatPhpAmount(Number(entry.amount ?? 0))}
                            </Text>
                          </Table.Td>
                          <Table.Td>
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
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
              )}
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Stack gap="md">
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
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.currentTarget.value)}
              />
            </Stack>
          </Paper>

          <Group justify="center" mt="xs">
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
