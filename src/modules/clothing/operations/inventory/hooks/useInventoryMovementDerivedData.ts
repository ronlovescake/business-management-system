import { useMemo } from 'react';
import type { InventoryMovementFromAPI } from '../types';

type UseInventoryMovementDerivedDataArgs = {
  movements: InventoryMovementFromAPI[] | undefined;
  editingProductCode: string | null;
  editingMovementId: number | null;
  additionalsNotePrefix: string;
  transferNotePrefix: string;
};

export const useInventoryMovementDerivedData = ({
  movements,
  editingProductCode,
  editingMovementId,
  additionalsNotePrefix,
  transferNotePrefix,
}: UseInventoryMovementDerivedDataArgs) => {
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
      .sort((a, b) => Number(b.id) - Number(a.id));
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
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [movements]);

  const supplierShortMovements = useMemo(() => {
    return (movements ?? [])
      .filter(
        (m) =>
          !m.deletedAt &&
          ((m.fromBucket === 'sellable' && m.toBucket === 'supplier_short') ||
            (m.fromBucket === 'supplier_short' && m.toBucket === 'sellable')) &&
          !(m.notes ?? '').toLowerCase().startsWith(additionalsNotePrefix) &&
          !(m.notes ?? '').toLowerCase().startsWith(transferNotePrefix)
      )
      .slice()
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [additionalsNotePrefix, movements, transferNotePrefix]);

  const transferMovements = useMemo(() => {
    return (movements ?? [])
      .filter(
        (m) =>
          !m.deletedAt &&
          ((m.fromBucket === 'sellable' && m.toBucket === 'supplier_short') ||
            (m.fromBucket === 'supplier_short' && m.toBucket === 'sellable')) &&
          (m.notes ?? '').toLowerCase().startsWith(transferNotePrefix)
      )
      .slice()
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [movements, transferNotePrefix]);

  const additionalsMovements = useMemo(() => {
    return (movements ?? [])
      .filter(
        (m) =>
          !m.deletedAt &&
          ((m.fromBucket === 'supplier_short' && m.toBucket === 'sellable') ||
            (m.fromBucket === 'sellable' && m.toBucket === 'supplier_short')) &&
          (m.notes ?? '').toLowerCase().startsWith(additionalsNotePrefix)
      )
      .slice()
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [additionalsNotePrefix, movements]);

  const adjustmentMovementsByProduct = useMemo(() => {
    const map = new Map<string, InventoryMovementFromAPI[]>();
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
    const map = new Map<string, InventoryMovementFromAPI[]>();
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
    const map = new Map<string, InventoryMovementFromAPI[]>();
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

  const editingProductMovements = useMemo(() => {
    if (!editingProductCode) {
      return [];
    }

    const code = editingProductCode.trim();
    const damagedScrap = adjustmentMovementsByProduct.get(code) ?? [];
    const supplierShort = supplierShortMovementsByProduct.get(code) ?? [];
    return [...supplierShort, ...damagedScrap].sort(
      (a, b) => Number(b.id) - Number(a.id)
    );
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

  return {
    editableMovements,
    adjustmentMovements,
    supplierShortMovements,
    transferMovements,
    additionalsMovements,
    adjustmentMovementsByProduct,
    supplierShortMovementsByProduct,
    additionalsMovementsByProduct,
    supplierShortQtyByProduct,
    additionalsQtyByProduct,
    editingProductMovements,
    editingMovement,
  };
};
