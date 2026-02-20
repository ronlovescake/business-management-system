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
import {
  useInventoryDisplayData,
  type SellableFilter,
} from '../hooks/useInventoryDisplayData';
import { useTransferSummaries } from '../hooks/useTransferSummaries';
import { useAdjustmentBuckets } from '../hooks/useAdjustmentBuckets';
import { useAdjustmentSellablePreview } from '../hooks/useAdjustmentSellablePreview';
import { useInventoryMovementDerivedData } from '../hooks/useInventoryMovementDerivedData';
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

  const {
    editableMovements,
    adjustmentMovements,
    supplierShortMovements,
    transferMovements,
    additionalsMovements,
    additionalsQtyByProduct,
    supplierShortQtyByProduct,
    editingProductMovements,
    editingMovement,
  } = useInventoryMovementDerivedData({
    movements,
    editingProductCode,
    editingMovementId,
    additionalsNotePrefix: ADDITIONALS_NOTE_PREFIX,
    transferNotePrefix: TRANSFER_NOTE_PREFIX,
  });

  const {
    transferOutByProduct,
    transferInByProduct,
    getCurrentTransferQuantity,
  } = useTransferSummaries({
    transferMovements,
    transferNoteMarker: TRANSFER_NOTE_MARKER,
  });

  const {
    adjustmentNotesByProduct,
    getCurrentBucketQuantity,
    getLatestBucketNote,
  } = useAdjustmentBuckets({
    filteredData,
    adjustmentMovements,
    supplierShortMovements,
    additionalsMovements,
    supplierShortQtyByProduct,
    additionalsQtyByProduct,
  });

  const adjustmentSellablePreview = useAdjustmentSellablePreview({
    selectedProduct,
    selectedOnHand,
    transferToProduct,
    transferQty,
    bucketQuantities,
    getCurrentBucketQuantity,
    getCurrentTransferQuantity,
  });

  const {
    sellableFilteredData,
    sortedFilteredData,
    singleFilteredProductCode,
    inventoryEmptyStateMessage,
  } = useInventoryDisplayData({
    filteredData,
    sellableFilter,
    emptyStateMessage,
    searchQuery,
  });

  const handleAdjustmentProductChange = useCallback(
    (value: string | null) => {
      const nextProductCode = (value ?? '').trim();
      setSelectedProduct(nextProductCode);
      setSearchQuery(nextProductCode);
      setTransferToProduct((previousProductCode) =>
        normalizeProductCode(previousProductCode) ===
        normalizeProductCode(nextProductCode)
          ? ''
          : previousProductCode
      );

      if (nextProductCode) {
        setNotes(getLatestBucketNote(nextProductCode, 'damaged_hold'));
      }
    },
    [getLatestBucketNote, setSearchQuery]
  );

  const openAdjustmentModalFromFilter = useCallback(() => {
    const defaultProductCode = singleFilteredProductCode || searchQuery.trim();

    if (defaultProductCode) {
      setSelectedProduct(defaultProductCode);
      setNotes(getLatestBucketNote(defaultProductCode, 'damaged_hold'));
    }

    setPostingDate(new Date().toISOString().slice(0, 10));
    setTransferToProduct('');
    setTransferQty(0);
    adjustmentModalHandlers.open();
  }, [
    adjustmentModalHandlers,
    getLatestBucketNote,
    searchQuery,
    singleFilteredProductCode,
  ]);

  const openAdjustmentForProduct = (productCode: string) => {
    const code = productCode.trim();
    if (!code) {
      return;
    }

    setSelectedProduct(code);
    setSearchQuery(code);
    setPostingDate(new Date().toISOString().slice(0, 10));
    setTransferToProduct('');
    setTransferQty(0);
    setNotes(getLatestBucketNote(code, 'damaged_hold'));
    adjustmentModalHandlers.open();
  };

  React.useEffect(() => {
    if (!selectedProduct) {
      setBucketQuantities({
        damaged_hold: 0,
        scrap: 0,
        supplier_short: 0,
        additionals: 0,
      });
      return;
    }

    setBucketQuantities({
      damaged_hold: getCurrentBucketQuantity(selectedProduct, 'damaged_hold'),
      scrap: getCurrentBucketQuantity(selectedProduct, 'scrap'),
      supplier_short: getCurrentBucketQuantity(
        selectedProduct,
        'supplier_short'
      ),
      additionals: getCurrentBucketQuantity(selectedProduct, 'additionals'),
    });
  }, [getCurrentBucketQuantity, selectedProduct]);

  React.useEffect(() => {
    if (!selectedProduct) {
      setTransferToProduct('');
      setTransferQty(0);
      return;
    }

    setTransferToProduct((previousProductCode) =>
      normalizeProductCode(previousProductCode) ===
      normalizeProductCode(selectedProduct)
        ? ''
        : previousProductCode
    );
  }, [selectedProduct]);

  const productOptions = useMemo(
    () =>
      products
        .map((p) => p['Product Code']?.trim())
        .filter(Boolean)
        .map((code) => ({ value: code as string, label: code as string })),
    [products]
  );

  const transferToOptions = useMemo(() => {
    const selectedCode = normalizeProductCode(selectedProduct);
    if (!selectedCode) {
      return productOptions;
    }

    return productOptions.filter(
      (option) => normalizeProductCode(option.value) !== selectedCode
    );
  }, [productOptions, selectedProduct]);

  const productOptionValueByNormalizedCode = useMemo(() => {
    const map = new Map<string, string>();
    productOptions.forEach((option) => {
      const normalizedCode = normalizeProductCode(option.value);
      if (normalizedCode && !map.has(normalizedCode)) {
        map.set(normalizedCode, option.value);
      }
    });
    return map;
  }, [productOptions]);

  const handleTransferToChange = useCallback(
    (value: string | null) => {
      const nextTransferToProduct = (value ?? '').trim();
      setTransferToProduct(nextTransferToProduct);

      if (!selectedProduct || !nextTransferToProduct) {
        setTransferQty(0);
        return;
      }

      setTransferQty(
        getCurrentTransferQuantity(selectedProduct, nextTransferToProduct)
      );
    },
    [getCurrentTransferQuantity, selectedProduct]
  );

  React.useEffect(() => {
    const normalizedSourceProductCode = normalizeProductCode(selectedProduct);
    if (!normalizedSourceProductCode) {
      setTransferQty(0);
      return;
    }

    const normalizedDestinationProductCode =
      normalizeProductCode(transferToProduct);

    if (!normalizedDestinationProductCode) {
      const defaultDestination = transferOutByProduct.destinationsBySource.get(
        normalizedSourceProductCode
      )?.[0];

      if (defaultDestination) {
        const canonicalDestinationCode =
          productOptionValueByNormalizedCode.get(
            defaultDestination.destinationCode
          ) ?? defaultDestination.destinationCode;

        setTransferToProduct((previousProductCode) => {
          const normalizedPrevious = normalizeProductCode(previousProductCode);
          return normalizedPrevious === defaultDestination.destinationCode
            ? previousProductCode
            : canonicalDestinationCode;
        });
      } else {
        setTransferQty(0);
      }

      return;
    }

    const currentTransferQuantity = getCurrentTransferQuantity(
      normalizedSourceProductCode,
      normalizedDestinationProductCode
    );

    setTransferQty((previousQty) => {
      const previousValue = Number(previousQty || 0);
      return previousValue === currentTransferQuantity
        ? previousQty
        : currentTransferQuantity;
    });
  }, [
    getCurrentTransferQuantity,
    productOptionValueByNormalizedCode,
    selectedProduct,
    transferOutByProduct.destinationsBySource,
    transferToProduct,
  ]);

  const handleMovementSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProduct) {
      return;
    }

    const trimmedNotes = notes.trim();
    const additionalsFormattedNotes = trimmedNotes
      ? `${ADDITIONALS_NOTE_MARKER} ${trimmedNotes}`
      : ADDITIONALS_NOTE_MARKER;

    const buckets: AdjustmentBucket[] = [
      'damaged_hold',
      'scrap',
      'supplier_short',
      'additionals',
    ];

    const {
      deltaByBucket,
      plannedSellableIn,
      plannedSellableOut,
      transferDelta,
      plannedTransferIn,
      plannedTransferOut,
      targetTransferQuantity,
      targetByBucket,
    } = adjustmentSellablePreview;

    const sourceProductCode = selectedProduct.trim();
    const transferDestinationProductCode = transferToProduct.trim();
    const normalizedSourceProductCode = normalizeProductCode(sourceProductCode);
    const normalizedTransferDestinationCode = normalizeProductCode(
      transferDestinationProductCode
    );

    if (targetTransferQuantity > 0 || transferDelta !== 0) {
      if (!normalizedTransferDestinationCode) {
        showNotification({
          title: 'Transfer destination required',
          message:
            'Select Transfer To product code when transfer quantity is set.',
          color: 'red',
        });
        return;
      }

      if (normalizedTransferDestinationCode === normalizedSourceProductCode) {
        showNotification({
          title: 'Invalid transfer destination',
          message:
            'Transfer To must be a different product code from the source product.',
          color: 'red',
        });
        return;
      }
    }

    const hasDelta = buckets.some((bucket) => deltaByBucket[bucket] !== 0);

    const hasTransfer = transferDelta !== 0;

    if (!hasDelta && !hasTransfer) {
      const normalizedSelectedProductCode =
        normalizeProductCode(selectedProduct);
      const currentNotes =
        adjustmentNotesByProduct.get(normalizedSelectedProductCode)?.trim() ||
        '';

      if (trimmedNotes !== currentNotes) {
        const latestMovementForSelectedProduct = [
          ...adjustmentMovements,
          ...supplierShortMovements,
          ...additionalsMovements,
        ]
          .sort((left, right) => Number(right.id) - Number(left.id))
          .find(
            (movement) =>
              normalizeProductCode(movement.productCode) ===
              normalizedSelectedProductCode
          );

        if (latestMovementForSelectedProduct) {
          try {
            await updateMovement({
              id: latestMovementForSelectedProduct.id,
              notes: trimmedNotes || undefined,
            });

            showNotification({
              title: 'Saved',
              message: 'Adjustment note updated',
              color: 'green',
            });

            setNotes(trimmedNotes);
            adjustmentModalHandlers.close();
            return;
          } catch (error) {
            showNotification({
              title: 'Error',
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to update adjustment note',
              color: 'red',
            });
            return;
          }
        }
      }

      showNotification({
        title: 'No changes',
        message:
          'All adjustment targets and transfer values already match current values.',
        color: 'blue',
      });
      adjustmentModalHandlers.close();
      return;
    }

    if (
      plannedSellableOut + plannedTransferOut >
      selectedOnHand + plannedSellableIn + plannedTransferIn
    ) {
      showNotification({
        title: 'Quantity exceeds sellable on-hand',
        message: `Available sellable units for ${selectedProduct}: ${selectedOnHand}`,
        color: 'red',
      });
      return;
    }

    if (transferDelta < 0 && normalizedTransferDestinationCode) {
      const destinationSellableOnHand = getSellableOnHand(
        transferDestinationProductCode
      );
      const reverseTransferQuantity = Math.abs(transferDelta);

      if (reverseTransferQuantity > destinationSellableOnHand) {
        showNotification({
          title: 'Transfer exceeds destination sellable on-hand',
          message: `Available sellable units for ${normalizedTransferDestinationCode}: ${destinationSellableOnHand}`,
          color: 'red',
        });
        return;
      }
    }

    type MovementPayload = {
      productCode: string;
      quantity: number;
      fromBucket: 'sellable' | 'damaged_hold' | 'scrap' | 'supplier_short';
      toBucket: 'sellable' | 'damaged_hold' | 'scrap' | 'supplier_short';
      postingDate?: string;
      notes?: string;
    };

    const inboundToSellable: MovementPayload[] = [];
    const outboundFromSellable: MovementPayload[] = [];

    buckets.forEach((bucket) => {
      const delta = deltaByBucket[bucket];
      if (delta === 0) {
        return;
      }

      if (bucket === 'additionals') {
        if (delta > 0) {
          inboundToSellable.push({
            productCode: selectedProduct,
            quantity: delta,
            fromBucket: 'supplier_short',
            toBucket: 'sellable',
            postingDate: postingDate.trim() || undefined,
            notes: additionalsFormattedNotes,
          });
        } else {
          outboundFromSellable.push({
            productCode: selectedProduct,
            quantity: Math.abs(delta),
            fromBucket: 'sellable',
            toBucket: 'supplier_short',
            postingDate: postingDate.trim() || undefined,
            notes: additionalsFormattedNotes,
          });
        }
        return;
      }

      if (delta > 0) {
        outboundFromSellable.push({
          productCode: selectedProduct,
          quantity: delta,
          fromBucket: 'sellable',
          toBucket: bucket,
          postingDate: postingDate.trim() || undefined,
          notes: trimmedNotes || undefined,
        });
      } else {
        inboundToSellable.push({
          productCode: selectedProduct,
          quantity: Math.abs(delta),
          fromBucket: bucket,
          toBucket: 'sellable',
          postingDate: postingDate.trim() || undefined,
          notes: trimmedNotes || undefined,
        });
      }
    });

    if (transferDelta !== 0 && normalizedTransferDestinationCode) {
      if (transferDelta > 0) {
        const transferNotes = trimmedNotes
          ? `${TRANSFER_NOTE_MARKER} from:${normalizedSourceProductCode}; to:${normalizedTransferDestinationCode}; note:${trimmedNotes}`
          : `${TRANSFER_NOTE_MARKER} from:${normalizedSourceProductCode}; to:${normalizedTransferDestinationCode}`;

        outboundFromSellable.push({
          productCode: sourceProductCode,
          quantity: transferDelta,
          fromBucket: 'sellable',
          toBucket: 'supplier_short',
          postingDate: postingDate.trim() || undefined,
          notes: transferNotes,
        });

        inboundToSellable.push({
          productCode: transferDestinationProductCode,
          quantity: transferDelta,
          fromBucket: 'supplier_short',
          toBucket: 'sellable',
          postingDate: postingDate.trim() || undefined,
          notes: transferNotes,
        });
      } else {
        const reverseTransferQuantity = Math.abs(transferDelta);
        const reverseTransferNotes = trimmedNotes
          ? `${TRANSFER_NOTE_MARKER} from:${normalizedTransferDestinationCode}; to:${normalizedSourceProductCode}; note:${trimmedNotes}`
          : `${TRANSFER_NOTE_MARKER} from:${normalizedTransferDestinationCode}; to:${normalizedSourceProductCode}`;

        outboundFromSellable.push({
          productCode: transferDestinationProductCode,
          quantity: reverseTransferQuantity,
          fromBucket: 'sellable',
          toBucket: 'supplier_short',
          postingDate: postingDate.trim() || undefined,
          notes: reverseTransferNotes,
        });

        inboundToSellable.push({
          productCode: sourceProductCode,
          quantity: reverseTransferQuantity,
          fromBucket: 'supplier_short',
          toBucket: 'sellable',
          postingDate: postingDate.trim() || undefined,
          notes: reverseTransferNotes,
        });
      }
    }

    try {
      for (const movement of inboundToSellable) {
        await createMovement(movement);
      }

      for (const movement of outboundFromSellable) {
        await createMovement(movement);
      }

      showNotification({
        title: 'Saved',
        message: 'Adjustment recorded',
        color: 'green',
      });

      setBucketQuantities({
        damaged_hold: targetByBucket.damaged_hold,
        scrap: targetByBucket.scrap,
        supplier_short: targetByBucket.supplier_short,
        additionals: targetByBucket.additionals,
      });
      setTransferToProduct('');
      setTransferQty(0);
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
          totals={totals}
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
