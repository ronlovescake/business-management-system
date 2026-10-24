import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
} from 'react';
import { showNotification } from '@mantine/notifications';
import type { SupplierShortResolution } from '../types';

type EditableMovement = {
  id: number;
  productCode: string;
  quantity: number;
  fromBucket: string;
  toBucket: string;
  notes?: string | null;
  supplierShortResolution?: SupplierShortResolution | null;
  supplierShortExpectedShipmentCode?: string | null;
  supplierCreditReference?: string | null;
  supplierCreditAmount?: number | null;
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
  supplierShortResolution: SupplierShortResolution;
  supplierShortExpectedShipmentCode: string;
  supplierCreditReference: string;
  supplierCreditAmount: number | '';
  setEditingMovementId: Dispatch<SetStateAction<number | null>>;
  setEditingProductCode: Dispatch<SetStateAction<string | null>>;
  setEditingQuantity: Dispatch<SetStateAction<number | ''>>;
  setEditingToBucket: Dispatch<
    SetStateAction<'damaged_hold' | 'scrap' | 'supplier_short'>
  >;
  setSupplierShortResolution: Dispatch<SetStateAction<SupplierShortResolution>>;
  setSupplierShortExpectedShipmentCode: Dispatch<SetStateAction<string>>;
  setSupplierCreditReference: Dispatch<SetStateAction<string>>;
  setSupplierCreditAmount: Dispatch<SetStateAction<number | ''>>;
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
  supplierShortResolution,
  supplierShortExpectedShipmentCode,
  supplierCreditReference,
  supplierCreditAmount,
  setEditingMovementId,
  setEditingProductCode,
  setEditingQuantity,
  setEditingToBucket,
  setSupplierShortResolution,
  setSupplierShortExpectedShipmentCode,
  setSupplierCreditReference,
  setSupplierCreditAmount,
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
      setSupplierShortResolution(
        movement.supplierShortResolution ?? 'UNRESOLVED'
      );
      setSupplierShortExpectedShipmentCode(
        movement.supplierShortExpectedShipmentCode ?? ''
      );
      setSupplierCreditReference(movement.supplierCreditReference ?? '');
      setSupplierCreditAmount(movement.supplierCreditAmount ?? '');
      editModalHandlers.open();
    },
    [
      editModalHandlers,
      editableMovements,
      setEditingMovementId,
      setEditingProductCode,
      setEditingQuantity,
      setEditingToBucket,
      setSupplierShortResolution,
      setSupplierShortExpectedShipmentCode,
      setSupplierCreditReference,
      setSupplierCreditAmount,
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
          ...(editingMovement.toBucket === 'supplier_short' &&
          !(editingMovement.notes ?? '')
            .toLowerCase()
            .startsWith('additionals') &&
          !(editingMovement.notes ?? '').toLowerCase().startsWith('transfer')
            ? {
                supplierShortResolution,
                supplierShortExpectedShipmentCode:
                  supplierShortExpectedShipmentCode.trim() || null,
                supplierCreditReference: supplierCreditReference.trim() || null,
                supplierCreditAmount:
                  supplierCreditAmount === ''
                    ? null
                    : Number(supplierCreditAmount),
              }
            : {}),
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
      supplierShortResolution,
      supplierShortExpectedShipmentCode,
      supplierCreditReference,
      supplierCreditAmount,
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
