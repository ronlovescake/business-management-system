import { useCallback, useEffect, useMemo, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { showInfo } from '@/lib/alerts';
import { logger } from '@/lib/logger';
import {
  calculateTotals,
  extractApiData,
  buildInventoryItems,
  filterInventoryData,
} from '../lib/inventoryTransforms';
import type {
  InventoryItem,
  InventoryTotals,
  BundleBatchFromAPI,
  ProductFromAPI,
  TransactionFromAPI,
  InventoryMovementFromAPI,
} from '../types';

const HEADERS = [
  'PRODUCT CODE',
  'QUANTITY',
  'ONHAND',
  'RESERVED QTY',
  'AVAILABLE STOCK',
  'TOTAL SALES',
  'COGS',
  'NET PROFIT',
  'PERCENTAGE',
  'ENDING INVENTORY VALUE',
  'SHIPMENT CODE',
  'SHIPMENT STATUS',
] as const;

export const useInventoryPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingMovement, setIsSubmittingMovement] = useState(false);
  const [products, setProducts] = useState<ProductFromAPI[]>([]);
  const [transactions, setTransactions] = useState<TransactionFromAPI[]>([]);
  const [bundles, setBundles] = useState<BundleBatchFromAPI[]>([]);
  const [movements, setMovements] = useState<InventoryMovementFromAPI[]>([]);

  const fetchInventoryData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [
        productsResponse,
        transactionsResponse,
        bundlesResponse,
        movementsResponse,
      ] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/transactions'),
        fetch('/api/bundles'),
        fetch('/api/inventory/movements'),
      ]);

      if (!productsResponse.ok) {
        throw new Error(
          `Failed to fetch products: ${productsResponse.statusText}`
        );
      }

      if (!transactionsResponse.ok) {
        throw new Error(
          `Failed to fetch transactions: ${transactionsResponse.statusText}`
        );
      }

      if (!bundlesResponse.ok) {
        throw new Error(
          `Failed to fetch bundles: ${bundlesResponse.statusText}`
        );
      }

      if (!movementsResponse.ok) {
        throw new Error(
          `Failed to fetch inventory movements: ${movementsResponse.statusText}`
        );
      }

      const [
        productsPayload,
        transactionsPayload,
        bundlesPayload,
        movementsPayload,
      ] = await Promise.all([
        productsResponse.json(),
        transactionsResponse.json(),
        bundlesResponse.json(),
        movementsResponse.json(),
      ]);

      const parsedProducts = extractApiData<ProductFromAPI>(productsPayload);
      const parsedTransactions =
        extractApiData<TransactionFromAPI>(transactionsPayload);
      const parsedBundles = extractApiData<BundleBatchFromAPI>(bundlesPayload);
      const parsedMovements =
        extractApiData<InventoryMovementFromAPI>(movementsPayload);

      if (parsedProducts.length === 0) {
        logger.warn('InventoryPage: products API returned no data payload');
      }

      if (parsedTransactions.length === 0) {
        logger.warn('InventoryPage: transactions API returned no data payload');
      }

      if (parsedBundles.length === 0) {
        logger.warn('InventoryPage: bundles API returned no data payload');
      }

      setMovements(parsedMovements);

      setProducts(parsedProducts);
      setTransactions(parsedTransactions);
      setBundles(parsedBundles);
    } catch (error) {
      logger.error('Failed to load inventory data:', error);
      showNotification({
        title: 'Error',
        message: 'Failed to load inventory data',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInventoryData();
  }, [fetchInventoryData]);

  const inventoryItems = useMemo<InventoryItem[]>(() => {
    return buildInventoryItems(products, transactions, bundles, movements);
  }, [products, transactions, bundles, movements]);

  const sellableOnHandByCode = useMemo(() => {
    const map = new Map<string, number>();
    inventoryItems.forEach((item) => {
      const code = (item.productCode ?? '').trim();
      if (code) {
        map.set(code, item.onhand);
      }
    });
    return map;
  }, [inventoryItems]);

  const getSellableOnHand = useCallback(
    (productCode: string | null | undefined): number => {
      if (!productCode) {
        return 0;
      }

      return sellableOnHandByCode.get(productCode.trim()) ?? 0;
    },
    [sellableOnHandByCode]
  );

  const filteredData = useMemo<InventoryItem[]>(() => {
    return filterInventoryData(inventoryItems, searchQuery);
  }, [inventoryItems, searchQuery]);

  const totals = useMemo<InventoryTotals>(() => {
    return calculateTotals(filteredData);
  }, [filteredData]);

  const emptyStateMessage = useMemo(() => {
    return searchQuery
      ? `No inventory records match "${searchQuery}".`
      : 'No inventory records yet. Use import or add new to populate the table.';
  }, [searchQuery]);

  const handleImportCSV = useCallback((file: File | null) => {
    if (!file) {
      return;
    }

    const fileName = file.name;

    if (!fileName.toLowerCase().endsWith('.csv')) {
      void showInfo(
        'Please upload a CSV file to import inventory data.',
        'Invalid File'
      );
      return;
    }

    setIsImporting(true);
    window.setTimeout(() => {
      void showInfo(
        `Would import inventory records from "${fileName}"`,
        'Import Simulation'
      );
      setIsImporting(false);
    }, 800);
  }, []);

  const createMovement = useCallback(
    async (
      payload: Pick<
        InventoryMovementFromAPI,
        'productCode' | 'quantity' | 'fromBucket' | 'toBucket' | 'postingDate'
      > & { notes?: string | null }
    ) => {
      try {
        setIsSubmittingMovement(true);
        const response = await fetch('/api/inventory/movements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message = body?.error || 'Failed to record movement';
          throw new Error(message);
        }

        await fetchInventoryData();

        showNotification({
          title: 'Saved',
          message: 'Inventory movement recorded',
          color: 'green',
        });
      } catch (error) {
        logger.error('Failed to create inventory movement', { error });
        showNotification({
          title: 'Error',
          message: 'Failed to record movement',
          color: 'red',
        });
      } finally {
        setIsSubmittingMovement(false);
      }
    },
    [fetchInventoryData]
  );

  const handleExportCSV = useCallback(() => {
    void showInfo(
      'Would export the filtered inventory dataset to CSV.',
      'Export Simulation'
    );
  }, []);

  const handleAddNew = useCallback(() => {
    void showInfo(
      'Would open the create inventory item form.',
      'Add New Simulation'
    );
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    isImporting,
    isLoading,
    isSubmittingMovement,
    headers: HEADERS,
    totalItemCount: inventoryItems.length,
    filteredData,
    totals,
    emptyStateMessage,
    handleImportCSV,
    handleExportCSV,
    handleAddNew,
    products,
    createMovement,
    getSellableOnHand,
  };
};
