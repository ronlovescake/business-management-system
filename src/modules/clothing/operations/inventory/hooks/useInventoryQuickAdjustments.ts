import {
  type Dispatch,
  type FormEvent,
  type SetStateAction,
  useCallback,
} from 'react';
import { showNotification } from '@mantine/notifications';

type MovementPayload = {
  productCode: string;
  quantity: number;
  fromBucket: 'sellable' | 'damaged_hold' | 'scrap' | 'supplier_short';
  toBucket: 'sellable' | 'damaged_hold' | 'scrap' | 'supplier_short';
  postingDate?: string;
  notes?: string;
};

type CloseHandler = {
  close: () => void;
};

interface UseInventoryQuickAdjustmentsParams {
  createMovement: (payload: MovementPayload) => Promise<unknown>;
  additionalsNoteMarker: string;
  supplierShortProduct: string;
  supplierShortQty: number | '';
  supplierShortPostingDate: string;
  supplierShortNotes: string;
  setSupplierShortQty: Dispatch<SetStateAction<number | ''>>;
  setSupplierShortNotes: Dispatch<SetStateAction<string>>;
  supplierShortModalHandlers: CloseHandler;
  additionalsProduct: string;
  additionalsQty: number | '';
  additionalsPostingDate: string;
  additionalsNotes: string;
  setAdditionalsQty: Dispatch<SetStateAction<number | ''>>;
  setAdditionalsNotes: Dispatch<SetStateAction<string>>;
  additionalsModalHandlers: CloseHandler;
}

export function useInventoryQuickAdjustments({
  createMovement,
  additionalsNoteMarker,
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
}: UseInventoryQuickAdjustmentsParams) {
  const handleSupplierShortSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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
    },
    [
      createMovement,
      setSupplierShortQty,
      setSupplierShortNotes,
      supplierShortModalHandlers,
      supplierShortNotes,
      supplierShortPostingDate,
      supplierShortProduct,
      supplierShortQty,
    ]
  );

  const handleAdditionalsSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!additionalsProduct || !additionalsQty || additionalsQty <= 0) {
        return;
      }

      const trimmedNotes = additionalsNotes.trim();
      const finalNotes = trimmedNotes
        ? `${additionalsNoteMarker} ${trimmedNotes}`
        : additionalsNoteMarker;

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
    },
    [
      additionalsModalHandlers,
      additionalsNoteMarker,
      additionalsNotes,
      additionalsPostingDate,
      additionalsProduct,
      additionalsQty,
      createMovement,
      setAdditionalsNotes,
      setAdditionalsQty,
    ]
  );

  return {
    handleSupplierShortSubmit,
    handleAdditionalsSubmit,
  };
}
