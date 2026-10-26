'use client';

import React, { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
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
import { IconAdjustments, IconCheck, IconRefresh } from '@tabler/icons-react';
import { api } from '@/lib/api/client';
import { randomUuid } from '@/lib/utils/randomUuid';
import { getCurrentDateISO } from '@/utils/date';
import { formatCurrencyPHP } from '@/lib/accounting/formatters';

type Review = {
  products: Array<{
    id: number;
    productCode: string | null;
    shipmentCode: string | null;
    quantity: number;
    unitCost: number;
  }>;
  capitalizations: Array<{
    id: string;
    ref: string;
    date: string;
    amount: number;
  }>;
  history: Array<{
    id: string;
    date: string;
    productCode: string;
    oldUnitCost: number;
    newUnitCost: number;
    soldDelta: number;
    stockDelta: number;
    approvedBy: string;
    reason: string;
  }>;
};

export function InventoryCostCorrections({
  onSaved,
}: {
  onSaved?: () => void | Promise<unknown>;
}) {
  const [opened, setOpened] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [capitalizationLineId, setCapitalizationLineId] = useState<
    string | null
  >(null);
  const [newCost, setNewCost] = useState<string | number>('');
  const [date, setDate] = useState(getCurrentDateISO());
  const [reason, setReason] = useState('');
  const [confirmZeroCost, setConfirmZeroCost] = useState(false);
  const request = useRef<{ fingerprint: string; key: string } | null>(null);
  const lock = useRef(false);
  const product =
    review?.products.find((item) => String(item.id) === productId) ??
    (review?.products.length === 1 ? review.products[0] : undefined);
  const canSave =
    product &&
    newCost !== '' &&
    Number.isFinite(Number(newCost)) &&
    Number(newCost) >= 0 &&
    Number(newCost) !== product.unitCost &&
    capitalizationLineId &&
    date &&
    date <= getCurrentDateISO() &&
    reason.trim().length >= 10 &&
    (Number(newCost) !== 0 || confirmZeroCost);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setReview(
        await api.get<Review>(
          '/api/accounting/inventory-valuation?review=cost-corrections'
        )
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Cost review could not be loaded.'
      );
      setReview(null);
    } finally {
      setLoading(false);
    }
  };
  const save = async () => {
    if (!canSave || !product || saving || lock.current) {
      return;
    }
    const payload = {
      productId: product.id,
      expectedUnitCost: product.unitCost,
      newUnitCost: Number(newCost),
      date,
      capitalizationLineId,
      reason: reason.trim(),
      ...(Number(newCost) === 0 ? { confirmZeroCost } : {}),
    };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.fingerprint !== fingerprint) {
      request.current = { fingerprint, key: randomUuid() };
    }
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      await api.patch('/api/accounting/inventory-valuation', payload, {
        headers: { 'Idempotency-Key': request.current.key },
      });
      await onSaved?.();
      setOpened(false);
      setNewCost('');
      setReason('');
      setCapitalizationLineId(null);
      setConfirmZeroCost(false);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Dated cost correction could not be saved.'
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <Group justify="flex-end">
        <Button
          variant="subtle"
          leftSection={<IconAdjustments size={16} />}
          onClick={() => {
            setOpened(true);
            void load();
          }}
        >
          Dated cost corrections
        </Button>
      </Group>
      <UniversalModal
        opened={opened}
        onClose={() => !saving && setOpened(false)}
        title="Dated cost corrections"
        size="xl"
        centered
        closeOnEscape={!saving}
        closeOnClickOutside={!saving}
        closeButtonProps={{ 'aria-label': 'Close cost corrections' }}
      >
        <Stack gap="md">
          {loading ? (
            <Loader size="sm" />
          ) : (
            <>
              {error && (
                <Alert color="red" role="alert">
                  {error}
                  <Button
                    variant="subtle"
                    leftSection={<IconRefresh size={14} />}
                    onClick={() => void load()}
                  >
                    Reload review
                  </Button>
                </Alert>
              )}
              {review && (
                <>
                  <Select
                    label="Product lot"
                    searchable
                    data={review.products.map((item) => ({
                      value: String(item.id),
                      label: `${item.productCode ?? 'Unknown product'} | ${item.shipmentCode ?? 'No shipment'} | #${item.id}`,
                    }))}
                    value={product ? String(product.id) : null}
                    onChange={(value) => {
                      setProductId(value);
                      setNewCost('');
                      setCapitalizationLineId(null);
                    }}
                  />
                  {product && (
                    <Text size="sm">
                      {product.quantity} units | Current unit cost{' '}
                      {formatCurrencyPHP(product.unitCost)}
                    </Text>
                  )}
                  <Group grow align="flex-start">
                    <NumberInput
                      label="Confirmed new unit cost"
                      value={newCost}
                      onChange={setNewCost}
                      min={0}
                      decimalScale={6}
                    />
                    <TextInput
                      label="Correction date"
                      type="date"
                      value={date}
                      max={getCurrentDateISO()}
                      onChange={(event) => setDate(event.currentTarget.value)}
                    />
                  </Group>
                  {Number(newCost) === 0 && newCost !== '' && (
                    <Checkbox
                      label="These goods genuinely have zero cost"
                      checked={confirmZeroCost}
                      onChange={(event) =>
                        setConfirmZeroCost(event.currentTarget.checked)
                      }
                    />
                  )}
                  <Select
                    label="Posted capitalization"
                    searchable
                    data={review.capitalizations.map((line) => ({
                      value: line.id,
                      label: `${line.ref} | ${line.date.slice(0, 10)} | ${formatCurrencyPHP(line.amount)}`,
                    }))}
                    value={capitalizationLineId}
                    onChange={setCapitalizationLineId}
                  />
                  <Textarea
                    label="Correction reason"
                    value={reason}
                    onChange={(event) => setReason(event.currentTarget.value)}
                    minRows={2}
                    maxLength={1000}
                  />
                  <Group justify="flex-end">
                    <Button
                      leftSection={<IconCheck size={16} />}
                      loading={saving}
                      disabled={!canSave}
                      onClick={() => void save()}
                    >
                      Record dated allocation
                    </Button>
                  </Group>
                  <Text fw={600}>Correction history</Text>
                  {!review.history.length ? (
                    <Text size="sm" c="dimmed">
                      No dated cost corrections.
                    </Text>
                  ) : (
                    <Table.ScrollContainer minWidth={700}>
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Date / Product</Table.Th>
                            <Table.Th>Unit cost</Table.Th>
                            <Table.Th>Sold delta</Table.Th>
                            <Table.Th>Stock delta</Table.Th>
                            <Table.Th>Approval</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {review.history.map((item) => (
                            <Table.Tr key={item.id}>
                              <Table.Td>
                                {item.date}
                                <Text size="sm">{item.productCode}</Text>
                              </Table.Td>
                              <Table.Td>
                                {formatCurrencyPHP(item.oldUnitCost)} to{' '}
                                {formatCurrencyPHP(item.newUnitCost)}
                              </Table.Td>
                              <Table.Td>
                                {formatCurrencyPHP(item.soldDelta)}
                              </Table.Td>
                              <Table.Td>
                                {formatCurrencyPHP(item.stockDelta)}
                              </Table.Td>
                              <Table.Td>
                                {item.approvedBy}
                                <Text size="sm">{item.reason}</Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Table.ScrollContainer>
                  )}
                </>
              )}
            </>
          )}
        </Stack>
      </UniversalModal>
    </>
  );
}
