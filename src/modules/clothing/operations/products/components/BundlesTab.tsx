'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
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
import { confirmTripleDelete } from '@/utils/confirmTripleDelete';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { BundleService } from '../services/BundleService';
import { ProductService } from '../services/ProductService';
import type { BundleBatch, CreateBundleInput } from '../types/bundle.types';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
  parseDateValue,
} from '@/lib/dateInputConfig';
import { DateInput } from '@mantine/dates';
import type {
  InventoryMovementFromAPI,
  TransactionFromAPI,
} from '@/modules/clothing/operations/inventory/types';
import {
  buildInventoryItems,
  extractApiData,
} from '@/modules/clothing/operations/inventory/lib/inventoryTransforms';
import { normalizeProductCode } from '@/lib/inventory/movements';
import { buildApiPath } from '@/lib/api/paths';
import { createClientId, toInventoryProduct } from '../lib/formHelpers';

type BundleComponentRow = {
  clientId: string;
  productCode: string;
  includedQuantity: number;
};

type BundleFormState = Omit<CreateBundleInput, 'components'> & {
  components: BundleComponentRow[];
};

function createEmptyBundle(): BundleFormState {
  return {
    postingDate: formatDateForInput(new Date()),
    bundleName: '',
    bundleSku: '',
    quantity: 1,
    price: 0,
    components: [
      { clientId: createClientId(), productCode: '', includedQuantity: 1 },
    ],
  };
}

async function confirmTripleDeleteBundle(
  bundleLabel: string
): Promise<boolean> {
  return confirmTripleDelete({
    title: 'Delete bundle batch?',
    warning: `This will permanently delete ${bundleLabel}.`,
    secondaryWarning:
      'This will remove the bundle batch and its inventory movements.',
    finalPrompt: 'Type DELETE to confirm.',
  });
}

interface BundlesTabProps {
  apiBasePath?: string;
}

