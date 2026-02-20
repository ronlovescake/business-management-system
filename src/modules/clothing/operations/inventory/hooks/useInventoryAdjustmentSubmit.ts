import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
} from 'react';
import { showNotification } from '@mantine/notifications';

type AdjustmentBucket =
  | 'damaged_hold'
  | 'scrap'
  | 'supplier_short'
  | 'additionals';

type MovementPayload = {
  productCode: string;
  quantity: number;
  fromBucket: 'sellable' | 'damaged_hold' | 'scrap' | 'supplier_short';
  toBucket: 'sellable' | 'damaged_hold' | 'scrap' | 'supplier_short';
  postingDate?: string;
  notes?: string;
};

type AdjustmentMovementLike = {
  id: number;
  productCode: string;
};

interface AdjustmentSellablePreviewLike {
  deltaByBucket: Record<AdjustmentBucket, number>;
  plannedSellableIn: number;
  plannedSellableOut: number;
  transferDelta: number;
  plannedTransferIn: number;
  plannedTransferOut: number;
  targetTransferQuantity: number;
  targetByBucket: Record<AdjustmentBucket, number | ''>;
}

interface UseInventoryAdjustmentSubmitParams {
  selectedProduct: string;
  transferToProduct: string;
  notes: string;
  postingDate: string;
  selectedOnHand: number;
  additionalsNoteMarker: string;
  transferNoteMarker: string;
  adjustmentSellablePreview: AdjustmentSellablePreviewLike;
  adjustmentNotesByProduct: Map<string, string>;
  adjustmentMovements: AdjustmentMovementLike[];
  supplierShortMovements: AdjustmentMovementLike[];
  additionalsMovements: AdjustmentMovementLike[];
  createMovement: (payload: MovementPayload) => Promise<unknown>;
  updateMovement: (payload: { id: number; notes?: string }) => Promise<unknown>;
  getSellableOnHand: (productCode: string) => number;
  normalizeProductCode: (value: string) => string;
  setBucketQuantities: Dispatch<
    SetStateAction<Record<AdjustmentBucket, number | ''>>
  >;
  setTransferToProduct: Dispatch<SetStateAction<string>>;
  setTransferQty: Dispatch<SetStateAction<number | ''>>;
  setNotes: Dispatch<SetStateAction<string>>;
  closeAdjustmentModal: () => void;
}

export function useInventoryAdjustmentSubmit({
  selectedProduct,
  transferToProduct,
  notes,
  postingDate,
  selectedOnHand,
  additionalsNoteMarker,
  transferNoteMarker,
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
  closeAdjustmentModal,
}: UseInventoryAdjustmentSubmitParams) {
  const handleMovementSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!selectedProduct) {
        return;
      }

      const trimmedNotes = notes.trim();
      const additionalsFormattedNotes = trimmedNotes
        ? `${additionalsNoteMarker} ${trimmedNotes}`
        : additionalsNoteMarker;

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
      const normalizedSourceProductCode =
        normalizeProductCode(sourceProductCode);
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
              closeAdjustmentModal();
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
        closeAdjustmentModal();
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
            ? `${transferNoteMarker} from:${normalizedSourceProductCode}; to:${normalizedTransferDestinationCode}; note:${trimmedNotes}`
            : `${transferNoteMarker} from:${normalizedSourceProductCode}; to:${normalizedTransferDestinationCode}`;

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
            ? `${transferNoteMarker} from:${normalizedTransferDestinationCode}; to:${normalizedSourceProductCode}; note:${trimmedNotes}`
            : `${transferNoteMarker} from:${normalizedTransferDestinationCode}; to:${normalizedSourceProductCode}`;

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
        closeAdjustmentModal();
      } catch (error) {
        showNotification({
          title: 'Error',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to record movement',
          color: 'red',
        });
      }
    },
    [
      selectedProduct,
      notes,
      additionalsNoteMarker,
      adjustmentSellablePreview,
      transferToProduct,
      normalizeProductCode,
      adjustmentNotesByProduct,
      adjustmentMovements,
      supplierShortMovements,
      additionalsMovements,
      updateMovement,
      setNotes,
      closeAdjustmentModal,
      selectedOnHand,
      getSellableOnHand,
      postingDate,
      createMovement,
      setBucketQuantities,
      setTransferToProduct,
      setTransferQty,
      transferNoteMarker,
    ]
  );

  return {
    handleMovementSubmit,
  };
}
