'use client';

/**
 * Sorting Distribution Data Hook
 *
 * Manages distribution data, product loading, transaction loading,
 * auto-save functionality, and calculated statistics.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { SortingDistributionService } from '../services/SortingDistributionService';
import {
  DistributionRow,
  Product,
  Transaction,
  SortingDistributionStatistics,
  AUTO_SAVE_DELAY,
} from '../types/sortingDistribution.types';
import { logger } from '@/lib/logger';

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
  // State
  const [rows, setRows] = useState<DistributionRow[]>(
    SortingDistributionService.createDefaultRows()
  );
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [uniqueQuantities, setUniqueQuantities] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
      if (!code) {
        logger.debug('No product code, using default rows');
        setRows(SortingDistributionService.createDefaultRows());
        onSelectedQuantityChange(null);
        return;
      }

      setIsLoading(true);
      const { rows: loadedRows, selectedQuantity: savedQuantity } =
        await SortingDistributionService.loadDistributionData(code);
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
      return;
    }

    logger.debug('Change detected, scheduling auto-save');

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      await SortingDistributionService.saveDistributionData(
        productCode,
        selectedQuantity,
        rows
      );
      setIsSaving(false);
    }, AUTO_SAVE_DELAY);

    // Cleanup function
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [rows, selectedQuantity, productCode]);

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
