'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
import { queryKeys } from '@/lib/queryKeys';
import {
  COMMON_DATE_INPUT_PROPS,
  formatDateForInput,
  parseDateValue,
} from '@/lib/dateInputConfig';
import { DateInput } from '@mantine/dates';
import { ProductService } from '../services/ProductService';
import { buildApiPath } from '@/lib/api/paths';
import { confirmTripleDelete } from '@/utils/confirmTripleDelete';
import type {
  InventoryMovementFromAPI,
  ProductFromAPI,
} from '@/modules/clothing/operations/inventory/types';
import {
  buildSellableDeltaMap,
  buildSellableReceiptCodeSet,
  getSellableOnHand,
  normalizeProductCode,
} from '@/lib/inventory/movements';

type MixAndMatchRow = {
  id: number;
  postingDate: string;
  mixAndMatchName: string;
  mixAndMatchSku: string;
  price: number;
  productCodes: string[];
  includedQuantities: number[];
};

type MixAndMatchComponentRow = {
  clientId: string;
  productCode: string;
  includedQuantity: number;
};

type MixAndMatchFormState = {
  postingDate: string;
  mixAndMatchName: string;
  mixAndMatchSku: string;
  price: number;
  components: MixAndMatchComponentRow[];
};

type MixAndMatchApiRow = {
  id: number;
  postingDate: string;
  mixAndMatchName: string;
  mixAndMatchSku: string;
  price: number;
  components: Array<{
    id: number;
    productCode: string;
    includedQuantity: number;
  }>;
};

async function confirmTripleDeleteMixAndMatch(
  mixAndMatchLabel: string
): Promise<boolean> {
  return confirmTripleDelete({
    title: 'Delete mix & match batch?',
    warning: `This will permanently delete ${mixAndMatchLabel}.`,
    secondaryWarning:
      'This will remove the mix & match batch and its inventory movements.',
    finalPrompt: 'Type DELETE to confirm.',
  });
}

function newClientId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createEmptyMixAndMatchForm(): MixAndMatchFormState {
  return {
    postingDate: formatDateForInput(new Date()),
    mixAndMatchName: '',
    mixAndMatchSku: '',
    price: 0,
    components: [
      {
        clientId: newClientId(),
        productCode: '',
        includedQuantity: 1,
      },
    ],
  };
}

interface MixAndMatchTabProps {
  apiBasePath?: string;
}

