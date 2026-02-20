import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
} from 'react';
import { showNotification } from '@mantine/notifications';

type EditableMovement = {
  id: number;
  productCode: string;
  quantity: number;
  fromBucket: string;
  toBucket: string;
};

type ModalHandlers = {
  open: () => void;
  close: () => void;
};

interface UseInventoryAdjustmentEditActionsParams {
  editableMovements: EditableMovement[];
  adjustmentMovements: EditableMovement[];
  editingMovement: EditableMovement | null | undefined;
  editingQuantity: number | '';
  editingToBucket: 'damaged_hold' | 'scrap' | 'supplier_short';
  setEditingMovementId: Dispatch<SetStateAction<number | null>>;
  setEditingProductCode: Dispatch<SetStateAction<string | null>>;
  setEditingQuantity: Dispatch<SetStateAction<number | ''>>;
  setEditingToBucket: Dispatch<
    SetStateAction<'damaged_hold' | 'scrap' | 'supplier_short'>
  >;
  getSellableOnHand: (productCode: string) => number;
  updateMovement: (payload: {
    id: number;
    quantity?: number;
    toBucket?: 'damaged_hold' | 'scrap' | 'supplier_short';
  }) => Promise<unknown>;
  deleteMovement: (payload: { id: number }) => Promise<unknown>;
  editModalHandlers: ModalHandlers;
}

export function useInventoryAdjustmentEditActions({
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
}: UseInventoryAdjustmentEditActionsParams) {
  const openEditMovement = useCallback(
    (movementId: number) => {
      const movement = editableMovements.find((item) => item.id === movementId);
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
    },
    [
      editModalHandlers,
      editableMovements,
      setEditingMovementId,
      setEditingProductCode,
      setEditingQuantity,
      setEditingToBucket,
    ]
  );

  const handleEditSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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
            error instanceof Error
              ? error.message
              : 'Failed to update movement',
          color: 'red',
        });
      }
    },
    [
      editModalHandlers,
      editingMovement,
      editingQuantity,
      editingToBucket,
      getSellableOnHand,
      setEditingMovementId,
      updateMovement,
    ]
  );

  const handleDeleteMovement = useCallback(
    async (movementId: number) => {
      const movement = adjustmentMovements.find(
        (item) => item.id === movementId
      );
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
            error instanceof Error
              ? error.message
              : 'Failed to delete movement',
          color: 'red',
        });
      }
    },
    [adjustmentMovements, deleteMovement]
  );

  return {
    openEditMovement,
    handleEditSubmit,
    handleDeleteMovement,
  };
}
