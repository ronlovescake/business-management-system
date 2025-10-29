'use client';

/**
 * Sorting Distribution Data Hook
 *
 * Manages distribution data, product loading, transaction loading,
 * auto-save functionality, and calculated statistics.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SortingDistributionService } from '../services/SortingDistributionService';
import type {
  DistributionRow,
  Product,
  Transaction,
  SortingDistributionStatistics,
} from '../types/sortingDistribution.types';
import { AUTO_SAVE_DELAY } from '../types/sortingDistribution.types';
import { logger } from '@/lib/logger';

const cloneRows = (rows: DistributionRow[]): DistributionRow[] =>
  rows.map((row) => ({ ...row }));

const areRowsEqual = (
  a: DistributionRow[],
  b: DistributionRow[]
): boolean => {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const rowA = a[index];
    const rowB = b[index];

    if (
      rowA.quantity !== rowB.quantity ||
      rowA.percentage !== rowB.percentage ||
      rowA.groupNumber !== rowB.groupNumber ||
      rowA.distribution !== rowB.distribution ||
      rowA.checked !== rowB.checked
    ) {
      return false;
    }
  }

  return true;
};

export interface UseSortingDistributionDataReturn {
  // Data
  rows: DistributionRow[];
  productOptions: string[];
  allProducts: Product[];
  transactions: Transaction[];
  uniqueQuantities: number[];

  // Loading states
  isLoading: boolean;
  isSaving: boolean;

  // Statistics
  statistics: SortingDistributionStatistics;

  // Actions
  setRows: (
    rows: DistributionRow[] | ((prev: DistributionRow[]) => DistributionRow[])
  ) => void;
  updateRowQuantity: (rowIndex: number, quantity: number) => void;
  updateRowCheckbox: (rowIndex: number, checked: boolean) => void;
  clearAllQuantities: () => void;
  toggleAllCheckboxes: () => void;
  handlePaste: (
    startRow: number,
    pastedValues: readonly (readonly string[])[]
  ) => void;
  loadDistributionData: (productCode: string) => Promise<void>;
}

export interface UseSortingDistributionDataProps {
  productCode: string;
  selectedQuantity: number | null;
  onSelectedQuantityChange: (quantity: number | null) => void;
}

/**
 * Hook for managing sorting distribution data
 */
