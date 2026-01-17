'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import {
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import {
  StandardDataTable,
  StandardTableContainer,
} from '@/components/tables/StandardDataTable';
import { useInventoryPage } from '../hooks/useInventoryPage';
import { InventoryTableControls } from './InventoryTableControls';
import { InventorySummary } from './InventorySummary';
import { InventoryTable } from './InventoryTable';

export function InventoryPage() {
  const {
    setSearchQuery,
    isImporting,
    isLoading,
    isSubmittingMovement,
    headers,
    totalItemCount,
    filteredData,
    totals,
    emptyStateMessage,
    handleImportCSV,
    handleExportCSV,
    handleAddNew,
    products,
    createMovement,
    getSellableOnHand,
  } = useInventoryPage();

  const [activeTab, setActiveTab] = useState<'inventory' | 'adjustments'>(
    'inventory'
  );

  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [postingDate, setPostingDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [toBucket, setToBucket] = useState<'damaged_hold' | 'scrap'>(
    'damaged_hold'
  );
  const [notes, setNotes] = useState('');

  const selectedOnHand = useMemo(
    () => getSellableOnHand(selectedProduct),
    [getSellableOnHand, selectedProduct]
  );

  const sortedFilteredData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aId = Number(a.id);
      const bId = Number(b.id);

      if (!Number.isNaN(aId) && !Number.isNaN(bId)) {
        return bId - aId;
      }

      return b.productCode.localeCompare(a.productCode);
    });
  }, [filteredData]);

  const productOptions = useMemo(
    () =>
      products
        .map((p) => p['Product Code']?.trim())
        .filter(Boolean)
        .map((code) => ({ value: code as string, label: code as string })),
    [products]
  );

  const handleMovementSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProduct || !quantity || quantity <= 0) {
      return;
    }

    if (Number(quantity) > selectedOnHand) {
      showNotification({
        title: 'Quantity exceeds sellable on-hand',
        message: `Available sellable units for ${selectedProduct}: ${selectedOnHand}`,
        color: 'red',
      });
      return;
    }

    await createMovement({
      productCode: selectedProduct,
      quantity: Number(quantity),
      fromBucket: 'sellable',
      toBucket,
      postingDate: postingDate.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    setQuantity(1);
    setNotes('');
  };

  if (isLoading) {
    return (
      <Stack gap="md">
        <InventoryTableControls
          onSearch={setSearchQuery}
          onImport={handleImportCSV}
          onExport={handleExportCSV}
          onAddNew={handleAddNew}
          isImporting={isImporting}
          showActions={false}
        />
        <StandardTableContainer>
          <StandardDataTable
            headers={headers}
            emptyState="Loading inventory data..."
            colSpan={headers.length}
          >
            {[]}
          </StandardDataTable>
        </StandardTableContainer>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Tabs
        value={activeTab}
        onChange={(value) =>
          setActiveTab((value as typeof activeTab) ?? 'inventory')
        }
      >
        <Tabs.List>
          <Tabs.Tab value="inventory">Inventory</Tabs.Tab>
          <Tabs.Tab value="adjustments">Damaged / Scrap</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="inventory" pt="md">
          <InventoryTableControls
            onSearch={setSearchQuery}
            onImport={handleImportCSV}
            onExport={handleExportCSV}
            onAddNew={handleAddNew}
            isImporting={isImporting}
            searchAddon={
              <Button
                variant="light"
                onClick={() => setActiveTab('adjustments')}
              >
                Mark Damaged Qty
              </Button>
            }
          />

          <StandardTableContainer
            summary={
              <InventorySummary
                filteredCount={filteredData.length}
                totalCount={totalItemCount}
                totals={totals}
              />
            }
          >
            <InventoryTable
              headers={headers}
              data={sortedFilteredData}
              emptyState={emptyStateMessage}
            />
          </StandardTableContainer>
        </Tabs.Panel>

        <Tabs.Panel value="adjustments" pt="md">
          <Card shadow="sm" padding="md" radius="md" withBorder>
            <form onSubmit={handleMovementSubmit}>
              <Stack gap="sm">
                <Text size="sm" c="dimmed">
                  Move quantity out of SELLABLE into DAMAGED_HOLD or SCRAP.
                </Text>

                <Select
                  label="Product Code"
                  placeholder="Select product code"
                  data={productOptions}
                  searchable
                  required
                  value={selectedProduct}
                  onChange={(value) => setSelectedProduct(value ?? '')}
                />

                <TextInput
                  label="Posting date"
                  placeholder="YYYY-MM-DD"
                  value={postingDate}
                  onChange={(event) =>
                    setPostingDate(event.currentTarget.value)
                  }
                />

                <NumberInput
                  label="Quantity"
                  min={0}
                  required
                  value={quantity}
                  onChange={(value) =>
                    setQuantity((value as number | '') ?? '')
                  }
                />

                <Text size="sm" c="dimmed">
                  Sellable on-hand: {selectedProduct ? selectedOnHand : 0}
                </Text>

                <Select
                  label="Destination bucket"
                  data={[
                    {
                      value: 'damaged_hold',
                      label: 'Damaged Hold (keep aside)',
                    },
                    { value: 'scrap', label: 'Scrap (write off)' },
                  ]}
                  value={toBucket}
                  onChange={(value) =>
                    setToBucket(
                      (value as 'damaged_hold' | 'scrap') ?? 'damaged_hold'
                    )
                  }
                />

                <Textarea
                  label="Notes"
                  placeholder="Optional reason"
                  minRows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.currentTarget.value)}
                />

                <Group justify="flex-end" mt="sm">
                  <Button
                    type="submit"
                    loading={isSubmittingMovement}
                    disabled={!selectedProduct || !quantity}
                  >
                    Save Adjustment
                  </Button>
                </Group>
              </Stack>
            </form>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
