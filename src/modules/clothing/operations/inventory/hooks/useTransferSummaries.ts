import { useCallback, useMemo } from 'react';
import { normalizeProductCode } from '@/lib/inventory/movements';
import { numberFormatter } from '../lib/formatters';
import type { InventoryMovementFromAPI } from '../types';

interface UseTransferSummariesParams {
  transferMovements: InventoryMovementFromAPI[];
  transferNoteMarker: string;
}

export function useTransferSummaries({
  transferMovements,
  transferNoteMarker,
}: UseTransferSummariesParams) {
  const parseTransferEndpoints = useCallback(
    (rawNotes: string): { fromProductCode: string; toProductCode: string } => {
      const notesValue = rawNotes.trim();
      if (!notesValue.toLowerCase().startsWith(transferNoteMarker)) {
        return { fromProductCode: '', toProductCode: '' };
      }

      const fromMatch = notesValue.match(/from:\s*([^;]+)/i);
      const toMatch = notesValue.match(/to:\s*([^;]+)/i);

      return {
        fromProductCode: normalizeProductCode(fromMatch?.[1] ?? ''),
        toProductCode: normalizeProductCode(toMatch?.[1] ?? ''),
      };
    },
    [transferNoteMarker]
  );

  const getTransferPairKey = useCallback((fromCode: string, toCode: string) => {
    return `${fromCode}=>${toCode}`;
  }, []);

  const transferOutByPair = useMemo(() => {
    const map = new Map<string, number>();

    transferMovements.forEach((movement) => {
      if (
        movement.fromBucket !== 'sellable' ||
        movement.toBucket !== 'supplier_short'
      ) {
        return;
      }

      const transferEndpoints = parseTransferEndpoints(movement.notes ?? '');
      const fromProductCode = transferEndpoints.fromProductCode;
      const toProductCode = transferEndpoints.toProductCode;
      const movementProductCode = normalizeProductCode(movement.productCode);

      if (
        !fromProductCode ||
        !toProductCode ||
        !movementProductCode ||
        movementProductCode !== fromProductCode
      ) {
        return;
      }

      const quantity = Math.max(0, Number(movement.quantity) || 0);
      if (quantity <= 0) {
        return;
      }

      const key = getTransferPairKey(fromProductCode, toProductCode);
      map.set(key, (map.get(key) ?? 0) + quantity);
    });

    return map;
  }, [getTransferPairKey, parseTransferEndpoints, transferMovements]);

  const getCurrentTransferQuantity = useCallback(
    (fromProductCode: string, toProductCode: string): number => {
      const normalizedFromCode = normalizeProductCode(fromProductCode);
      const normalizedToCode = normalizeProductCode(toProductCode);

      if (
        !normalizedFromCode ||
        !normalizedToCode ||
        normalizedFromCode === normalizedToCode
      ) {
        return 0;
      }

      const forwardQty =
        transferOutByPair.get(
          getTransferPairKey(normalizedFromCode, normalizedToCode)
        ) ?? 0;
      const reverseQty =
        transferOutByPair.get(
          getTransferPairKey(normalizedToCode, normalizedFromCode)
        ) ?? 0;

      return Math.max(forwardQty - reverseQty, 0);
    },
    [getTransferPairKey, transferOutByPair]
  );

  const transferOutByProduct = useMemo(() => {
    const summaryByProduct = new Map<string, Map<string, number>>();
    const formattedByProduct = new Map<string, string>();
    const quantityByProduct = new Map<string, number>();

    transferOutByPair.forEach((forwardQty, key) => {
      const [sourceCode = '', destinationCode = ''] = key.split('=>');
      if (!sourceCode || !destinationCode || forwardQty <= 0) {
        return;
      }

      const reverseQty =
        transferOutByPair.get(
          getTransferPairKey(destinationCode, sourceCode)
        ) ?? 0;
      const netQty = Math.max(forwardQty - reverseQty, 0);
      if (netQty <= 0) {
        return;
      }

      const byDestination = summaryByProduct.get(sourceCode) ?? new Map();
      byDestination.set(destinationCode, netQty);
      summaryByProduct.set(sourceCode, byDestination);
    });

    const destinationsBySource = new Map<
      string,
      Array<{ destinationCode: string; quantity: number }>
    >();

    summaryByProduct.forEach((byDestination, sourceCode) => {
      let totalQuantity = 0;
      const destinationEntries = Array.from(byDestination.entries())
        .map(([destinationCode, quantity]) => ({ destinationCode, quantity }))
        .sort((left, right) => right.quantity - left.quantity);

      destinationsBySource.set(sourceCode, destinationEntries);

      const formattedEntries = destinationEntries.map(
        ({ destinationCode, quantity }) => {
          totalQuantity += quantity;
          return `${numberFormatter.format(quantity)} / ${destinationCode}`;
        }
      );

      formattedByProduct.set(sourceCode, formattedEntries.join('; '));
      quantityByProduct.set(sourceCode, totalQuantity);
    });

    return { formattedByProduct, quantityByProduct, destinationsBySource };
  }, [getTransferPairKey, transferOutByPair]);

  const transferInByProduct = useMemo(() => {
    const summaryByProduct = new Map<string, Map<string, number>>();
    const formattedByProduct = new Map<string, string>();
    const quantityByProduct = new Map<string, number>();

    transferOutByPair.forEach((forwardQty, key) => {
      const [sourceCode = '', destinationCode = ''] = key.split('=>');
      if (!sourceCode || !destinationCode || forwardQty <= 0) {
        return;
      }

      const reverseQty =
        transferOutByPair.get(
          getTransferPairKey(destinationCode, sourceCode)
        ) ?? 0;
      const netQty = Math.max(forwardQty - reverseQty, 0);
      if (netQty <= 0) {
        return;
      }

      const bySource = summaryByProduct.get(destinationCode) ?? new Map();
      bySource.set(sourceCode, netQty);
      summaryByProduct.set(destinationCode, bySource);
    });

    summaryByProduct.forEach((bySource, destinationCode) => {
      let totalQuantity = 0;
      const formattedEntries = Array.from(bySource.entries()).map(
        ([sourceCode, quantity]) => {
          totalQuantity += quantity;
          return `${numberFormatter.format(quantity)} / ${sourceCode}`;
        }
      );

      formattedByProduct.set(destinationCode, formattedEntries.join('; '));
      quantityByProduct.set(destinationCode, totalQuantity);
    });

    return { formattedByProduct, quantityByProduct };
  }, [getTransferPairKey, transferOutByPair]);

  return {
    transferOutByProduct,
    transferInByProduct,
    getCurrentTransferQuantity,
  };
}
