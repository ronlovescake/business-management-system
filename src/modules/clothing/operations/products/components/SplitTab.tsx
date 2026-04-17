'use client';

import React, { useMemo, useState } from 'react';
import {
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
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import { UniversalModal } from '@/components/modals/UniversalModal';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
  parseDateValue,
} from '@/lib/dateInputConfig';
import { DateInput } from '@mantine/dates';
import { ProductService } from '../services/ProductService';
import { buildApiPath } from '@/lib/api/paths';
import { confirmTripleDelete } from '@/utils/confirmTripleDelete';
import { showCustomAlert } from '@/lib/alerts';
import type {
  InventoryMovementFromAPI,
  SplitBatchFromAPI,
  TransactionFromAPI,
} from '@/modules/clothing/operations/inventory/types';
import {
  buildInventoryItems,
  extractApiData,
} from '@/modules/clothing/operations/inventory/lib/inventoryTransforms';
import { normalizeProductCode } from '@/lib/inventory/movements';
import { queryKeys } from '@/lib/queryKeys';
import type { ProductData } from '../types/product.types';
import { createClientId, toInventoryProduct } from '../lib/formHelpers';

type SplitRow = {
  id: number;
  postingDate: string;
  splitName: string;
  splitSku: string;
  componentLabels: string[];
  componentSkus: string[];
  componentPrices: number[];
  includedQuantities: number[];
};

type SplitComponentFormRow = {
  clientId: string;
  componentLabel: string;
  componentSku: string;
  componentPrice: number;
  includedQuantity: number;
  isSkuManual: boolean;
};

type SplitFormState = {
  postingDate: string;
  splitSku: string;
  components: SplitComponentFormRow[];
};

function createEmptySplitForm(): SplitFormState {
  return {
    postingDate: formatDateForInput(new Date()),
    splitSku: '',
    components: [
      {
        clientId: createClientId(),
        componentLabel: '',
        componentSku: '',
        componentPrice: 0,
        includedQuantity: 1,
        isSkuManual: false,
      },
      {
        clientId: createClientId(),
        componentLabel: '',
        componentSku: '',
        componentPrice: 0,
        includedQuantity: 1,
        isSkuManual: false,
      },
    ],
  };
}

async function confirmTripleDeleteSplit(splitLabel: string): Promise<boolean> {
  return confirmTripleDelete({
    title: 'Delete split batch?',
    warning: `This will permanently delete ${splitLabel}.`,
    secondaryWarning:
      'This will remove the split batch definition. Auto-created child products will NOT be deleted.',
    finalPrompt: 'Type DELETE to confirm.',
  });
}

interface SplitTabProps {
  apiBasePath?: string;
}

function getParentOptionLabel(product: ProductData): string {
  const productName = String(product.Product ?? '').trim();
  const productCode = String(product['Product Code'] ?? '').trim();

  return productCode || productName;
}

function generateChildSku(label: string, postingDate: string): string {
  const trimmedLabel = label.trim();
  const trimmedPostingDate = postingDate.trim();

  if (!trimmedLabel || !trimmedPostingDate) {
    return '';
  }

  return ProductService.generateProductCode(trimmedLabel, trimmedPostingDate);
}

