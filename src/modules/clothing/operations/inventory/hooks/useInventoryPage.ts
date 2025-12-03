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
  ProductFromAPI,
  TransactionFromAPI,
} from '../types';

const HEADERS = [
  'PRODUCT CODE',
  'QUANTITY',
  'ONHAND',
  'TOTAL ORDER',
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
  const [products, setProducts] = useState<ProductFromAPI[]>([]);
  const [transactions, setTransactions] = useState<TransactionFromAPI[]>([]);

  const fetchInventoryData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [productsResponse, transactionsResponse] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/transactions'),
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

      const [productsPayload, transactionsPayload] = await Promise.all([
        productsResponse.json(),
        transactionsResponse.json(),
      ]);

      const parsedProducts = extractApiData<ProductFromAPI>(productsPayload);
      const parsedTransactions =
        extractApiData<TransactionFromAPI>(transactionsPayload);

      if (parsedProducts.length === 0) {
        logger.warn('InventoryPage: products API returned no data payload');
      }

      if (parsedTransactions.length === 0) {
        logger.warn('InventoryPage: transactions API returned no data payload');
      }

      setProducts(parsedProducts);
      setTransactions(parsedTransactions);
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
    return buildInventoryItems(products, transactions);
  }, [products, transactions]);

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
    headers: HEADERS,
    totalItemCount: inventoryItems.length,
    filteredData,
    totals,
    emptyStateMessage,
    handleImportCSV,
    handleExportCSV,
    handleAddNew,
  };
};