export function BundlesTab({ apiBasePath }: BundlesTabProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BundleFormState>(() => createEmptyBundle());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBundleSkuManual, setIsBundleSkuManual] = useState(false);
  const [editingBundleId, setEditingBundleId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);

  const bundlesQueryKey = useMemo(
    () => [...queryKeys.bundles.lists(), apiBasePath ?? 'default'],
    [apiBasePath]
  );

  const productsQueryKey = useMemo(
    () => [...queryKeys.products.lists(), apiBasePath ?? 'default'],
    [apiBasePath]
  );

  const { data: bundles = [], isLoading: bundlesLoading } = useQuery({
    queryKey: bundlesQueryKey,
    queryFn: () => BundleService.loadBundles(apiBasePath),
    staleTime: 30 * 1000,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: productsQueryKey,
    queryFn: () => ProductService.loadProducts(apiBasePath),
    staleTime: 30 * 1000,
  });

  const { data: movements = [] } = useQuery<InventoryMovementFromAPI[]>({
    queryKey: ['inventory-movements', apiBasePath ?? 'default'],
    queryFn: async () => {
      const response = await fetch(
        buildApiPath(apiBasePath, '/inventory/movements')
      );
      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as unknown;
      return extractApiData<InventoryMovementFromAPI>(payload);
    },
    staleTime: 30 * 1000,
  });

  const { data: transactions = [] } = useQuery<TransactionFromAPI[]>({
    queryKey: ['transactions', apiBasePath ?? 'default'],
    queryFn: async () => {
      const response = await fetch(buildApiPath(apiBasePath, '/transactions'));
      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as unknown;
      return extractApiData<TransactionFromAPI>(payload);
    },
    staleTime: 30 * 1000,
  });

  const sellableOnHandByCode = useMemo(() => {
    const inventoryProducts = products.map(toInventoryProduct);
    const inventoryItems = buildInventoryItems(
      inventoryProducts,
      transactions,
      [],
      movements
    );

    const map = new Map<string, number>();
    inventoryItems.forEach((item) => {
      const normalized = normalizeProductCode(item.productCode);
      if (!normalized) {
        return;
      }

      map.set(normalized, Math.max(item.sellableOnHand, 0));
    });

    return map;
  }, [movements, products, transactions]);

  const productCodeOptions = useMemo(() => {
    const codes = Array.from(
      new Set(
        products
          .filter((product) => {
            const status = (product['Shipment Status'] ?? '')
              .trim()
              .toLowerCase();
            if (status !== 'delivered' && status !== 'in transit') {
              return false;
            }

            const normalized = normalizeProductCode(product['Product Code']);
            return (sellableOnHandByCode.get(normalized) ?? 0) > 0;
          })
          .map((product) => product['Product Code'])
          .filter((code): code is string => Boolean(code))
          .map((code) => String(code))
      )
    ).sort((a, b) => a.localeCompare(b));

    return codes.map((code) => ({ value: code, label: code }));
  }, [products, sellableOnHandByCode]);

  const filteredBundles = useMemo(() => {
    if (!searchQuery.trim()) {
      return bundles;
    }

    const query = searchQuery.trim().toLowerCase();
    return bundles.filter((bundle) => {
      const componentCodes = (bundle.components ?? [])
        .map((component) => component.componentProductCode)
        .join(' ')
        .toLowerCase();

      return (
        bundle.postingDate.toLowerCase().includes(query) ||
        bundle.bundleName.toLowerCase().includes(query) ||
        bundle.bundleSku.toLowerCase().includes(query) ||
        componentCodes.includes(query)
      );
    });
  }, [bundles, searchQuery]);

  const autoBundleSku = useMemo(() => {
    const bundleName = form.bundleName.trim();
    const postingDate = form.postingDate.trim();
    if (!bundleName || !postingDate) {
      return '';
    }

    return ProductService.generateProductCode(bundleName, postingDate);
  }, [form.bundleName, form.postingDate]);

  useEffect(() => {
    if (isBundleSkuManual) {
      return;
    }

    setForm((prev) => {
      if (prev.bundleSku === autoBundleSku) {
        return prev;
      }
      return {
        ...prev,
        bundleSku: autoBundleSku,
      };
    });
  }, [autoBundleSku, isBundleSkuManual]);

  const createMutation = useMutation({
    mutationFn: async (payload: CreateBundleInput) => {
      return await BundleService.createBundle(payload, apiBasePath);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bundlesQueryKey });
      setForm(createEmptyBundle());
      setIsBundleSkuManual(false);
      setEditingBundleId(null);
      setErrorMessage(null);
    },
    onError: (err) => {
      logger.error('Failed to create bundle', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to create bundle'
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: CreateBundleInput & { id: number }) => {
      return await BundleService.updateBundle(payload, apiBasePath);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bundlesQueryKey });
      setForm(createEmptyBundle());
      setIsBundleSkuManual(false);
      setEditingBundleId(null);
      setErrorMessage(null);
    },
    onError: (err) => {
      logger.error('Failed to update bundle', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to update bundle'
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (bundleId: number) => {
      return await BundleService.deleteBundle(bundleId, apiBasePath);
    },
    onSuccess: (_, bundleId) => {
      queryClient.invalidateQueries({ queryKey: bundlesQueryKey });
      if (editingBundleId === bundleId) {
        setEditingBundleId(null);
        setForm(createEmptyBundle());
        setIsBundleSkuManual(false);
        setIsBundleModalOpen(false);
      }
      setErrorMessage(null);
    },
    onError: (err) => {
      logger.error('Failed to delete bundle', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to delete bundle'
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
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleOpenCreate = () => {
    setForm(createEmptyBundle());
    setEditingBundleId(null);
    setIsBundleSkuManual(false);
    setErrorMessage(null);
    setIsBundleModalOpen(true);
  };

  const handleCloseModal = () => {
    if (isSaving) {
      return;
    }
    setIsBundleModalOpen(false);
  };

  const addComponentRow = () => {
    setForm((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        { clientId: createClientId(), productCode: '', includedQuantity: 1 },
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

    if (editingBundleId) {
      await updateMutation.mutateAsync({ ...payload, id: editingBundleId });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const handleEditBundle = (bundle: BundleBatch) => {
    const autoSku = ProductService.generateProductCode(
      bundle.bundleName,
      bundle.postingDate
    );

    setForm({
      postingDate: bundle.postingDate,
      bundleName: bundle.bundleName,
      bundleSku: bundle.bundleSku,
      quantity: bundle.quantity,
      price: bundle.price,
      components: bundle.components.map((c) => ({
        clientId: createClientId(),
        productCode: c.componentProductCode,
        includedQuantity: c.includedQuantity,
      })),
    });
    setEditingBundleId(bundle.id);
    setIsBundleSkuManual(
      bundle.bundleSku.trim().length > 0 && bundle.bundleSku !== autoSku
    );
    setIsBundleModalOpen(true);
  };

  const handleDeleteBundle = async (bundle: BundleBatch) => {
    const label =
      bundle.bundleSku || bundle.bundleName || `Bundle ${bundle.id}`;
    const confirmed = await confirmTripleDeleteBundle(label);
    if (!confirmed) {
      return;
    }

    await deleteMutation.mutateAsync(bundle.id);
  };

  return (
    <Stack gap="md">
      <UniversalModal
        opened={isBundleModalOpen}
        onClose={handleCloseModal}
        title={editingBundleId ? 'Update Bundle Batch' : 'Create Bundle Batch'}
        size="45%"
      >
        <Stack gap="sm">
          {errorMessage ? (
            <Alert color="red" title="Error">
              {errorMessage}
            </Alert>
          ) : null}

          <SimpleGrid cols={{ base: 1, sm: 2, md: 5 }} spacing="md" mt="lg">
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
              readOnly
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
                    disabled={productsLoading}
                    value={c.productCode || null}
                    onChange={(value) =>
                      updateComponent(idx, { productCode: value || '' })
                    }
                    placeholder={productsLoading ? 'Loading...' : 'Select SKU'}
                    maxDropdownHeight={240}
                  />

                  <NumberInput
                    label={idx === 0 ? 'Included Qty' : undefined}
                    min={1}
                    value={c.includedQuantity}
                    description={`Available: ${sellableOnHandByCode.get(normalizeProductCode(c.productCode)) ?? 0}`}
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

          <Group justify="flex-end">
            <Button
              onClick={handleCreate}
              loading={isSaving}
              disabled={!canSubmit}
            >
              {editingBundleId ? 'Update Bundle' : 'Save Bundle'}
            </Button>
          </Group>
        </Stack>
      </UniversalModal>

      <StandardTableControls
        searchPlaceholder="Search bundles..."
        onSearch={setSearchQuery}
        onAddNew={handleOpenCreate}
        addNewLabel="Create Bundle Batch"
        hideImport
        hideExport
      />

      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {bundlesLoading
                ? 'Loading…'
                : `Showing ${filteredBundles.length} of ${bundles.length} bundle(s)`}
            </Text>
            {productsLoading ? (
              <Text size="xs" c="dimmed">
                Loading product list for SKU dropdown…
              </Text>
            ) : null}
          </Group>
        }
      >
        <StandardDataTable
          headers={[
            'Posting Date',
            'Bundle Name',
            'Bundle SKU',
            'Quantity',
            'Price',
            'Product Code',
            'Left Over Quantity',
            'Action',
          ]}
          colSpan={8}
          emptyState={
            bundlesLoading
              ? 'Loading bundles...'
              : searchQuery
                ? `No bundles found matching "${searchQuery}"`
                : 'No bundles yet.'
          }
        >
          {filteredBundles.map((b) => (
            <Table.Tr key={b.id} onDoubleClick={() => handleEditBundle(b)}>
              <Table.Td style={{ textAlign: 'center' }}>
                {b.postingDate}
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                {b.bundleName}
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>{b.bundleSku}</Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>{b.quantity}</Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
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
              <Table.Td style={{ textAlign: 'center' }}>
                <Button
                  variant="subtle"
                  color="red"
                  onClick={() => void handleDeleteBundle(b)}
                  loading={deleteMutation.isPending}
                >
                  Delete
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </StandardDataTable>
      </StandardTableContainer>
    </Stack>
  );
}
