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
import { useQuery } from '@tanstack/react-query';
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

type MixAndMatchRow = {
  id: number;
  postingDate: string;
  mixAndMatchName: string;
  mixAndMatchSku: string;
  quantity: number;
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
  quantity: number;
  price: number;
  components: MixAndMatchComponentRow[];
};

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
    quantity: 1,
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    form.quantity > 0 &&
    form.price >= 0 &&
    form.components.some(
      (component) =>
        component.productCode.trim().length > 0 &&
        component.includedQuantity > 0
    );

  const handleOpenModal = () => {
    setForm(createEmptyMixAndMatchForm());
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
        includedQuantity: Number(component.includedQuantity),
      }))
      .filter(
        (component) =>
          component.productCode.length > 0 && component.includedQuantity > 0
      );

    const newRow: MixAndMatchRow = {
      id: Date.now(),
      postingDate: form.postingDate.trim(),
      mixAndMatchName: form.mixAndMatchName.trim(),
      mixAndMatchSku: form.mixAndMatchSku.trim(),
      quantity: Number(form.quantity),
      price: Number(form.price),
      productCodes: normalizedComponents.map(
        (component) => component.productCode
      ),
      includedQuantities: normalizedComponents.map(
        (component) => component.includedQuantity
      ),
    };

    setRows((prev) => [newRow, ...prev]);
    setForm(createEmptyMixAndMatchForm());
    setIsModalOpen(false);
  };

  return (
    <Stack gap="md">
      <UniversalModal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Mix & Match"
        size="45%"
      >
        <Stack gap="sm">
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
              onChange={(event) => {
                const nextValue = event.currentTarget.value;
                setForm((prev) => ({
                  ...prev,
                  mixAndMatchSku: nextValue,
                }));
              }}
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
                    onChange={(value) =>
                      setForm((prev) => ({
                        ...prev,
                        components: prev.components.map(
                          (current, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...current,
                                  includedQuantity:
                                    typeof value === 'number' ? value : 1,
                                }
                              : current
                        ),
                      }))
                    }
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
            <Button onClick={handleSave} disabled={!canSubmit}>
              Save Mix & Match
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
            'Quantity',
            'Price',
            'Product Code',
            'Included Qty',
            'Action',
          ]}
          colSpan={8}
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
                {row.quantity}
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                {Number.isFinite(row.price) ? row.price.toFixed(2) : row.price}
              </Table.Td>
              <Table.Td>
                <Stack gap={2}>
                  {row.productCodes.map((code) => (
                    <Text key={code} size="sm">
                      {code}
                    </Text>
                  ))}
                </Stack>
              </Table.Td>
              <Table.Td>
                <Stack gap={2}>
                  {row.includedQuantities.map((qty, index) => (
                    <Text key={`${row.id}-${index}`} size="sm">
                      {qty}
                    </Text>
                  ))}
                </Stack>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Button variant="subtle" color="red" disabled>
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
