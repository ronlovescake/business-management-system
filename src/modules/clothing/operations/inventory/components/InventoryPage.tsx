'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
import {
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Table,
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
import { numberFormatter } from '../lib/formatters';

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
    movements,
    createMovement,
    updateMovement,
    deleteMovement,
    getSellableOnHand,
  } = useInventoryPage();

  const [activeTab, setActiveTab] = useState<'inventory' | 'adjustments'>(
    'inventory'
  );

  const [adjustmentModalOpened, adjustmentModalHandlers] = useDisclosure(false);
  const [editModalOpened, editModalHandlers] = useDisclosure(false);

  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [postingDate, setPostingDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [toBucket, setToBucket] = useState<'damaged_hold' | 'scrap'>(
    'damaged_hold'
  );
  const [notes, setNotes] = useState('');

  const [editingMovementId, setEditingMovementId] = useState<number | null>(
    null
  );
  const [editingQuantity, setEditingQuantity] = useState<number | ''>(1);
  const [editingToBucket, setEditingToBucket] = useState<
    'damaged_hold' | 'scrap'
  >('damaged_hold');
  const [editingProductCode, setEditingProductCode] = useState<string | null>(
    null
  );

  const selectedOnHand = useMemo(
    () => getSellableOnHand(selectedProduct),
    [getSellableOnHand, selectedProduct]
  );

  const adjustmentMovements = useMemo(() => {
    return (movements ?? [])
      .filter(
        (m) =>
          !m.deletedAt &&
          m.fromBucket === 'sellable' &&
          (m.toBucket === 'damaged_hold' || m.toBucket === 'scrap')
      )
      .slice()
      .sort((a, b) => {
        const aId = Number(a.id);
        const bId = Number(b.id);
        return bId - aId;
      });
  }, [movements]);

  const adjustmentMovementsByProduct = useMemo(() => {
    const map = new Map<string, typeof adjustmentMovements>();
    adjustmentMovements.forEach((movement) => {
      const code = movement.productCode.trim();
      if (!code) {
        return;
      }
      const current = map.get(code) ?? [];
      map.set(code, [...current, movement]);
    });
    return map;
  }, [adjustmentMovements]);

  const editingProductMovements = useMemo(() => {
    if (!editingProductCode) {
      return [];
    }
    return adjustmentMovementsByProduct.get(editingProductCode.trim()) ?? [];
  }, [adjustmentMovementsByProduct, editingProductCode]);

  const editingMovement = useMemo(() => {
    if (!editingMovementId) {
      return null;
    }
    return adjustmentMovements.find((m) => m.id === editingMovementId) ?? null;
  }, [adjustmentMovements, editingMovementId]);

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

  const damagedScrapRows = useMemo(() => {
    return [...sortedFilteredData]
      .filter((item) => item.damagedOnHand > 0 || item.scrapQty > 0)
      .sort((a, b) => {
        const aTotal = a.damagedOnHand + a.scrapQty;
        const bTotal = b.damagedOnHand + b.scrapQty;

        if (aTotal !== bTotal) {
          return bTotal - aTotal;
        }

        return a.productCode.localeCompare(b.productCode);
      });
  }, [sortedFilteredData]);

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

    try {
      await createMovement({
        productCode: selectedProduct,
        quantity: Number(quantity),
        fromBucket: 'sellable',
        toBucket,
        postingDate: postingDate.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      showNotification({
        title: 'Saved',
        message: 'Adjustment recorded',
        color: 'green',
      });

      setQuantity(1);
      setNotes('');
      adjustmentModalHandlers.close();
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to record movement',
        color: 'red',
      });
    }
  };

  const openEditMovement = (movementId: number) => {
    const movement = adjustmentMovements.find((m) => m.id === movementId);
    if (!movement) {
      return;
    }

    setEditingMovementId(movement.id);
    setEditingProductCode(movement.productCode);
    setEditingQuantity(movement.quantity);
    setEditingToBucket(
      (movement.toBucket as 'damaged_hold' | 'scrap') ?? 'damaged_hold'
    );
    editModalHandlers.open();
  };

  const openEditLatestForProduct = (productCode: string) => {
    const rows = adjustmentMovementsByProduct.get(productCode.trim()) ?? [];
    const latest = rows[0];
    if (!latest) {
      showNotification({
        title: 'No entries',
        message: 'No adjustment entries found for this product.',
        color: 'yellow',
      });
      return;
    }

    openEditMovement(latest.id);
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingMovement || !editingQuantity || editingQuantity <= 0) {
      return;
    }

    const productCode = editingMovement.productCode;
    const currentSellable = getSellableOnHand(productCode);
    const maxAllowed = currentSellable + (editingMovement.quantity || 0);

    if (Number(editingQuantity) > maxAllowed) {
      showNotification({
        title: 'Quantity exceeds sellable on-hand',
        message: `Available sellable units for ${productCode}: ${maxAllowed}`,
        color: 'red',
      });
      return;
    }

    try {
      await updateMovement({
        id: editingMovement.id,
        quantity: Number(editingQuantity),
        toBucket: editingToBucket,
      });

      showNotification({
        title: 'Updated',
        message: 'Adjustment updated',
        color: 'green',
      });

      editModalHandlers.close();
      setEditingMovementId(null);
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to update movement',
        color: 'red',
      });
    }
  };

  const handleDeleteMovement = async (movementId: number) => {
    const movement = adjustmentMovements.find((m) => m.id === movementId);
    if (!movement) {
      return;
    }

    const ok = window.confirm(
      `Delete this adjustment?\n\n${movement.productCode}: ${movement.quantity} -> ${movement.toBucket}`
    );
    if (!ok) {
      return;
    }

    try {
      await deleteMovement({ id: movementId });
      showNotification({
        title: 'Deleted',
        message: 'Adjustment deleted',
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to delete movement',
        color: 'red',
      });
    }
  };

  const handleDeleteLatestForProduct = async (productCode: string) => {
    const rows = adjustmentMovementsByProduct.get(productCode.trim()) ?? [];
    const latest = rows[0];
    if (!latest) {
      return;
    }

    await handleDeleteMovement(latest.id);
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
      <Modal
        opened={adjustmentModalOpened}
        onClose={adjustmentModalHandlers.close}
        title="Damaged / Scrap Adjustment"
        size="lg"
        centered
        closeOnEscape={!isSubmittingMovement}
        closeOnClickOutside={!isSubmittingMovement}
      >
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
              onChange={(event) => setPostingDate(event.currentTarget.value)}
            />

            <NumberInput
              label="Quantity"
              min={0}
              required
              value={quantity}
              onChange={(value) => setQuantity((value as number | '') ?? '')}
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
                variant="default"
                onClick={adjustmentModalHandlers.close}
                disabled={isSubmittingMovement}
              >
                Cancel
              </Button>
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
      </Modal>

      <Modal
        opened={editModalOpened}
        onClose={() => {
          if (!isSubmittingMovement) {
            editModalHandlers.close();
          }
        }}
        title="Edit Adjustment"
        size="md"
        centered
        closeOnEscape={!isSubmittingMovement}
        closeOnClickOutside={!isSubmittingMovement}
      >
        {editingMovement ? (
          <form onSubmit={handleEditSubmit}>
            <Stack gap="sm">
              <Text size="sm" c="dimmed">
                {editingMovement.productCode} → {editingToBucket}
              </Text>

              {editingProductMovements.length > 1 ? (
                <Select
                  label="Entry"
                  description="Select which adjustment entry to edit"
                  data={editingProductMovements.map((m) => ({
                    value: String(m.id),
                    label: `${
                      (
                        m.postingDate ||
                        (m.createdAt ? m.createdAt.slice(0, 10) : '')
                      )
                        .toString()
                        .trim() || '—'
                    } • ${m.toBucket} • qty ${numberFormatter.format(
                      m.quantity
                    )}`,
                  }))}
                  value={String(editingMovement.id)}
                  onChange={(value) => {
                    const movementId = value ? Number(value) : NaN;
                    if (Number.isFinite(movementId)) {
                      openEditMovement(movementId);
                    }
                  }}
                />
              ) : null}

              <Select
                label="Destination bucket"
                data={[
                  { value: 'damaged_hold', label: 'Damaged Hold (keep aside)' },
                  { value: 'scrap', label: 'Scrap (write off)' },
                ]}
                value={editingToBucket}
                onChange={(value) =>
                  setEditingToBucket(
                    (value as 'damaged_hold' | 'scrap') ?? 'damaged_hold'
                  )
                }
              />

              <NumberInput
                label="Quantity"
                min={0}
                required
                value={editingQuantity}
                onChange={(value) =>
                  setEditingQuantity((value as number | '') ?? '')
                }
              />

              <Group justify="flex-end" mt="sm">
                <Button
                  variant="default"
                  onClick={editModalHandlers.close}
                  disabled={isSubmittingMovement}
                >
                  Cancel
                </Button>
                <Button
                  color="red"
                  variant="light"
                  onClick={() => void handleDeleteMovement(editingMovement.id)}
                  disabled={isSubmittingMovement}
                >
                  Delete
                </Button>
                <Button type="submit" loading={isSubmittingMovement}>
                  Save
                </Button>
              </Group>
            </Stack>
          </form>
        ) : (
          <Text size="sm" c="dimmed">
            Select an adjustment to edit.
          </Text>
        )}
      </Modal>

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
                onClick={() => {
                  setActiveTab('adjustments');
                  adjustmentModalHandlers.open();
                }}
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
          <Stack gap="md">
            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Stack gap="sm">
                <Text size="sm" c="dimmed">
                  Create an adjustment to move inventory out of SELLABLE into
                  DAMAGED_HOLD or SCRAP.
                </Text>
                <Group justify="flex-end">
                  <Button onClick={adjustmentModalHandlers.open}>
                    New Adjustment
                  </Button>
                </Group>
              </Stack>
            </Card>

            <StandardTableContainer>
              <StandardDataTable
                headers={['PRODUCT CODE', 'DAMAGED HOLD', 'SCRAP', 'ACTIONS']}
                emptyState="No damaged/scrap items yet."
                colSpan={4}
              >
                {damagedScrapRows.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td style={{ textAlign: 'left' }}>
                      <Text size="sm" c="#495057">
                        {item.productCode}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {numberFormatter.format(item.damagedOnHand)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {numberFormatter.format(item.scrapQty)}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Group justify="center" gap="xs" wrap="nowrap">
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() =>
                            openEditLatestForProduct(item.productCode)
                          }
                        >
                          Edit
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          onClick={() =>
                            void handleDeleteLatestForProduct(item.productCode)
                          }
                          disabled={isSubmittingMovement}
                        >
                          Delete
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </StandardDataTable>
            </StandardTableContainer>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
