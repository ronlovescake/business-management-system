'use client';

import React, { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import {
  Button,
  Card,
  Group,
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
import { getCurrentDateISO } from '@/utils/date';
import { useInventoryPage } from '../hooks/useInventoryPage';
import { type SellableFilter } from '../hooks/useInventoryDisplayData';
import { useInventoryQuickAdjustments } from '../hooks/useInventoryQuickAdjustments';
import { useInventoryAdjustmentSubmit } from '../hooks/useInventoryAdjustmentSubmit';
import { useInventoryAdjustmentEditActions } from '../hooks/useInventoryAdjustmentEditActions';
import { useInventoryAdjustmentSelection } from '../hooks/useInventoryAdjustmentSelection';
import { useInventoryViewModel } from '../hooks/useInventoryViewModel';
import { InventoryTableControls } from './InventoryTableControls';
import { InventorySummary } from './InventorySummary';
import { InventoryTable } from './InventoryTable';
import { numberFormatter } from '../lib/formatters';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { normalizeProductCode } from '@/lib/inventory/movements';

interface InventoryPageProps {
  apiBasePath?: string;
}

type AdjustmentBucket =
  | 'damaged_hold'
  | 'scrap'
  | 'supplier_short'
  | 'additionals';

export function InventoryPage({ apiBasePath }: InventoryPageProps) {
  const ADDITIONALS_NOTE_PREFIX = 'additionals';
  const ADDITIONALS_NOTE_MARKER = `${ADDITIONALS_NOTE_PREFIX}:`;
  const TRANSFER_NOTE_PREFIX = 'transfer';
  const TRANSFER_NOTE_MARKER = `${TRANSFER_NOTE_PREFIX}:`;

  const {
    searchQuery,
    setSearchQuery,
    isImporting,
    isLoading,
    isSubmittingMovement,
    headers,
    totalItemCount,
    filteredData,
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
  } = useInventoryPage(apiBasePath);

  const [activeTab, setActiveTab] = React.useState<'inventory' | 'adjustments'>(
    'inventory'
  );

  const [adjustmentModalOpened, adjustmentModalHandlers] = useDisclosure(false);
  const [supplierShortModalOpened, supplierShortModalHandlers] =
    useDisclosure(false);
  const [additionalsModalOpened, additionalsModalHandlers] =
    useDisclosure(false);
  const [editModalOpened, editModalHandlers] = useDisclosure(false);

  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [postingDate, setPostingDate] = useState<string>(getCurrentDateISO());
  const [bucketQuantities, setBucketQuantities] = useState<
    Record<AdjustmentBucket, number | ''>
  >({
    damaged_hold: 0,
    scrap: 0,
    supplier_short: 0,
    additionals: 0,
  });
  const [notes, setNotes] = useState('');
  const [transferToProduct, setTransferToProduct] = useState<string>('');
  const [transferQty, setTransferQty] = useState<number | ''>(0);
  const [sellableFilter, setSellableFilter] =
    useState<SellableFilter>('non_zero_sellable');

  const [supplierShortProduct, setSupplierShortProduct] = useState<string>('');
  const [supplierShortPostingDate, setSupplierShortPostingDate] =
    useState<string>(getCurrentDateISO());
  const [supplierShortQty, setSupplierShortQty] = useState<number | ''>(1);
  const [supplierShortNotes, setSupplierShortNotes] = useState('');

  const [additionalsProduct, setAdditionalsProduct] = useState<string>('');
  const [additionalsPostingDate, setAdditionalsPostingDate] =
    useState<string>(getCurrentDateISO());
  const [additionalsQty, setAdditionalsQty] = useState<number | ''>(1);
  const [additionalsNotes, setAdditionalsNotes] = useState('');

  const [editingMovementId, setEditingMovementId] = useState<number | null>(
    null
  );
  const [editingQuantity, setEditingQuantity] = useState<number | ''>(1);
  const [editingToBucket, setEditingToBucket] = useState<
    'damaged_hold' | 'scrap' | 'supplier_short'
  >('damaged_hold');
  const [editingProductCode, setEditingProductCode] = useState<string | null>(
    null
  );

  const {
    editableMovements,
    adjustmentMovements,
    supplierShortMovements,
    additionalsMovements,
    additionalsQtyByProduct,
    supplierShortQtyByProduct,
    editingProductMovements,
    editingMovement,
    transferOutByProduct,
    transferInByProduct,
    getCurrentTransferQuantity,
    adjustmentNotesByProduct,
    getCurrentBucketQuantity,
    getLatestBucketNote,
    adjustmentSellablePreview,
    sellableFilteredData,
    sortedFilteredData,
    singleFilteredProductCode,
    inventoryEmptyStateMessage,
    displayedTotals,
    productOptions,
    transferToOptions,
    productOptionValueByNormalizedCode,
    selectedOnHand,
  } = useInventoryViewModel({
    filteredData,
    emptyStateMessage,
    searchQuery,
    sellableFilter,
    products,
    movements,
    editingProductCode,
    editingMovementId,
    additionalsNotePrefix: ADDITIONALS_NOTE_PREFIX,
    transferNotePrefix: TRANSFER_NOTE_PREFIX,
    transferNoteMarker: TRANSFER_NOTE_MARKER,
    selectedProduct,
    transferToProduct,
    transferQty,
    bucketQuantities,
    getSellableOnHand,
    normalizeProductCode,
  });

  const {
    handleAdjustmentProductChange,
    openAdjustmentModalFromFilter,
    openAdjustmentForProduct,
    handleTransferToChange,
  } = useInventoryAdjustmentSelection({
    selectedProduct,
    searchQuery,
    singleFilteredProductCode,
    transferToProduct,
    getLatestBucketNote,
    getCurrentBucketQuantity,
    getCurrentTransferQuantity,
    normalizeProductCode,
    transferOutByProduct,
    productOptionValueByNormalizedCode,
    setSelectedProduct,
    setSearchQuery,
    setNotes,
    setPostingDate,
    setTransferToProduct,
    setTransferQty,
    setBucketQuantities,
    openAdjustmentModal: adjustmentModalHandlers.open,
  });

  const { handleMovementSubmit } = useInventoryAdjustmentSubmit({
    selectedProduct,
    transferToProduct,
    notes,
    postingDate,
    selectedOnHand,
    additionalsNoteMarker: ADDITIONALS_NOTE_MARKER,
    transferNoteMarker: TRANSFER_NOTE_MARKER,
    adjustmentSellablePreview,
    adjustmentNotesByProduct,
    adjustmentMovements,
    supplierShortMovements,
    additionalsMovements,
    createMovement,
    updateMovement,
    getSellableOnHand,
    normalizeProductCode,
    setBucketQuantities,
    setTransferToProduct,
    setTransferQty,
    setNotes,
    closeAdjustmentModal: adjustmentModalHandlers.close,
  });

  const { handleSupplierShortSubmit, handleAdditionalsSubmit } =
    useInventoryQuickAdjustments({
      createMovement,
      additionalsNoteMarker: ADDITIONALS_NOTE_MARKER,
      supplierShortProduct,
      supplierShortQty,
      supplierShortPostingDate,
      supplierShortNotes,
      setSupplierShortQty,
      setSupplierShortNotes,
      supplierShortModalHandlers,
      additionalsProduct,
      additionalsQty,
      additionalsPostingDate,
      additionalsNotes,
      setAdditionalsQty,
      setAdditionalsNotes,
      additionalsModalHandlers,
    });

  const { openEditMovement, handleEditSubmit, handleDeleteMovement } =
    useInventoryAdjustmentEditActions({
      editableMovements,
      adjustmentMovements,
      editingMovement,
      editingQuantity,
      editingToBucket,
      setEditingMovementId,
      setEditingProductCode,
      setEditingQuantity,
      setEditingToBucket,
      getSellableOnHand,
      updateMovement,
      deleteMovement,
      editModalHandlers,
    });

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
      <UniversalModal
        opened={adjustmentModalOpened}
        onClose={adjustmentModalHandlers.close}
        title="ADJUSTMENTS"
        size="lg"
        centered
        closeOnEscape={!isSubmittingMovement}
        closeOnClickOutside={!isSubmittingMovement}
      >
        <form onSubmit={handleMovementSubmit}>
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Move inventory between adjustment buckets.
            </Text>

            <Select
              label="Product Code"
              placeholder="Select product code"
              data={productOptions}
              searchable
              required
              value={selectedProduct}
              onChange={handleAdjustmentProductChange}
            />

            <TextInput
              label="Posting date"
              placeholder="YYYY-MM-DD"
              value={postingDate}
              onChange={(event) => setPostingDate(event.currentTarget.value)}
            />

            <NumberInput
              label="Damaged"
              min={0}
              required
              value={bucketQuantities.damaged_hold}
              onChange={(value) =>
                setBucketQuantities((previous) => ({
                  ...previous,
                  damaged_hold: (value as number | '') ?? '',
                }))
              }
            />

            <NumberInput
              label="Scrap"
              min={0}
              required
              value={bucketQuantities.scrap}
              onChange={(value) =>
                setBucketQuantities((previous) => ({
                  ...previous,
                  scrap: (value as number | '') ?? '',
                }))
              }
            />

            <NumberInput
              label="Supplier Short"
              min={0}
              required
              value={bucketQuantities.supplier_short}
              onChange={(value) =>
                setBucketQuantities((previous) => ({
                  ...previous,
                  supplier_short: (value as number | '') ?? '',
                }))
              }
            />

            <NumberInput
              label="Additionals"
              min={0}
              required
              value={bucketQuantities.additionals}
              onChange={(value) =>
                setBucketQuantities((previous) => ({
                  ...previous,
                  additionals: (value as number | '') ?? '',
                }))
              }
            />

            <Select
              label="Transfer To"
              placeholder="Select destination product code"
              data={transferToOptions}
              searchable
              value={transferToProduct}
              onChange={handleTransferToChange}
            />

            <NumberInput
              label="Transfer Out"
              description="Quantity to transfer from selected Product Code to Transfer To"
              min={0}
              value={transferQty}
              onChange={(value) => setTransferQty((value as number | '') ?? '')}
            />

            <Textarea
              label="Notes"
              placeholder="Optional reason"
              minRows={2}
              value={notes}
              onChange={(event) => setNotes(event.currentTarget.value)}
            />

            <Text size="sm" c="dimmed">
              Sellable on-hand:{' '}
              {selectedProduct
                ? numberFormatter.format(
                    adjustmentSellablePreview.projectedSellableOnHand
                  )
                : numberFormatter.format(0)}
            </Text>

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
                disabled={!selectedProduct}
              >
                Save Adjustment
              </Button>
            </Group>
          </Stack>
        </form>
      </UniversalModal>

      <UniversalModal
        opened={supplierShortModalOpened}
        onClose={supplierShortModalHandlers.close}
        title="Supplier Short"
        size="lg"
        centered
        closeOnEscape={!isSubmittingMovement}
        closeOnClickOutside={!isSubmittingMovement}
      >
        <form onSubmit={handleSupplierShortSubmit}>
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Record supplier shortfalls by moving quantity out of SELLABLE into
              SUPPLIER_SHORT.
            </Text>

            <Select
              label="Product Code"
              placeholder="Select product code"
              data={productOptions}
              searchable
              required
              value={supplierShortProduct}
              onChange={(value) => setSupplierShortProduct(value ?? '')}
            />

            <TextInput
              label="Posting date"
              placeholder="YYYY-MM-DD"
              value={supplierShortPostingDate}
              onChange={(event) =>
                setSupplierShortPostingDate(event.currentTarget.value)
              }
            />

            <NumberInput
              label="Quantity short"
              min={0}
              required
              value={supplierShortQty}
              onChange={(value) =>
                setSupplierShortQty((value as number | '') ?? '')
              }
            />

            <Textarea
              label="Notes"
              placeholder="Optional notes"
              minRows={2}
              value={supplierShortNotes}
              onChange={(event) =>
                setSupplierShortNotes(event.currentTarget.value)
              }
            />

            <Group justify="flex-end" mt="sm">
              <Button
                variant="default"
                onClick={supplierShortModalHandlers.close}
                disabled={isSubmittingMovement}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmittingMovement}
                disabled={!supplierShortProduct || !supplierShortQty}
              >
                Save Supplier Short
              </Button>
            </Group>
          </Stack>
        </form>
      </UniversalModal>

      <UniversalModal
        opened={additionalsModalOpened}
        onClose={additionalsModalHandlers.close}
        title="Additionals"
        size="lg"
        centered
        closeOnEscape={!isSubmittingMovement}
        closeOnClickOutside={!isSubmittingMovement}
      >
        <form onSubmit={handleAdditionalsSubmit}>
          <Stack gap="sm">
            <Text size="sm" c="dimmed">
              Record extra supplier quantities by adding them into SELLABLE.
              This does not change PO costs.
            </Text>

            <Select
              label="Product Code"
              placeholder="Select product code"
              data={productOptions}
              searchable
              required
              value={additionalsProduct}
              onChange={(value) => setAdditionalsProduct(value ?? '')}
            />

            <TextInput
              label="Posting date"
              placeholder="YYYY-MM-DD"
              value={additionalsPostingDate}
              onChange={(event) =>
                setAdditionalsPostingDate(event.currentTarget.value)
              }
            />

            <NumberInput
              label="Additional quantity"
              min={0}
              required
              value={additionalsQty}
              onChange={(value) =>
                setAdditionalsQty((value as number | '') ?? '')
              }
            />

            <Textarea
              label="Notes"
              placeholder="Optional notes"
              minRows={2}
              value={additionalsNotes}
              onChange={(event) =>
                setAdditionalsNotes(event.currentTarget.value)
              }
            />

            <Group justify="flex-end" mt="sm">
              <Button
                variant="default"
                onClick={additionalsModalHandlers.close}
                disabled={isSubmittingMovement}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isSubmittingMovement}
                disabled={!additionalsProduct || !additionalsQty}
              >
                Save Additionals
              </Button>
            </Group>
          </Stack>
        </form>
      </UniversalModal>

      <UniversalModal
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

              {editingMovement.toBucket === 'supplier_short' ? (
                <Text size="sm" c="dimmed">
                  Destination bucket: Supplier Short
                </Text>
              ) : (
                <Select
                  label="Destination bucket"
                  data={[
                    {
                      value: 'damaged_hold',
                      label: 'Damaged Hold (keep aside)',
                    },
                    { value: 'scrap', label: 'Scrap (write off)' },
                  ]}
                  value={editingToBucket}
                  onChange={(value) =>
                    setEditingToBucket(
                      (value as 'damaged_hold' | 'scrap') ?? 'damaged_hold'
                    )
                  }
                />
              )}

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
      </UniversalModal>

      <Tabs
        value={activeTab}
        onChange={(value) =>
          setActiveTab((value as typeof activeTab) ?? 'inventory')
        }
      >
        <InventorySummary
          filteredCount={sellableFilteredData.length}
          totalCount={totalItemCount}
          totals={displayedTotals}
        />

        <Tabs.List>
          <Tabs.Tab value="inventory">Inventory</Tabs.Tab>
          <Tabs.Tab value="adjustments">Adjustments</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="inventory" pt="md">
          <Stack gap="md">
            <InventoryTableControls
              onSearch={setSearchQuery}
              onImport={handleImportCSV}
              onExport={handleExportCSV}
              onAddNew={handleAddNew}
              isImporting={isImporting}
              searchAddon={
                <Group gap="sm" wrap="nowrap">
                  <Select
                    w={280}
                    placeholder="Sellable filter"
                    data={[
                      {
                        value: 'all',
                        label: 'All Product Codes',
                      },
                      {
                        value: 'non_zero_sellable',
                        label: 'Non-zero Sellable Value',
                      },
                    ]}
                    value={sellableFilter}
                    onChange={(value) =>
                      setSellableFilter((value as SellableFilter) ?? 'all')
                    }
                    allowDeselect={false}
                  />
                  <Button onClick={openAdjustmentModalFromFilter}>
                    Adjustment
                  </Button>
                </Group>
              }
            />

            <StandardTableContainer>
              <InventoryTable
                headers={headers}
                data={sortedFilteredData}
                emptyState={inventoryEmptyStateMessage}
                transferOutByProduct={transferOutByProduct.formattedByProduct}
                transferInByProduct={transferInByProduct.formattedByProduct}
              />
            </StandardTableContainer>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="adjustments" pt="md">
          <Stack gap="md">
            <Card shadow="sm" padding="md" radius="md" withBorder>
              <Stack gap="sm">
                <Text size="sm" c="dimmed">
                  Create an adjustment to move inventory out of SELLABLE into
                  DAMAGED_HOLD, SCRAP, SUPPLIER_SHORT, or record ADDITIONALS.
                </Text>
                <Group justify="flex-end">
                  <Button onClick={openAdjustmentModalFromFilter}>
                    Adjustment
                  </Button>
                </Group>
              </Stack>
            </Card>

            <StandardTableContainer>
              <StandardDataTable
                headers={[
                  'PRODUCT CODE',
                  'DAMAGED HOLD',
                  'SCRAP',
                  'SUPPLIER SHORT',
                  'ADDITIONALS',
                  'TRANSFER OUT',
                  'TRANSFER IN',
                  'NOTES',
                ]}
                emptyState="No adjustment entries yet."
                colSpan={8}
              >
                {[...sortedFilteredData]
                  .filter((item) => {
                    const manualSupplierShortQty =
                      supplierShortQtyByProduct.get(item.productCode.trim()) ??
                      0;
                    const additionalsQty =
                      additionalsQtyByProduct.get(item.productCode.trim()) ?? 0;
                    const normalizedProductCode = normalizeProductCode(
                      item.productCode
                    );
                    const transferOutQty =
                      transferOutByProduct.quantityByProduct.get(
                        normalizedProductCode
                      ) ?? 0;
                    const transferInQty =
                      transferInByProduct.quantityByProduct.get(
                        normalizedProductCode
                      ) ?? 0;
                    return (
                      item.damagedOnHand > 0 ||
                      item.scrapQty > 0 ||
                      manualSupplierShortQty > 0 ||
                      additionalsQty > 0 ||
                      transferOutQty > 0 ||
                      transferInQty > 0
                    );
                  })
                  .sort((a, b) => {
                    const aSupplierShortQty =
                      supplierShortQtyByProduct.get(a.productCode.trim()) ?? 0;
                    const bSupplierShortQty =
                      supplierShortQtyByProduct.get(b.productCode.trim()) ?? 0;
                    const aAdditionalsQty =
                      additionalsQtyByProduct.get(a.productCode.trim()) ?? 0;
                    const bAdditionalsQty =
                      additionalsQtyByProduct.get(b.productCode.trim()) ?? 0;
                    const aNormalizedProductCode = normalizeProductCode(
                      a.productCode
                    );
                    const bNormalizedProductCode = normalizeProductCode(
                      b.productCode
                    );
                    const aTransferOutQty =
                      transferOutByProduct.quantityByProduct.get(
                        aNormalizedProductCode
                      ) ?? 0;
                    const bTransferOutQty =
                      transferOutByProduct.quantityByProduct.get(
                        bNormalizedProductCode
                      ) ?? 0;
                    const aTransferInQty =
                      transferInByProduct.quantityByProduct.get(
                        aNormalizedProductCode
                      ) ?? 0;
                    const bTransferInQty =
                      transferInByProduct.quantityByProduct.get(
                        bNormalizedProductCode
                      ) ?? 0;
                    const aTotal =
                      a.damagedOnHand +
                      a.scrapQty +
                      aSupplierShortQty +
                      aAdditionalsQty +
                      aTransferOutQty +
                      aTransferInQty;
                    const bTotal =
                      b.damagedOnHand +
                      b.scrapQty +
                      bSupplierShortQty +
                      bAdditionalsQty +
                      bTransferOutQty +
                      bTransferInQty;

                    if (aTotal !== bTotal) {
                      return bTotal - aTotal;
                    }

                    return a.productCode.localeCompare(b.productCode);
                  })
                  .map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td style={{ textAlign: 'left' }}>
                        <Button
                          variant="subtle"
                          size="compact-sm"
                          px={0}
                          style={{ height: 'auto' }}
                          onDoubleClick={() =>
                            openAdjustmentForProduct(item.productCode)
                          }
                        >
                          <Text size="sm" c="#495057">
                            {item.productCode}
                          </Text>
                        </Button>
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
                        <Text size="sm" c="#495057">
                          {numberFormatter.format(
                            supplierShortQtyByProduct.get(
                              item.productCode.trim()
                            ) ?? 0
                          )}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Text size="sm" c="#495057">
                          {numberFormatter.format(
                            additionalsQtyByProduct.get(
                              item.productCode.trim()
                            ) ?? 0
                          )}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Text size="sm" c="#495057">
                          {transferOutByProduct.formattedByProduct.get(
                            normalizeProductCode(item.productCode)
                          ) || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <Text size="sm" c="#495057">
                          {transferInByProduct.formattedByProduct.get(
                            normalizeProductCode(item.productCode)
                          ) || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'left' }}>
                        <Text size="sm" c="#495057">
                          {adjustmentNotesByProduct.get(
                            normalizeProductCode(item.productCode)
                          ) || '—'}
                        </Text>
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
