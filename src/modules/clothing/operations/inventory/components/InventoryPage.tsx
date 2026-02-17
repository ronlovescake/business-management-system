'use client';

import React, { type FormEvent, useCallback, useMemo, useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import { showNotification } from '@mantine/notifications';
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
import { useInventoryPage } from '../hooks/useInventoryPage';
import { InventoryTableControls } from './InventoryTableControls';
import { InventorySummary } from './InventorySummary';
import { InventoryTable } from './InventoryTable';
import { numberFormatter } from '../lib/formatters';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { normalizeProductCode } from '@/lib/inventory/movements';

interface InventoryPageProps {
  apiBasePath?: string;
}

export function InventoryPage({ apiBasePath }: InventoryPageProps) {
  const ADDITIONALS_NOTE_PREFIX = 'additionals';
  const ADDITIONALS_NOTE_MARKER = `${ADDITIONALS_NOTE_PREFIX}:`;

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
  const [postingDate, setPostingDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [toBucket, setToBucket] = useState<
    'damaged_hold' | 'scrap' | 'supplier_short' | 'additionals'
  >('damaged_hold');
  const [notes, setNotes] = useState('');

  const [supplierShortProduct, setSupplierShortProduct] = useState<string>('');
  const [supplierShortPostingDate, setSupplierShortPostingDate] =
    useState<string>(new Date().toISOString().slice(0, 10));
  const [supplierShortQty, setSupplierShortQty] = useState<number | ''>(1);
  const [supplierShortNotes, setSupplierShortNotes] = useState('');

  const [additionalsProduct, setAdditionalsProduct] = useState<string>('');
  const [additionalsPostingDate, setAdditionalsPostingDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
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

  const selectedOnHand = useMemo(
    () => getSellableOnHand(selectedProduct),
    [getSellableOnHand, selectedProduct]
  );

  const editableMovements = useMemo(() => {
    return (movements ?? [])
      .filter(
        (m) =>
          !m.deletedAt &&
          m.fromBucket === 'sellable' &&
          (m.toBucket === 'damaged_hold' ||
            m.toBucket === 'scrap' ||
            m.toBucket === 'supplier_short')
      )
      .slice()
      .sort((a, b) => {
        const aId = Number(a.id);
        const bId = Number(b.id);
        return bId - aId;
      });
  }, [movements]);

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

  const supplierShortMovements = useMemo(() => {
    return (movements ?? [])
      .filter(
        (m) =>
          !m.deletedAt &&
          ((m.fromBucket === 'sellable' && m.toBucket === 'supplier_short') ||
            (m.fromBucket === 'supplier_short' && m.toBucket === 'sellable')) &&
          !(m.notes ?? '').toLowerCase().startsWith(ADDITIONALS_NOTE_PREFIX)
      )
      .slice()
      .sort((a, b) => {
        const aId = Number(a.id);
        const bId = Number(b.id);
        return bId - aId;
      });
  }, [movements]);

  const additionalsMovements = useMemo(() => {
    return (movements ?? [])
      .filter(
        (m) =>
          !m.deletedAt &&
          ((m.fromBucket === 'supplier_short' && m.toBucket === 'sellable') ||
            (m.fromBucket === 'sellable' && m.toBucket === 'supplier_short')) &&
          (m.notes ?? '').toLowerCase().startsWith(ADDITIONALS_NOTE_PREFIX)
      )
      .slice()
      .sort((a, b) => {
        const aId = Number(a.id);
        const bId = Number(b.id);
        return bId - aId;
      });
  }, [ADDITIONALS_NOTE_PREFIX, movements]);

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

  const supplierShortMovementsByProduct = useMemo(() => {
    const map = new Map<string, typeof supplierShortMovements>();
    supplierShortMovements.forEach((movement) => {
      const code = movement.productCode.trim();
      if (!code) {
        return;
      }
      const current = map.get(code) ?? [];
      map.set(code, [...current, movement]);
    });
    return map;
  }, [supplierShortMovements]);

  const additionalsMovementsByProduct = useMemo(() => {
    const map = new Map<string, typeof additionalsMovements>();
    additionalsMovements.forEach((movement) => {
      const code = movement.productCode.trim();
      if (!code) {
        return;
      }
      const current = map.get(code) ?? [];
      map.set(code, [...current, movement]);
    });
    return map;
  }, [additionalsMovements]);

  const supplierShortQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    supplierShortMovementsByProduct.forEach((rows, code) => {
      const total = rows.reduce(
        (sum, movement) =>
          sum +
          (movement.toBucket === 'supplier_short' ? 1 : -1) *
            (Number(movement.quantity) || 0),
        0
      );
      map.set(code, Math.max(total, 0));
    });
    return map;
  }, [supplierShortMovementsByProduct]);

  const additionalsQtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    additionalsMovementsByProduct.forEach((rows, code) => {
      const total = rows.reduce(
        (sum, movement) =>
          sum +
          (movement.fromBucket === 'supplier_short' ? 1 : -1) *
            (Number(movement.quantity) || 0),
        0
      );
      map.set(code, Math.max(total, 0));
    });
    return map;
  }, [additionalsMovementsByProduct]);

  const adjustmentNotesByProduct = useMemo(() => {
    const map = new Map<string, string>();
    const relevantMovements = [
      ...adjustmentMovements,
      ...supplierShortMovements,
      ...additionalsMovements,
    ].sort((a, b) => Number(b.id) - Number(a.id));

    relevantMovements.forEach((movement) => {
      const code = normalizeProductCode(movement.productCode);
      const rawNote = (movement.notes ?? '').trim();
      const note = rawNote.replace(/^additionals(?:\s*:\s*)?/i, '').trim();
      if (!code || !note) {
        return;
      }

      const existing = map.get(code);
      if (!existing) {
        map.set(code, note);
        return;
      }

      if (!existing.toLowerCase().includes(note.toLowerCase())) {
        map.set(code, `${existing}; ${note}`);
      }
    });

    return map;
  }, [adjustmentMovements, supplierShortMovements, additionalsMovements]);

  const inventoryItemByCode = useMemo(() => {
    const map = new Map<string, (typeof filteredData)[number]>();
    filteredData.forEach((item) => {
      const code = item.productCode.trim();
      if (!code) {
        return;
      }

      map.set(code, item);
    });
    return map;
  }, [filteredData]);

  const getCurrentBucketQuantity = useCallback(
    (
      productCode: string,
      bucket: 'damaged_hold' | 'scrap' | 'supplier_short' | 'additionals'
    ): number => {
      const code = productCode.trim();
      if (!code) {
        return 0;
      }

      if (bucket === 'supplier_short') {
        return supplierShortQtyByProduct.get(code) ?? 0;
      }

      if (bucket === 'additionals') {
        return additionalsQtyByProduct.get(code) ?? 0;
      }

      const item = inventoryItemByCode.get(code);
      if (!item) {
        return 0;
      }

      return bucket === 'damaged_hold' ? item.damagedOnHand : item.scrapQty;
    },
    [additionalsQtyByProduct, inventoryItemByCode, supplierShortQtyByProduct]
  );

  const getLatestBucketNote = (
    productCode: string,
    bucket: 'damaged_hold' | 'scrap' | 'supplier_short' | 'additionals'
  ): string => {
    const normalizedCode = normalizeProductCode(productCode);
    if (!normalizedCode) {
      return '';
    }

    const movementForBucket =
      bucket === 'additionals'
        ? additionalsMovements.find(
            (movement) =>
              normalizeProductCode(movement.productCode) === normalizedCode
          )
        : bucket === 'supplier_short'
          ? supplierShortMovements.find(
              (movement) =>
                normalizeProductCode(movement.productCode) === normalizedCode &&
                movement.toBucket === 'supplier_short'
            )
          : adjustmentMovements.find(
              (movement) =>
                normalizeProductCode(movement.productCode) === normalizedCode &&
                movement.toBucket === bucket
            );

    const rawNote = (movementForBucket?.notes ?? '').trim();
    if (!rawNote) {
      return '';
    }

    return rawNote.replace(/^additionals(?:\s*:\s*)?/i, '').trim();
  };

  const editingProductMovements = useMemo(() => {
    if (!editingProductCode) {
      return [];
    }

    // Prefer showing all editable movements for the product in the dropdown.
    const code = editingProductCode.trim();
    const damagedScrap = adjustmentMovementsByProduct.get(code) ?? [];
    const supplierShort = supplierShortMovementsByProduct.get(code) ?? [];
    return [...supplierShort, ...damagedScrap].sort((a, b) => {
      const aId = Number(a.id);
      const bId = Number(b.id);
      return bId - aId;
    });
  }, [
    adjustmentMovementsByProduct,
    editingProductCode,
    supplierShortMovementsByProduct,
  ]);

  const editingMovement = useMemo(() => {
    if (!editingMovementId) {
      return null;
    }
    return editableMovements.find((m) => m.id === editingMovementId) ?? null;
  }, [editableMovements, editingMovementId]);

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

  const openAdjustmentForProduct = (productCode: string) => {
    const code = productCode.trim();
    if (!code) {
      return;
    }

    setSelectedProduct(code);
    setPostingDate(new Date().toISOString().slice(0, 10));
    setToBucket('damaged_hold');
    setNotes(getLatestBucketNote(code, 'damaged_hold'));
    adjustmentModalHandlers.open();
  };

  React.useEffect(() => {
    if (!selectedProduct) {
      setQuantity(0);
      return;
    }

    setQuantity(getCurrentBucketQuantity(selectedProduct, toBucket));
  }, [getCurrentBucketQuantity, selectedProduct, toBucket]);

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
    if (!selectedProduct || quantity === '' || Number(quantity) < 0) {
      return;
    }

    const targetQty = Number(quantity);
    const currentQty = getCurrentBucketQuantity(selectedProduct, toBucket);
    const deltaQty = targetQty - currentQty;
    const trimmedNotes = notes.trim();
    const normalizedProductCode = normalizeProductCode(selectedProduct);
    const additionalsFormattedNotes = trimmedNotes
      ? `${ADDITIONALS_NOTE_MARKER} ${trimmedNotes}`
      : ADDITIONALS_NOTE_MARKER;

    if (deltaQty === 0) {
      const candidateMovements = editableMovements
        .filter((movement) => {
          if (
            normalizeProductCode(movement.productCode) !== normalizedProductCode
          ) {
            return false;
          }

          if (toBucket === 'additionals') {
            return (movement.notes ?? '')
              .toLowerCase()
              .startsWith(ADDITIONALS_NOTE_PREFIX);
          }

          if (toBucket === 'supplier_short') {
            return (
              movement.toBucket === 'supplier_short' &&
              !(movement.notes ?? '')
                .toLowerCase()
                .startsWith(ADDITIONALS_NOTE_PREFIX)
            );
          }

          return movement.toBucket === toBucket;
        })
        .sort((a, b) => Number(b.id) - Number(a.id));

      const latestMatchingMovement = candidateMovements[0];

      if (!trimmedNotes && !(latestMatchingMovement?.notes ?? '').trim()) {
        showNotification({
          title: 'No changes',
          message: 'Selected bucket already matches the target quantity.',
          color: 'blue',
        });
        adjustmentModalHandlers.close();
        return;
      }

      if (!latestMatchingMovement) {
        showNotification({
          title: 'Unable to save note',
          message:
            'No matching adjustment entry found for note-only update. Change target quantity to create an entry.',
          color: 'red',
        });
        return;
      }

      try {
        await updateMovement({
          id: latestMatchingMovement.id,
          postingDate: postingDate.trim() || undefined,
          notes:
            toBucket === 'additionals'
              ? additionalsFormattedNotes
              : trimmedNotes,
        });

        showNotification({
          title: 'Saved',
          message: 'Adjustment note updated',
          color: 'green',
        });

        setNotes('');
        adjustmentModalHandlers.close();
      } catch (error) {
        showNotification({
          title: 'Error',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to update adjustment note',
          color: 'red',
        });
      }

      return;
    }

    if (
      deltaQty > 0 &&
      toBucket !== 'additionals' &&
      deltaQty > selectedOnHand
    ) {
      showNotification({
        title: 'Quantity exceeds sellable on-hand',
        message: `Available sellable units for ${selectedProduct}: ${selectedOnHand}`,
        color: 'red',
      });
      return;
    }

    try {
      if (deltaQty > 0) {
        await createMovement({
          productCode: selectedProduct,
          quantity: deltaQty,
          fromBucket:
            toBucket === 'additionals' ? 'supplier_short' : 'sellable',
          toBucket: toBucket === 'additionals' ? 'sellable' : toBucket,
          postingDate: postingDate.trim() || undefined,
          notes:
            toBucket === 'additionals'
              ? additionalsFormattedNotes
              : trimmedNotes || undefined,
        });
      } else {
        const reverseQty = Math.abs(deltaQty);

        await createMovement({
          productCode: selectedProduct,
          quantity: reverseQty,
          fromBucket: toBucket === 'additionals' ? 'sellable' : toBucket,
          toBucket: toBucket === 'additionals' ? 'supplier_short' : 'sellable',
          postingDate: postingDate.trim() || undefined,
          notes:
            toBucket === 'additionals'
              ? additionalsFormattedNotes
              : trimmedNotes || undefined,
        });
      }

      showNotification({
        title: 'Saved',
        message: 'Adjustment recorded',
        color: 'green',
      });

      setQuantity(0);
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

  const handleSupplierShortSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!supplierShortProduct || !supplierShortQty || supplierShortQty <= 0) {
      return;
    }

    try {
      await createMovement({
        productCode: supplierShortProduct,
        quantity: Number(supplierShortQty),
        fromBucket: 'sellable',
        toBucket: 'supplier_short',
        postingDate: supplierShortPostingDate.trim() || undefined,
        notes: supplierShortNotes.trim() || undefined,
      });

      showNotification({
        title: 'Saved',
        message: 'Supplier short recorded',
        color: 'green',
      });

      setSupplierShortQty(1);
      setSupplierShortNotes('');
      supplierShortModalHandlers.close();
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to record supplier short',
        color: 'red',
      });
    }
  };

  const handleAdditionalsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!additionalsProduct || !additionalsQty || additionalsQty <= 0) {
      return;
    }

    const trimmedNotes = additionalsNotes.trim();
    const finalNotes = trimmedNotes
      ? `${ADDITIONALS_NOTE_MARKER} ${trimmedNotes}`
      : ADDITIONALS_NOTE_MARKER;

    try {
      await createMovement({
        productCode: additionalsProduct,
        quantity: Number(additionalsQty),
        fromBucket: 'supplier_short',
        toBucket: 'sellable',
        postingDate: additionalsPostingDate.trim() || undefined,
        notes: finalNotes,
      });

      showNotification({
        title: 'Saved',
        message: 'Additionals recorded',
        color: 'green',
      });

      setAdditionalsQty(1);
      setAdditionalsNotes('');
      additionalsModalHandlers.close();
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to record additionals',
        color: 'red',
      });
    }
  };

  const openEditMovement = (movementId: number) => {
    const movement = editableMovements.find((m) => m.id === movementId);
    if (!movement) {
      return;
    }

    setEditingMovementId(movement.id);
    setEditingProductCode(movement.productCode);
    setEditingQuantity(movement.quantity);
    setEditingToBucket(
      (movement.toBucket as 'damaged_hold' | 'scrap' | 'supplier_short') ??
        'damaged_hold'
    );
    editModalHandlers.open();
  };

  const handleEditSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingMovement || !editingQuantity || editingQuantity <= 0) {
      return;
    }

    const productCode = editingMovement.productCode;
    const isSellableAdjustmentToInventoryBucket =
      editingMovement.fromBucket === 'sellable' &&
      (editingMovement.toBucket === 'damaged_hold' ||
        editingMovement.toBucket === 'scrap');

    if (isSellableAdjustmentToInventoryBucket) {
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
              onChange={(value) => setSelectedProduct(value ?? '')}
            />

            <TextInput
              label="Posting date"
              placeholder="YYYY-MM-DD"
              value={postingDate}
              onChange={(event) => setPostingDate(event.currentTarget.value)}
            />

            <NumberInput
              label="Target Quantity"
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
                  label: 'Damaged Hold (Keep aside)',
                },
                { value: 'scrap', label: 'Scrap (write off)' },
                { value: 'supplier_short', label: 'Supplier short' },
                { value: 'additionals', label: 'Additionals' },
              ]}
              value={toBucket}
              onChange={(value) => {
                const nextBucket =
                  (value as
                    | 'damaged_hold'
                    | 'scrap'
                    | 'supplier_short'
                    | 'additionals') ?? 'damaged_hold';
                setToBucket(nextBucket);
                if (selectedProduct) {
                  setNotes(getLatestBucketNote(selectedProduct, nextBucket));
                }
              }}
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
                disabled={!selectedProduct || quantity === ''}
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
        <Tabs.List>
          <Tabs.Tab value="inventory">Inventory</Tabs.Tab>
          <Tabs.Tab value="adjustments">Adjustments</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="inventory" pt="md">
          <InventoryTableControls
            onSearch={setSearchQuery}
            onImport={handleImportCSV}
            onExport={handleExportCSV}
            onAddNew={handleAddNew}
            isImporting={isImporting}
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
                  DAMAGED_HOLD, SCRAP, SUPPLIER_SHORT, or record ADDITIONALS.
                </Text>
                <Group justify="flex-end">
                  <Button onClick={adjustmentModalHandlers.open}>
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
                  'NOTES',
                ]}
                emptyState="No adjustment entries yet."
                colSpan={6}
              >
                {[...sortedFilteredData]
                  .filter((item) => {
                    const manualSupplierShortQty =
                      supplierShortQtyByProduct.get(item.productCode.trim()) ??
                      0;
                    const additionalsQty =
                      additionalsQtyByProduct.get(item.productCode.trim()) ?? 0;
                    return (
                      item.damagedOnHand > 0 ||
                      item.scrapQty > 0 ||
                      manualSupplierShortQty > 0 ||
                      additionalsQty > 0
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
                    const aTotal =
                      a.damagedOnHand +
                      a.scrapQty +
                      aSupplierShortQty +
                      aAdditionalsQty;
                    const bTotal =
                      b.damagedOnHand +
                      b.scrapQty +
                      bSupplierShortQty +
                      bAdditionalsQty;

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