function formatPrice(value: number): string {
  return `₱${Number(value || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function SplitTab({ apiBasePath }: SplitTabProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSplitId, setEditingSplitId] = useState<number | null>(null);
  const [form, setForm] = useState<SplitFormState>(createEmptySplitForm());

  const productsQueryKey = useMemo(
    () => [...queryKeys.products.lists(), apiBasePath ?? 'default'],
    [apiBasePath]
  );

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: productsQueryKey,
    queryFn: () => ProductService.loadProducts(apiBasePath),
    staleTime: 30 * 1000,
  });

  const { data: movements = [], isLoading: movementsLoading } = useQuery<
    InventoryMovementFromAPI[]
  >({
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

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<
    TransactionFromAPI[]
  >({
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

  const splitQueryKey = useMemo(
    () => ['split-batches', apiBasePath ?? 'default'],
    [apiBasePath]
  );

  const { data: splitRows = [] } = useQuery<SplitBatchFromAPI[]>({
    queryKey: splitQueryKey,
    queryFn: async () => {
      const response = await fetch(buildApiPath(apiBasePath, '/split-batches'));
      if (!response.ok) {
        return [];
      }

      return (await response.json()) as SplitBatchFromAPI[];
    },
    staleTime: 30 * 1000,
  });

  const sellableOnHandByCode = useMemo(() => {
    const inventoryProducts = products.map(toInventoryProduct);
    const inventoryItems = buildInventoryItems(
      inventoryProducts,
      transactions,
      [],
      movements,
      [],
      splitRows
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

  const isParentSkuInventoryLoading = movementsLoading || transactionsLoading;

  const rows = useMemo<SplitRow[]>(() => {
    return splitRows.map((row) => ({
      id: row.id,
      postingDate: row.postingDate,
      splitName: row.splitName,
      splitSku: row.splitSku,
      componentLabels: row.components.map((c) => c.componentLabel),
      componentSkus: row.components.map((c) => c.componentSku),
      componentPrices: row.components.map((c) => Number(c.componentPrice) || 0),
      includedQuantities: row.components.map((c) => c.includedQuantity),
    }));
  }, [splitRows]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) {
      return rows;
    }

    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const labels = row.componentLabels.join(' ').toLowerCase();
      const skus = row.componentSkus.join(' ').toLowerCase();
      return (
        row.postingDate.toLowerCase().includes(query) ||
        row.splitName.toLowerCase().includes(query) ||
        row.splitSku.toLowerCase().includes(query) ||
        labels.includes(query) ||
        skus.includes(query)
      );
    });
  }, [rows, searchQuery]);

  // Parent SKU dropdown: only delivered set products with positive stock.
  const parentSkuOptions = useMemo(() => {
    const options = products
      .filter((product) => {
        const status = (product['Shipment Status'] ?? '').trim().toLowerCase();
        if (status !== 'delivered') {
          return false;
        }

        const productName = String(product.Product ?? '');
        if (!/\bset\b/i.test(productName)) {
          return false;
        }

        const normalized = normalizeProductCode(product['Product Code']);
        if (!normalized) {
          return false;
        }

        if (isParentSkuInventoryLoading) {
          return Number(product.Quantity ?? 0) > 0;
        }

        return (sellableOnHandByCode.get(normalized) ?? 0) > 0;
      })
      .filter((product) => Boolean(product['Product Code']))
      .map((product) => ({
        value: String(product['Product Code']),
        label: getParentOptionLabel(product),
      }));

    const selectedCode = form.splitSku.trim();
    if (
      selectedCode &&
      !options.some((option) => option.value === selectedCode)
    ) {
      const selectedProduct = products.find(
        (product) =>
          normalizeProductCode(product['Product Code']) ===
          normalizeProductCode(selectedCode)
      );

      if (selectedProduct?.['Product Code']) {
        options.push({
          value: String(selectedProduct['Product Code']),
          label: getParentOptionLabel(selectedProduct),
        });
      }
    }

    return Array.from(
      new Map(options.map((option) => [option.value, option])).values()
    ).sort((a, b) => a.label.localeCompare(b.label));
  }, [
    form.splitSku,
    isParentSkuInventoryLoading,
    products,
    sellableOnHandByCode,
  ]);

  const canSubmit =
    form.postingDate.trim() &&
    form.splitSku.trim() &&
    form.components.filter(
      (c) =>
        c.componentLabel.trim().length > 0 &&
        c.componentSku.trim().length > 0 &&
        Number.isFinite(c.componentPrice) &&
        c.componentPrice >= 0 &&
        c.includedQuantity > 0
    ).length >= 2;

  const handleOpenModal = () => {
    setForm(createEmptySplitForm());
    setEditingSplitId(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rowId: number) => {
    const target = splitRows.find((row) => row.id === rowId);
    if (!target) {
      return;
    }

    setForm({
      postingDate: target.postingDate,
      splitSku: target.splitSku,
      components:
        target.components.length > 0
          ? target.components.map((c) => ({
              clientId: createClientId(),
              componentLabel: c.componentLabel,
              componentSku: c.componentSku,
              componentPrice: Number(c.componentPrice) || 0,
              includedQuantity: Number(c.includedQuantity) || 1,
              isSkuManual:
                c.componentSku !==
                generateChildSku(c.componentLabel, target.postingDate),
            }))
          : [
              {
                clientId: createClientId(),
                componentLabel: '',
                componentSku: '',
                componentPrice: 0,
                includedQuantity: 1,
                isSkuManual: false,
              },
              {
                clientId: createClientId(),
                componentLabel: '',
                componentSku: '',
                componentPrice: 0,
                includedQuantity: 1,
                isSkuManual: false,
              },
            ],
    });

    setEditingSplitId(rowId);
    setIsModalOpen(true);
  };

  const addComponentRow = () => {
    setForm((prev) => ({
      ...prev,
      components: [
        ...prev.components,
        {
          clientId: createClientId(),
          componentLabel: '',
          componentSku: '',
          componentPrice: 0,
          includedQuantity: 1,
          isSkuManual: false,
        },
      ],
    }));
  };

  const removeComponentRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      components: prev.components.filter(
        (_, currentIndex) => currentIndex !== index
      ),
    }));
  };

  const handleSave = () => {
    if (!canSubmit) {
      return;
    }

    const normalizedComponents = form.components
      .map((c) => ({
        componentLabel: c.componentLabel.trim(),
        componentSku: c.componentSku.trim(),
        componentPrice: Math.max(Number(c.componentPrice) || 0, 0),
        includedQuantity: Math.max(Number(c.includedQuantity) || 1, 1),
      }))
      .filter((c) => c.componentLabel.length > 0 && c.componentSku.length > 0);

    saveSplitMutation.mutate({
      id: editingSplitId ?? undefined,
      postingDate: form.postingDate.trim(),
      splitSku: form.splitSku.trim(),
      components: normalizedComponents,
    });
  };

  const saveSplitMutation = useMutation({
    mutationFn: async (payload: {
      id?: number;
      postingDate: string;
      splitSku: string;
      components: Array<{
        componentLabel: string;
        componentSku: string;
        componentPrice: number;
        includedQuantity: number;
      }>;
    }) => {
      const response = await fetch(
        buildApiPath(apiBasePath, '/split-batches'),
        {
          method: payload.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? 'Failed to save split batch'
        );
      }

      return (await response.json()) as SplitBatchFromAPI;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: splitQueryKey });
      queryClient.invalidateQueries({ queryKey: productsQueryKey });
      setForm(createEmptySplitForm());
      setEditingSplitId(null);
      setIsModalOpen(false);
    },
    onError: (error: Error) => {
      void showCustomAlert({
        icon: 'error',
        title: 'Split Batch Error',
        text: error.message,
      });
    },
  });

  const deleteSplitMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        `${buildApiPath(apiBasePath, '/split-batches')}?id=${id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete split batch');
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: splitQueryKey });
      if (editingSplitId === id) {
        setEditingSplitId(null);
        setForm(createEmptySplitForm());
        setIsModalOpen(false);
      }
    },
  });

  const handleDeleteSplit = async (row: SplitRow) => {
    const label = `${row.splitName} (${row.splitSku})`;
    const shouldDelete = await confirmTripleDeleteSplit(label);
    if (!shouldDelete) {
      return;
    }

    await deleteSplitMutation.mutateAsync(row.id);
  };

  return (
    <Stack gap="md">
      <UniversalModal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSplitId ? 'Update Split Batch' : 'Create Split Batch'}
        size="55%"
      >
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="lg">
            <DateInput
              label="Posting Date"
              value={parseDateValue(form.postingDate)}
              onChange={(value) =>
                setForm((prev) => {
                  const nextPostingDate = formatDateForInput(value);

                  return {
                    ...prev,
                    postingDate: nextPostingDate,
                    components: prev.components.map((component) =>
                      component.isSkuManual
                        ? component
                        : {
                            ...component,
                            componentSku: generateChildSku(
                              component.componentLabel,
                              nextPostingDate
                            ),
                          }
                    ),
                  };
                })
              }
              {...COMMON_DATE_INPUT_PROPS}
            />

            <Select
              label="Parent SKU (Set Product)"
              data={parentSkuOptions}
              searchable
              clearable
              disabled={productsLoading}
              value={form.splitSku || null}
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  splitSku: value || '',
                }))
              }
              placeholder={
                productsLoading
                  ? 'Loading parent set products...'
                  : 'Select parent set product'
              }
              nothingFoundMessage={
                isParentSkuInventoryLoading
                  ? 'Loading sellable inventory...'
                  : 'No eligible set products found'
              }
              comboboxProps={{ withinPortal: true, zIndex: 600 }}
              limit={100}
              maxDropdownHeight={240}
            />
          </SimpleGrid>

          <Stack gap="xs">
            <Group justify="space-between" align="center">
              <Text fw={500}>Split Components</Text>
              <Button variant="default" onClick={addComponentRow}>
                Add Component
              </Button>
            </Group>

            <Stack gap="xs">
              {form.components.map((component, index) => (
                <SimpleGrid
                  key={component.clientId}
                  cols={{ base: 1, sm: 2, md: 5 }}
                  spacing="md"
                >
                  <TextInput
                    label={index === 0 ? 'Label' : undefined}
                    placeholder="e.g. Top, Bottom, Bonnet"
                    value={component.componentLabel}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      setForm((prev) => ({
                        ...prev,
                        components: prev.components.map(
                          (current, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...current,
                                  componentLabel: nextValue,
                                  componentSku: current.isSkuManual
                                    ? current.componentSku
                                    : generateChildSku(
                                        nextValue,
                                        prev.postingDate
                                      ),
                                }
                              : current
                        ),
                      }));
                    }}
                  />

                  <TextInput
                    label={index === 0 ? 'Child SKU' : undefined}
                    placeholder="e.g. OCWW-TOP-030426"
                    value={component.componentSku}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      setForm((prev) => ({
                        ...prev,
                        components: prev.components.map(
                          (current, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...current,
                                  componentSku: nextValue,
                                  isSkuManual: nextValue.trim().length > 0,
                                }
                              : current
                        ),
                      }));
                    }}
                  />

                  <NumberInput
                    label={index === 0 ? 'Price' : undefined}
                    min={0}
                    decimalScale={2}
                    fixedDecimalScale
                    leftSection="₱"
                    value={component.componentPrice}
                    onChange={(value) => {
                      const nextValue =
                        typeof value === 'number' && Number.isFinite(value)
                          ? value
                          : 0;
                      setForm((prev) => ({
                        ...prev,
                        components: prev.components.map(
                          (current, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...current,
                                  componentPrice: nextValue,
                                }
                              : current
                        ),
                      }));
                    }}
                  />

                  <NumberInput
                    label={index === 0 ? 'Included Qty' : undefined}
                    min={1}
                    value={component.includedQuantity}
                    onChange={(value) => {
                      const nextValue = typeof value === 'number' ? value : 1;
                      setForm((prev) => ({
                        ...prev,
                        components: prev.components.map(
                          (current, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...current,
                                  includedQuantity: nextValue,
                                }
                              : current
                        ),
                      }));
                    }}
                  />

                  <Group align="end" h="100%" justify="flex-start">
                    <Button
                      variant="subtle"
                      color="red"
                      disabled={form.components.length <= 2}
                      onClick={() => removeComponentRow(index)}
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
              onClick={handleSave}
              disabled={!canSubmit || saveSplitMutation.isPending}
              loading={saveSplitMutation.isPending}
            >
              {editingSplitId ? 'Update Split Batch' : 'Save Split Batch'}
            </Button>
          </Group>
        </Stack>
      </UniversalModal>

      <StandardTableControls
        searchPlaceholder="Search split batches..."
        onSearch={setSearchQuery}
        onAddNew={handleOpenModal}
        addNewLabel="Split Batch"
        hideImport
        hideExport
      />

      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {`Showing ${filteredRows.length} of ${rows.length} split batch(es)`}
            </Text>
          </Group>
        }
      >
        <StandardDataTable
          headers={[
            'Posting Date',
            'Split Name',
            'Parent SKU',
            'Component Label',
            'Child SKU',
            'Price',
            'Included Qty',
            'Action',
          ]}
          colSpan={8}
          emptyState={
            searchQuery
              ? `No split batches found matching "${searchQuery}"`
              : 'No split batches yet.'
          }
        >
          {filteredRows.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td style={{ textAlign: 'center' }}>
                {row.postingDate}
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                {row.splitName}
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                {row.splitSku}
              </Table.Td>
              <Table.Td>
                <Stack gap={2}>
                  {row.componentLabels.map((label, idx) => (
                    <Text
                      key={`${row.id}-label-${idx}`}
                      size="sm"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => handleOpenEditModal(row.id)}
                    >
                      {label}
                    </Text>
                  ))}
                </Stack>
              </Table.Td>
              <Table.Td>
                <Stack gap={2}>
                  {row.componentSkus.map((sku, idx) => (
                    <Text key={`${row.id}-sku-${idx}`} size="sm">
                      {sku}
                    </Text>
                  ))}
                </Stack>
              </Table.Td>
              <Table.Td>
                <Stack gap={2}>
                  {row.componentPrices.map((price, idx) => (
                    <Text key={`${row.id}-price-${idx}`} size="sm">
                      {formatPrice(price)}
                    </Text>
                  ))}
                </Stack>
              </Table.Td>
              <Table.Td>
                <Stack gap={2}>
                  {row.includedQuantities.map((qty, idx) => (
                    <Text key={`${row.id}-qty-${idx}`} size="sm">
                      {qty}
                    </Text>
                  ))}
                </Stack>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Button
                  variant="subtle"
                  color="red"
                  onClick={() => {
                    void handleDeleteSplit(row);
                  }}
                  loading={deleteSplitMutation.isPending}
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