export function MixAndMatchTab({ apiBasePath }: MixAndMatchTabProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMixAndMatchId, setEditingMixAndMatchId] = useState<
    number | null
  >(null);
  const [rows, setRows] = useState<MixAndMatchRow[]>([]);
  const [form, setForm] = useState<MixAndMatchFormState>(
    createEmptyMixAndMatchForm()
  );

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) {
      return rows;
    }

    const query = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const codes = row.productCodes.join(' ').toLowerCase();
      return (
        row.postingDate.toLowerCase().includes(query) ||
        row.mixAndMatchName.toLowerCase().includes(query) ||
        row.mixAndMatchSku.toLowerCase().includes(query) ||
        codes.includes(query)
      );
    });
  }, [rows, searchQuery]);

  const productsQueryKey = useMemo(
    () => [...queryKeys.products.lists(), apiBasePath ?? 'default'],
    [apiBasePath]
  );

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: productsQueryKey,
    queryFn: () => ProductService.loadProducts(apiBasePath),
    staleTime: 30 * 1000,
  });

  const mixAndMatchQueryKey = useMemo(
    () => ['mix-and-match', apiBasePath ?? 'default'],
    [apiBasePath]
  );

  const { data: mixAndMatchRows = [] } = useQuery<MixAndMatchApiRow[]>({
    queryKey: mixAndMatchQueryKey,
    queryFn: async () => {
      const response = await fetch(buildApiPath(apiBasePath, '/mix-and-match'));
      if (!response.ok) {
        return [];
      }

      return (await response.json()) as MixAndMatchApiRow[];
    },
    staleTime: 30 * 1000,
  });

  useEffect(() => {
    setRows(
      mixAndMatchRows.map((row) => ({
        id: row.id,
        postingDate: row.postingDate,
        mixAndMatchName: row.mixAndMatchName,
        mixAndMatchSku: row.mixAndMatchSku,
        price: Number(row.price) || 0,
        productCodes: row.components.map((component) => component.productCode),
        includedQuantities: row.components.map(
          (component) => component.includedQuantity
        ),
      }))
    );
  }, [mixAndMatchRows]);

  const { data: movements = [] } = useQuery<InventoryMovementFromAPI[]>({
    queryKey: ['inventory-movements', apiBasePath ?? 'default'],
    queryFn: async () => {
      const response = await fetch(
        buildApiPath(apiBasePath, '/inventory/movements')
      );
      if (!response.ok) {
        return [];
      }

      const payload = (await response.json()) as {
        data?: InventoryMovementFromAPI[];
      };
      return Array.isArray(payload?.data) ? payload.data : [];
    },
    staleTime: 30 * 1000,
  });

  const sellableOnHandByCode = useMemo(() => {
    const movementRows = movements.filter(
      (movement) => movement.toBucket !== 'supplier_short'
    );
    const sellableDeltaByProduct = buildSellableDeltaMap(movementRows);
    const sellableReceiptCodes = buildSellableReceiptCodeSet(movementRows);

    const map = new Map<string, number>();
    (products as unknown as ProductFromAPI[]).forEach((product) => {
      const productCode = product['Product Code'] || '';
      const normalized = normalizeProductCode(productCode);
      if (!normalized) {
        return;
      }

      const sellableOnHand = getSellableOnHand({
        productCode,
        sellableDeltaByProduct,
        fallbackQuantity: product.Quantity || 0,
        sellableReceiptCodes,
      });

      map.set(normalized, Math.max(sellableOnHand, 0));
    });

    return map;
  }, [movements, products]);

  const availableQtyByClientId = useMemo(() => {
    const map = new Map<string, number>();
    form.components.forEach((component) => {
      const normalized = normalizeProductCode(component.productCode);
      map.set(component.clientId, sellableOnHandByCode.get(normalized) ?? 0);
    });
    return map;
  }, [form.components, sellableOnHandByCode]);

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

            return Number(product.Quantity) > 0;
          })
          .map((product) => product['Product Code'])
          .filter((code): code is string => Boolean(code))
          .map((code) => String(code))
      )
    ).sort((a, b) => a.localeCompare(b));

    return codes.map((code) => ({ value: code, label: code }));
  }, [products]);

  const canSubmit =
    form.postingDate.trim() &&
    form.mixAndMatchName.trim() &&
    form.mixAndMatchSku.trim() &&
    form.price >= 0 &&
    form.components.some(
      (component) =>
        component.productCode.trim().length > 0 &&
        component.includedQuantity > 0
    );

  const autoMixAndMatchSku = useMemo(() => {
    const mixAndMatchName = form.mixAndMatchName.trim();
    const postingDate = form.postingDate.trim();
    if (!mixAndMatchName || !postingDate) {
      return '';
    }

    return ProductService.generateProductCode(mixAndMatchName, postingDate);
  }, [form.mixAndMatchName, form.postingDate]);

  useEffect(() => {
    setForm((prev) => {
      if (prev.mixAndMatchSku === autoMixAndMatchSku) {
        return prev;
      }

      return {
        ...prev,
        mixAndMatchSku: autoMixAndMatchSku,
      };
    });
  }, [autoMixAndMatchSku]);

  const handleOpenModal = () => {
    setForm(createEmptyMixAndMatchForm());
    setEditingMixAndMatchId(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rowId: number) => {
    const target = mixAndMatchRows.find((row) => row.id === rowId);
    if (!target) {
      return;
    }

    setForm({
      postingDate: target.postingDate,
      mixAndMatchName: target.mixAndMatchName,
      mixAndMatchSku: target.mixAndMatchSku,
      price: Number(target.price) || 0,
      components:
        target.components.length > 0
          ? target.components.map((component) => ({
              clientId: newClientId(),
              productCode: component.productCode,
              includedQuantity: Number(component.includedQuantity) || 0,
            }))
          : [
              {
                clientId: newClientId(),
                productCode: '',
                includedQuantity: 1,
              },
            ],
    });

    setEditingMixAndMatchId(rowId);
    setIsModalOpen(true);
  };

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
      .map((component) => ({
        productCode: component.productCode.trim(),
        includedQuantity: Math.max(Number(component.includedQuantity) || 1, 1),
      }))
      .filter((component) => component.productCode.length > 0);

    saveMixAndMatchMutation.mutate({
      id: editingMixAndMatchId ?? undefined,
      postingDate: form.postingDate.trim(),
      mixAndMatchName: form.mixAndMatchName.trim(),
      mixAndMatchSku: form.mixAndMatchSku.trim(),
      price: Number(form.price),
      components: normalizedComponents,
    });
  };

  const saveMixAndMatchMutation = useMutation({
    mutationFn: async (payload: {
      id?: number;
      postingDate: string;
      mixAndMatchName: string;
      mixAndMatchSku: string;
      price: number;
      components: Array<{ productCode: string; includedQuantity: number }>;
    }) => {
      const response = await fetch(
        buildApiPath(apiBasePath, '/mix-and-match'),
        {
          method: payload.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save mix & match');
      }

      return (await response.json()) as MixAndMatchApiRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mixAndMatchQueryKey });
      setForm(createEmptyMixAndMatchForm());
      setEditingMixAndMatchId(null);
      setIsModalOpen(false);
    },
  });

  const deleteMixAndMatchMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(
        `${buildApiPath(apiBasePath, '/mix-and-match')}?id=${id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete mix & match');
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: mixAndMatchQueryKey });
      if (editingMixAndMatchId === id) {
        setEditingMixAndMatchId(null);
        setForm(createEmptyMixAndMatchForm());
        setIsModalOpen(false);
      }
    },
  });

  const handleDeleteMixAndMatch = async (row: MixAndMatchRow) => {
    const label = `${row.mixAndMatchName} (${row.mixAndMatchSku})`;
    const shouldDelete = await confirmTripleDeleteMixAndMatch(label);
    if (!shouldDelete) {
      return;
    }

    await deleteMixAndMatchMutation.mutateAsync(row.id);
  };

  return (
    <Stack gap="md">
      <UniversalModal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingMixAndMatchId ? 'Update Mix & Match' : 'Create Mix & Match'
        }
        size="45%"
      >
        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mt="lg">
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
              label="Mix & Match Name"
              value={form.mixAndMatchName}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setForm((prev) => ({
                  ...prev,
                  mixAndMatchName: nextValue,
                }));
              }}
            />

            <TextInput
              label="Mix & Match SKU"
              value={form.mixAndMatchSku}
              readOnly
              placeholder="TEST (T-021326)"
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
              <Text fw={500}>Mix & Match Products</Text>
              <Button variant="default" onClick={addComponentRow}>
                Add SKU
              </Button>
            </Group>

            <Stack gap="xs">
              {form.components.map((component, index) => (
                <SimpleGrid
                  key={component.clientId}
                  cols={{ base: 1, sm: 2, md: 3 }}
                  spacing="md"
                >
                  <Select
                    label={index === 0 ? 'Product Code' : undefined}
                    data={productCodeOptions}
                    searchable
                    clearable
                    disabled={productsLoading}
                    value={component.productCode || null}
                    onChange={(value) => {
                      const nextValue = value || '';
                      setForm((prev) => ({
                        ...prev,
                        components: prev.components.map(
                          (current, currentIndex) =>
                            currentIndex === index
                              ? { ...current, productCode: nextValue }
                              : current
                        ),
                      }));
                    }}
                    placeholder={productsLoading ? 'Loading...' : 'Select SKU'}
                    maxDropdownHeight={240}
                  />

                  <NumberInput
                    label={index === 0 ? 'Included Qty' : undefined}
                    min={1}
                    value={component.includedQuantity}
                    description={`Available: ${availableQtyByClientId.get(component.clientId) ?? 0}`}
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
                      disabled={form.components.length <= 1}
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
              disabled={!canSubmit || saveMixAndMatchMutation.isPending}
              loading={saveMixAndMatchMutation.isPending}
            >
              {editingMixAndMatchId ? 'Update Mix & Match' : 'Save Mix & Match'}
            </Button>
          </Group>
        </Stack>
      </UniversalModal>

      <StandardTableControls
        searchPlaceholder="Search mix & match..."
        onSearch={setSearchQuery}
        onAddNew={handleOpenModal}
        addNewLabel="Mix & Match"
        hideImport
        hideExport
      />

      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              {`Showing ${filteredRows.length} of ${rows.length} mix & match record(s)`}
            </Text>
          </Group>
        }
      >
        <StandardDataTable
          headers={[
            'Posting Date',
            'Mix & Match Name',
            'Mix & Match SKU',
            'Price',
            'Product Code',
            'Included Qty',
            'Action',
          ]}
          colSpan={7}
          emptyState={
            searchQuery
              ? `No mix & match records found matching "${searchQuery}"`
              : 'No mix & match records yet.'
          }
        >
          {filteredRows.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td style={{ textAlign: 'center' }}>
                {row.postingDate}
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                {row.mixAndMatchName}
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                {row.mixAndMatchSku}
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                {Number.isFinite(row.price) ? row.price.toFixed(2) : row.price}
              </Table.Td>
              <Table.Td>
                <Stack gap={2}>
                  {row.productCodes.map((code) => (
                    <Text
                      key={code}
                      size="sm"
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => handleOpenEditModal(row.id)}
                    >
                      {code}
                    </Text>
                  ))}
                </Stack>
              </Table.Td>
              <Table.Td>
                <Stack gap={2}>
                  {row.productCodes.map((code, idx) => (
                    <Text key={`${row.id}-${code}`} size="sm">
                      {row.includedQuantities[idx]}
                    </Text>
                  ))}
                </Stack>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Button
                  variant="subtle"
                  color="red"
                  onClick={() => {
                    void handleDeleteMixAndMatch(row);
                  }}
                  loading={deleteMixAndMatchMutation.isPending}
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