export function useSortingDistributionData({
  productCode,
  selectedQuantity,
  onSelectedQuantityChange,
}: UseSortingDistributionDataProps): UseSortingDistributionDataReturn {
  const defaultRowsRef = useRef<DistributionRow[]>(
    SortingDistributionService.createDefaultRows()
  );

  // State
  const [rows, setRows] = useState<DistributionRow[]>(() =>
    cloneRows(defaultRowsRef.current)
  );
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [uniqueQuantities, setUniqueQuantities] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRowsRef = useRef<DistributionRow[]>(
    cloneRows(defaultRowsRef.current)
  );
  const lastSavedSelectedQuantityRef = useRef<number | null>(
    selectedQuantity ?? null
  );

  /**
   * Load products on mount
   */
  useEffect(() => {
    const loadProducts = async () => {
      setIsLoading(true);
      const { productOptions: options, allProducts: products } =
        await SortingDistributionService.loadProducts();
      setProductOptions(options);
      setAllProducts(products);
      setIsLoading(false);
    };

    loadProducts();
  }, []);

  /**
   * Load transactions on mount
   */
  useEffect(() => {
    const loadTransactions = async () => {
      const transactionsData =
        await SortingDistributionService.loadTransactions();
      setTransactions(transactionsData);
    };
    loadTransactions();
  }, []);

  /**
   * Load unique quantities when product code changes
   */
  useEffect(() => {
    if (productCode && transactions.length > 0) {
      const quantities = SortingDistributionService.getUniqueQuantities(
        productCode,
        transactions
      );
      logger.debug(`Unique quantities for ${productCode}:`, quantities);
      logger.debug(`Total transactions count:`, transactions.length);
      
      // Log transactions for this product
      const matchingTransactions = transactions.filter(
        (t) => t['Product Code'] === productCode
      );
      logger.debug(`Matching transactions for ${productCode}:`, matchingTransactions.length);
      if (matchingTransactions.length > 0) {
        logger.debug(`Sample transaction:`, matchingTransactions[0]);
      } else {
        logger.warn(`No transactions found for product: ${productCode}`);
        // Log a few sample transactions to see the data structure
        logger.debug(`Sample transactions (first 3):`, transactions.slice(0, 3));
      }
      
      setUniqueQuantities(quantities);
    } else {
      setUniqueQuantities([]);
    }
  }, [productCode, transactions]);

  /**
   * Load saved distribution data when product code changes
   */
  const loadDistributionData = useCallback(
    async (code: string) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      if (!code) {
        logger.debug('No product code, using default rows');
        const emptyRows = SortingDistributionService.createDefaultRows();
        setRows(emptyRows);
        lastSavedRowsRef.current = cloneRows(emptyRows);
        lastSavedSelectedQuantityRef.current = null;
        onSelectedQuantityChange(null);
        return;
      }

      logger.info('🔄 LOADING distribution data for:', code);
      setIsLoading(true);
      const { rows: loadedRows, selectedQuantity: savedQuantity } =
        await SortingDistributionService.loadDistributionData(code);
      
      lastSavedRowsRef.current = cloneRows(loadedRows);
      lastSavedSelectedQuantityRef.current = savedQuantity ?? null;

      const nonEmptyRows = loadedRows.filter(r => r.quantity > 0 || r.checked);
      logger.info('✅ LOADED distribution data:', {
        productCode: code,
        totalRows: loadedRows.length,
        nonEmptyRows: nonEmptyRows.length,
        selectedQuantity: savedQuantity,
        sampleRows: nonEmptyRows.slice(0, 3)
      });
      
      setRows(loadedRows);
      onSelectedQuantityChange(savedQuantity);
      setIsLoading(false);
    },
    [onSelectedQuantityChange]
  );

  /**
   * Load distribution data when product code changes
   */
  useEffect(() => {
    loadDistributionData(productCode);
  }, [productCode, loadDistributionData]);

  /**
   * Calculate statistics (memoized)
   */
  const statistics = useMemo<SortingDistributionStatistics>(() => {
    logger.debug('Calculating statistics for product:', productCode);
    logger.debug('Transactions available:', transactions.length);
    
    const totalReservation = productCode
      ? SortingDistributionService.getTotalReservation(
          productCode,
          transactions
        )
      : 0;

    const totalCustomers = productCode
      ? SortingDistributionService.getTotalCustomers(productCode, transactions)
      : 0;

    const customerWithOrderQty =
      productCode && selectedQuantity !== null
        ? SortingDistributionService.getCustomerCountWithQuantity(
            productCode,
            selectedQuantity,
            transactions
          )
        : 0;

    return SortingDistributionService.calculateStatistics(
      rows,
      totalReservation,
      totalCustomers,
      customerWithOrderQty
    );
  }, [rows, productCode, selectedQuantity, transactions]);

  /**
   * Auto-save data when rows or selectedQuantity changes
   */
  useEffect(() => {
    if (!productCode) {
      logger.debug('No product code, skipping auto-save');
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      return;
    }

    const nonEmptyRows = rows.filter((row) => row.quantity > 0 || row.checked);
    const hasChanges =
      !areRowsEqual(rows, lastSavedRowsRef.current) ||
      selectedQuantity !== lastSavedSelectedQuantityRef.current;

    if (!hasChanges) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      logger.debug('No changes detected, skipping auto-save', {
        productCode,
        selectedQuantity,
        nonEmptyRowCount: nonEmptyRows.length,
      });
      return;
    }

    logger.debug('Change detected, scheduling auto-save', {
      productCode,
      selectedQuantity,
      nonEmptyRowCount: nonEmptyRows.length,
      totalRows: rows.length,
    });

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      logger.info('🔄 AUTO-SAVING distribution data...', {
        productCode,
        selectedQuantity,
        nonEmptyRowCount: nonEmptyRows.length,
      });
      setIsSaving(true);
      try {
        const result = await SortingDistributionService.saveDistributionData(
          productCode,
          selectedQuantity,
          rows
        );
        logger.info('✅ AUTO-SAVE successful:', result);
        if (result.success) {
          lastSavedRowsRef.current = cloneRows(rows);
          lastSavedSelectedQuantityRef.current = selectedQuantity;
        }
      } catch (error) {
        logger.error('❌ AUTO-SAVE failed:', error);
      } finally {
        setIsSaving(false);
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
          saveTimeoutRef.current = null;
        }
      }
    }, AUTO_SAVE_DELAY);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [productCode, rows, selectedQuantity]);

  /**
   * Auto-calculate derived fields when dependencies change
   */
  useEffect(() => {
    setRows((prevRows) => {
      const updatedRows = SortingDistributionService.calculateDerivedFields(
        prevRows,
        statistics.estQtyReceived,
        selectedQuantity
      );
      return updatedRows;
    });
  }, [statistics.estQtyReceived, selectedQuantity]);

  /**
   * Update a single row's quantity
   */
  const updateRowQuantity = useCallback(
    (rowIndex: number, quantity: number) => {
      setRows((prevRows) =>
        SortingDistributionService.updateRowQuantity(
          prevRows,
          rowIndex,
          quantity
        )
      );
    },
    []
  );

  /**
   * Update a single row's checkbox
   */
  const updateRowCheckbox = useCallback(
    (rowIndex: number, checked: boolean) => {
      setRows((prevRows) =>
        SortingDistributionService.updateRowCheckbox(
          prevRows,
          rowIndex,
          checked
        )
      );
    },
    []
  );

  /**
   * Clear all quantities
   */
  const clearAllQuantities = useCallback(() => {
    setRows((prevRows) =>
      SortingDistributionService.clearAllQuantities(prevRows)
    );
  }, []);

  /**
   * Toggle all checkboxes
   */
  const toggleAllCheckboxes = useCallback(() => {
    setRows((prevRows) =>
      SortingDistributionService.toggleAllCheckboxes(prevRows)
    );
  }, []);

  /**
   * Handle paste event
   */
  const handlePaste = useCallback(
    (startRow: number, pastedValues: readonly (readonly string[])[]) => {
      setRows((prevRows) =>
        SortingDistributionService.handlePaste(prevRows, startRow, pastedValues)
      );
    },
    []
  );

  return {
    // Data
    rows,
    productOptions,
    allProducts,
    transactions,
    uniqueQuantities,

    // Loading states
    isLoading,
    isSaving,

    // Statistics
    statistics,

    // Actions
    setRows,
    updateRowQuantity,
    updateRowCheckbox,
    clearAllQuantities,
    toggleAllCheckboxes,
    handlePaste,
    loadDistributionData,
  };
}
