'use client';

import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { BundleService } from '../services/BundleService';
import type { CreateBundleInput } from '../types/bundle.types';
import { PriceService } from '../../prices/services/PriceService';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
  parseDateValue,
} from '@/lib/dateInputConfig';
import { DateInput } from '@mantine/dates';

type BundleComponentRow = {
  clientId: string;
  productCode: string;
  includedQuantity: number;
};

type BundleFormState = Omit<CreateBundleInput, 'components'> & {
  components: BundleComponentRow[];
};

function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyBundle(): BundleFormState {
  return {
    postingDate: formatDateForInput(new Date()),
    bundleName: '',
    bundleSku: '',
    quantity: 1,
    price: 0,
    components: [
      { clientId: newClientId(), productCode: '', includedQuantity: 1 },
    ],
  };
}

export function BundlesTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BundleFormState>(() => createEmptyBundle());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: bundles = [], isLoading: bundlesLoading } = useQuery({
    queryKey: queryKeys.bundles.lists(),
    queryFn: () => BundleService.loadBundles(),
    staleTime: 30 * 1000,
  });

  const { data: prices = [], isLoading: pricesLoading } = useQuery({
    queryKey: queryKeys.prices.lists(),
    queryFn: () => PriceService.loadPrices(),
    staleTime: 5 * 60 * 1000,
  });

  const productCodeOptions = useMemo(() => {
    const codes = Array.from(
      new Set(prices.map((p) => p['Product Code']).filter(Boolean))
    )
      .map((code) => String(code))
      .sort((a, b) => a.localeCompare(b));

    return codes.map((code) => ({ value: code, label: code }));
  }, [prices]);

  const createMutation = useMutation({
    mutationFn: async (payload: CreateBundleInput) => {
      return await BundleService.createBundle(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bundles.lists() });
      setForm(createEmptyBundle());
      setErrorMessage(null);
    },
    onError: (err) => {
      logger.error('Failed to create bundle', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to create bundle'
      );
    },
  });

  const canSubmit =
    form.postingDate.trim() &&
    form.bundleName.trim() &&
    form.bundleSku.trim() &&
    form.quantity > 0 &&
    form.price >= 0 &&
    form.components.some((c) => c.productCode.trim() && c.includedQuantity > 0);

  const addComponentRow = () => {
    setForm((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        { clientId: newClientId(), productCode: '', includedQuantity: 1 },
      ],
    }));
  };

  const removeComponentRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
  };

  const updateComponent = (
    index: number,
    patch: Partial<BundleComponentRow>
  ) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.map((c, i) =>
        i === index ? { ...c, ...patch } : c
      ),
    }));
  };

  const handleCreate = async () => {
    setErrorMessage(null);

    const payload: CreateBundleInput = {
      postingDate: form.postingDate.trim(),
      bundleName: form.bundleName.trim(),
      bundleSku: form.bundleSku.trim(),
      quantity: Number(form.quantity),
      price: Number(form.price),
      components: form.components
        .map((c) => ({
          productCode: c.productCode.trim(),
          includedQuantity: Number(c.includedQuantity),
        }))
        .filter((c) => c.productCode && c.includedQuantity > 0),
    };

    await createMutation.mutateAsync(payload);
  };

  return (
    <Stack gap="md">
      <Card withBorder radius="md" p="md">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text fw={600}>Create Bundle Batch</Text>
              <Text size="sm" c="dimmed">
                Log a dated bundle SKU and its component SKUs.
              </Text>
            </div>
            <Button
              onClick={handleCreate}
              loading={createMutation.isPending}
              disabled={!canSubmit}
            >
              Save Bundle
            </Button>
          </Group>

          {errorMessage ? (
            <Alert color="red" title="Error">
              {errorMessage}
            </Alert>
          ) : null}

          <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md">
            <DateInput
              label="Posting Date"
              value={parseDateValue(form.postingDate)}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  postingDate: formatDateForInput(value),
                }))
              }
              {...COMMON_DATE_INPUT_PROPS}
            />

            <TextInput
              label="Bundle Name"
              value={form.bundleName}
              onChange={(e) => {
                const nextValue = e.currentTarget.value;
                setForm((prev) => ({
                  ...prev,
                  bundleName: nextValue,
                }));
              }}
              placeholder="BUNDLE A"
            />

            <TextInput
              label="Bundle SKU"
              value={form.bundleSku}
              onChange={(e) => {
                const nextValue = e.currentTarget.value;
                setForm((prev) => ({
                  ...prev,
                  bundleSku: nextValue,
                }));
              }}
              placeholder="BUNDLE A (BA-011326)"
            />

            <NumberInput
              label="Quantity"
              min={1}
              value={form.quantity}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  quantity: typeof value === 'number' ? value : 1,
                }))
              }
              description="Usually 1 (one bundle lot)"
            />

            <NumberInput
              label="Price"
              min={0}
              value={form.price}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  price: typeof value === 'number' ? value : 0,
                }))
              }
              decimalScale={2}
              fixedDecimalScale
            />
          </SimpleGrid>

          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text fw={500}>Bundled Products</Text>
              <Button variant="default" onClick={addComponentRow}>
                Add SKU
              </Button>
            </Group>

            <Stack gap="xs">
              {form.components.map((c, idx) => (
                <SimpleGrid
                  key={c.clientId}
                  cols={{ base: 1, sm: 2, md: 3 }}
                  spacing="md"
                >
                  <Select
                    label={idx === 0 ? 'Product Code' : undefined}
                    data={productCodeOptions}
                    searchable
                    clearable
                    disabled={pricesLoading}
                    value={c.productCode || null}
                    onChange={(value) =>
                      updateComponent(idx, { productCode: value || '' })
                    }
                    placeholder={pricesLoading ? 'Loading...' : 'Select SKU'}
                    styles={{ dropdown: { maxHeight: 240 } }}
                  />

                  <NumberInput
                    label={idx === 0 ? 'Included Qty' : undefined}
                    min={1}
                    value={c.includedQuantity}
                    onChange={(value) =>
                      updateComponent(idx, {
                        includedQuantity: typeof value === 'number' ? value : 1,
                      })
                    }
                  />

                  <Group align="end" h="100%" justify="flex-start">
                    <Button
                      variant="subtle"
                      color="red"
                      disabled={form.components.length <= 1}
                      onClick={() => removeComponentRow(idx)}
                    >
                      Remove
                    </Button>
                  </Group>
                </SimpleGrid>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </Card>

      <Card withBorder radius="md" p="md">
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Bundles</Text>
          <Text size="sm" c="dimmed">
            {bundlesLoading ? 'Loading…' : `${bundles.length} bundle(s)`}
          </Text>
        </Group>

        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Posting Date</Table.Th>
              <Table.Th>Bundle Name</Table.Th>
              <Table.Th>Bundle SKU</Table.Th>
              <Table.Th>Quantity</Table.Th>
              <Table.Th>Price</Table.Th>
              <Table.Th>Product Code</Table.Th>
              <Table.Th>Left Over Quantity</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {bundles.map((b) => (
              <Table.Tr key={b.id}>
                <Table.Td>{b.postingDate}</Table.Td>
                <Table.Td>{b.bundleName}</Table.Td>
                <Table.Td>{b.bundleSku}</Table.Td>
                <Table.Td>{b.quantity}</Table.Td>
                <Table.Td>
                  {Number.isFinite(b.price) ? b.price.toFixed(2) : b.price}
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    {b.components?.map((c) => (
                      <Text key={c.id} size="sm">
                        {c.componentProductCode}
                      </Text>
                    ))}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    {b.components?.map((c) => (
                      <Text key={c.id} size="sm">
                        {c.includedQuantity}
                      </Text>
                    ))}
                  </Stack>
                </Table.Td>
              </Table.Tr>
            ))}
            {!bundlesLoading && bundles.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={7}>
                  <Text c="dimmed" size="sm">
                    No bundles yet.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>

        {pricesLoading ? (
          <Text mt="sm" size="xs" c="dimmed">
            Loading price list for SKU dropdown…
          </Text>
        ) : null}
      </Card>
    </Stack>
  );
}
