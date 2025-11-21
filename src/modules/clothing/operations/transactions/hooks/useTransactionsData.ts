'use client';

/**
 * useTransactionsData Hook
 *
 * Main data hook for Transactions module.
 * Handles data fetching, filtering, and statistics calculation.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useTransactionData } from '@/hooks/useSheetData';
import { useDataTable } from '@/components/ui';
import { TransactionService } from '../services/TransactionService';
import { ALL_STATUS_CONTROLLED_STATUSES } from '../types/transaction.types';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import type {
  TransactionData,
  PriceTier,
  TransactionStatistics,
} from '../types/transaction.types';

const MIN_EMPTY_TRANSACTION_ROWS = 120;
const MAX_ROWS_PER_ALLOCATION = 25;

/**
 * Hook return type
 */
interface UseTransactionsDataReturn {
  // Core data
  transactions: TransactionData[];
  isLoading: boolean;

  // Filtered data
  filteredData: TransactionData[];
  searchQuery: string;
  handleSearch: (query: string) => void;

  // Status filtering
  selectedStatuses: Set<string>;
  handleStatusFilter: (status: string) => void;

  // Statistics
  statistics: TransactionStatistics;

  // Lookup data
  customerNames: string[];
  productCodes: string[];
  priceTiers: PriceTier[];
  productToShipmentMap: Record<string, string>;
  productToShipmentStatusMap: Record<string, string>;

  // Transaction operations from abstraction layer (using service wrappers)
  bulkUpdate: (data: TransactionData[]) => void;
  update: (data: { id: number; data: Partial<TransactionData> }) => void;
}

/**
 * Load saved filter state from localStorage
 */
const loadSavedFilterState = (): Set<string> => {
  try {
    if (typeof window === 'undefined') {
      return new Set(['All Status']);
    }
    const saved = localStorage.getItem('transactions-filter-state');
    if (saved) {
      const parsedArray = JSON.parse(saved) as string[];
      const savedSet = new Set(parsedArray);

      // If "All Status" is saved, ensure all controlled statuses are also included
      if (savedSet.has('All Status')) {
        ALL_STATUS_CONTROLLED_STATUSES.forEach((status) =>
          savedSet.add(status)
        );
      }

      return savedSet;
    }
  } catch (error) {
    logger.error('Error loading filter state:', error);
  }

  // Default state: All Status + all controlled statuses
  const defaultSet = new Set(['All Status']);
  ALL_STATUS_CONTROLLED_STATUSES.forEach((status) => defaultSet.add(status));
  return defaultSet;
};

/**
 * Main hook
 */
export function useTransactionsData(): UseTransactionsDataReturn {
  // ============================================================================
  // DATA FETCHING - Using abstraction layer
  // ============================================================================

  const {
    data: transactions,
    isLoading: transactionsLoading,
    bulkUpdate: bulkUpdateTransactions,
    update: updateTransaction,
    refetch: refetchTransactions,
  } = useTransactionData();

  const ensuringEmptyRowsRef = useRef(false);
  const refetchTransactionsRef = useRef(refetchTransactions);

  useEffect(() => {
    refetchTransactionsRef.current = refetchTransactions;
  }, [refetchTransactions]);

  useEffect(() => {
    if (!transactions || transactions.length === 0) {
      return;
    }

    const emptyRowCount = transactions.filter((transaction) => {
      const hasCustomer = Boolean(transaction.Customers?.trim());
      const hasProduct = Boolean(transaction['Product Code']?.trim());
      const hasOrderDate = Boolean(transaction['Order Date']?.trim());
      const hasShipmentCode = Boolean(
        transaction['Shipment Code'] &&
          transaction['Shipment Code']?.trim() !== '' &&
          transaction['Shipment Code'] !== '-'
      );
      const hasQuantity = Boolean(
        transaction.Quantity && transaction.Quantity > 0
      );
      const hasNotes = Boolean(transaction.Notes?.trim());

      return (
        !hasCustomer &&
        !hasProduct &&
        !hasOrderDate &&
        !hasShipmentCode &&
        !hasQuantity &&
        !hasNotes
      );
    }).length;

    const missingRows = MIN_EMPTY_TRANSACTION_ROWS - emptyRowCount;

    if (missingRows <= 0 || ensuringEmptyRowsRef.current) {
      return;
    }

    ensuringEmptyRowsRef.current = true;

    const allocateEmptyRows = async () => {
      try {
        let remaining = missingRows;
        while (remaining > 0) {
          const batchSize = Math.min(remaining, MAX_ROWS_PER_ALLOCATION);
          const payload = TransactionService.generateEmptyRows(batchSize);
          await api.post('/api/transactions', payload);
          remaining -= batchSize;
        }

        const refresh = refetchTransactionsRef.current;
        if (refresh) {
          await refresh();
        }
        logger.info(
          `Auto-provisioned ${missingRows} empty transaction rows to keep bulk paste capacity available.`
        );
      } catch (error) {
        logger.error('Failed to auto-provision empty transaction rows:', error);
      } finally {
        ensuringEmptyRowsRef.current = false;
      }
    };

    void allocateEmptyRows();
  }, [transactions]);

  // logger.debug(`Loaded ${transactions.length} transactions from service layer`);

  // ============================================================================
  // LOOKUP DATA - Customer names, product codes, price tiers, mappings
  // ============================================================================

  // Fetch all lookup data in parallel with useQueries
  const lookupQueries = useQueries({
    queries: [
      // Query 1: Customer names from customers API
      {
        queryKey: queryKeys.customers.lists(),
        queryFn: async () => {
          try {
            const customersData =
              await api.get<Record<string, unknown>[]>('/api/customers');
            // Extract customer names from the API data
            return customersData
              .map((customer) => {
                return (
                  customer.name ||
                  customer.Name ||
                  customer.customerName ||
                  customer['Customer Name']
                );
              })
              .filter(Boolean)
              .map(String);
          } catch (error) {
            logger.error('Error fetching customers:', error);
            return [];
          }
        },
        staleTime: 30 * 1000,
      },
      // Query 2: Price tiers from prices API
      {
        queryKey: queryKeys.prices.lists(),
        queryFn: async () => {
          try {
            return await api.get<PriceTier[]>('/api/prices');
          } catch (error) {
            logger.error('Error loading product codes:', error);
            return [];
          }
        },
        staleTime: 30 * 1000,
      },
      // Query 3: Products data for shipment mappings
      {
        queryKey: queryKeys.products.lists(),
        queryFn: async () => {
          try {
            return await api.get<Record<string, unknown>[]>('/api/products');
          } catch (error) {
            logger.error('Error loading products:', error);
            return [];
          }
        },
        staleTime: 30 * 1000,
      },
      // Query 4: Shipments data for shipment status mappings
      {
        queryKey: queryKeys.shipments.lists(),
        queryFn: async () => {
          try {
            return await api.get<Record<string, unknown>[]>('/api/shipments');
          } catch (error) {
            logger.error('Error loading shipments:', error);
            return [];
          }
        },
        staleTime: 30 * 1000,
      },
    ],
  });

  // Destructure query results to avoid complex dependencies
  const [customersQuery, pricesQuery, productsQuery, shipmentsQuery] =
    lookupQueries;

  // Extract data with proper memoization
  const customersQueryData = useMemo(
    () => customersQuery.data || [],
    [customersQuery.data]
  );
  const pricesQueryData = useMemo(
    () => pricesQuery.data || [],
    [pricesQuery.data]
  );
  const productsQueryData = useMemo(
    () => productsQuery.data || [],
    [productsQuery.data]
  );
  const shipmentsQueryData = useMemo(
    () => shipmentsQuery.data || [],
    [shipmentsQuery.data]
  );

  // Compute customer names from API + transactions
  const customerNames = useMemo(() => {
    // Extract unique customer names from imported transactions
    const transactionCustomers = transactions
      .map((t) => t.Customers)
      .filter(Boolean);

    // 🚀 PERFORMANCE: Use Set for O(n) deduplication
    const allCustomers = Array.from(
      new Set([...customersQueryData, ...transactionCustomers])
    ).sort();

    return allCustomers;
  }, [customersQueryData, transactions]);

  // Compute product codes and price tiers from prices API
  const { productCodes, priceTiers } = useMemo(() => {
    // 🚀 PERFORMANCE: Use Set for O(n) deduplication
    const codes = Array.from(
      new Set(
        pricesQueryData.map((price) => price['Product Code']).filter(Boolean)
      )
    ).sort();

    return {
      productCodes: codes,
      priceTiers: pricesQueryData,
    };
  }, [pricesQueryData]);

  // Compute product-to-shipment and product-to-shipment-status mappings
  const { productToShipmentMap, productToShipmentStatusMap } = useMemo(() => {
    // Create mapping from Shipment Code to Shipment Status
    const shipmentCodeToStatus: Record<string, string> = {};

    shipmentsQueryData.forEach((shipment) => {
      const shipmentCode = String(
        shipment['Shipment Code'] || shipment.shipmentCode || ''
      );
      const shipmentStatus = String(
        shipment['Shipment Status'] || shipment.shipmentStatus || ''
      );

      if (shipmentCode) {
        shipmentCodeToStatus[shipmentCode] = shipmentStatus;
      }
    });

    // Create mappings from Product Code to Shipment Code and Status
    const shipmentMapping: Record<string, string> = {};
    const statusMapping: Record<string, string> = {};

    productsQueryData.forEach((product) => {
      const productCode = String(
        product.productCode || product['Product Code'] || ''
      );
      const shipmentCode = String(
        product.shipmentCode || product['Shipment Code'] || ''
      );

      if (productCode && shipmentCode) {
        shipmentMapping[productCode] = shipmentCode;

        const correspondingShipmentStatus =
          shipmentCodeToStatus[shipmentCode] || '';
        statusMapping[productCode] = correspondingShipmentStatus;
      }
    });

    if (Object.keys(statusMapping).length > 0) {
      logger.log(
        `✅ Loaded product-to-shipment mappings: ${Object.keys(statusMapping).length} products mapped`
      );
    }

    return {
      productToShipmentMap: shipmentMapping,
      productToShipmentStatusMap: statusMapping,
    };
  }, [productsQueryData, shipmentsQueryData]);

  // ============================================================================
  // STATUS FILTERING
  // ============================================================================

  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    loadSavedFilterState()
  );

  // Save filter state to localStorage
  useEffect(() => {
    try {
      const statusArray = Array.from(selectedStatuses);
      localStorage.setItem(
        'transactions-filter-state',
        JSON.stringify(statusArray)
      );
    } catch (error) {
      logger.error('Error saving filter state:', error);
    }
  }, [selectedStatuses]);

  // Handle status filter selection with toggle functionality
  const handleStatusFilter = useCallback((status: string) => {
    setSelectedStatuses((prev) => {
      const newSet = new Set(prev);

      if (status === 'All Status') {
        if (newSet.has('All Status')) {
          // Toggle off All Status and all controlled statuses
          newSet.delete('All Status');
          ALL_STATUS_CONTROLLED_STATUSES.forEach((s) => newSet.delete(s));
        } else {
          // Toggle on All Status and all controlled statuses
          newSet.add('All Status');
          ALL_STATUS_CONTROLLED_STATUSES.forEach((s) => newSet.add(s));
        }
      } else {
        // Handle individual status toggle
        if (newSet.has(status)) {
          newSet.delete(status);
          // If this was one of the controlled statuses, also remove All Status
          if (ALL_STATUS_CONTROLLED_STATUSES.includes(status as never)) {
            newSet.delete('All Status');
          }
        } else {
          newSet.add(status);
          // Check if all controlled statuses are now selected
          if (
            ALL_STATUS_CONTROLLED_STATUSES.every(
              (s) => newSet.has(s) || s === status
            )
          ) {
            newSet.add('All Status');
          }
        }
      }

      return newSet;
    });
  }, []);

  // ============================================================================
  // SEARCH FILTERING
  // ============================================================================

  const {
    searchQuery,
    filteredData: searchFilteredData,
    handleSearch,
  } = useDataTable({
    data: transactions,
    searchFields: [
      'Customers',
      'Product Code',
      'Order Status',
      'Notes',
      'Shipment Code',
    ],
  });

  // ============================================================================
  // COMBINED FILTERING - Search + Status
  // ============================================================================

  const filteredData = useMemo(() => {
    // Use only individual statuses; ignore the aggregator flag 'All Status'
    const individual = Array.from(selectedStatuses).filter(
      (s) => s !== 'All Status'
    );

    let filtered;
    if (individual.length === 0) {
      // No individual statuses selected -> show only rows without Order Status
      filtered = searchFilteredData.filter((transaction) => {
        const status = transaction['Order Status'];
        return !status || status.trim() === '';
      });
    } else {
      // Filter by selected statuses OR rows without status
      filtered = searchFilteredData.filter((transaction) => {
        const status = transaction['Order Status'];
        return (
          !status ||
          status.trim() === '' ||
          (status && individual.includes(status))
        );
      });
    }

    // If there's an active search, append empty rows
    if (searchQuery && searchQuery.trim() !== '') {
      const emptyRows = transactions.filter((transaction) => {
        const hasCustomer =
          transaction.Customers && transaction.Customers.trim() !== '';
        const hasProductCode =
          transaction['Product Code'] &&
          transaction['Product Code'].trim() !== '';
        return !hasCustomer && !hasProductCode;
      });

      return [...filtered, ...emptyRows];
    }

    return filtered;
  }, [searchFilteredData, selectedStatuses, searchQuery, transactions]);

  // ============================================================================
  // STATISTICS CALCULATION
  // ============================================================================

  const statistics = useMemo(() => {
    return TransactionService.calculateStatistics(filteredData);
  }, [filteredData]);

  // ============================================================================
  // TRANSACTION SYNC - Update order status based on shipment status
  // ============================================================================

  const syncTransactionsWithShipmentStatus = useCallback(
    (statusMap: Record<string, string>) => {
      const [updatedTransactions, updatedCount] =
        TransactionService.syncTransactionsWithShipmentStatus(
          transactions,
          statusMap
        );

      if (updatedCount > 0) {
        logger.log(
          `✅ Synced ${updatedCount} transactions with current shipment status`
        );

        // Sanitize transactions for API (convert nullable to non-null)
        const sanitized =
          TransactionService.sanitizeTransactions(updatedTransactions);

        // Update via service layer
        bulkUpdateTransactions(sanitized as never);

        // Show notification (will be handled by caller)
        return updatedCount;
      }

      return 0;
    },
    [transactions, bulkUpdateTransactions]
  );

  // Sync on mount and when mappings change (only once when mappings are loaded)
  useEffect(() => {
    if (
      Object.keys(productToShipmentStatusMap).length > 0 &&
      transactions.length > 0
    ) {
      logger.log('🔄 Syncing transactions with current shipment status...');
      syncTransactionsWithShipmentStatus(productToShipmentStatusMap);
    }
    // Only run when product mappings change, NOT when transactions change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productToShipmentStatusMap]);

  // ============================================================================
  // WRAPPER FUNCTIONS - Convert between TransactionData and DTO
  // ============================================================================

  const bulkUpdate = useCallback(
    (data: TransactionData[]) => {
      const sanitized = TransactionService.sanitizeTransactions(data);
      bulkUpdateTransactions(sanitized as never);
    },
    [bulkUpdateTransactions]
  );

  const update = useCallback(
    (params: { id: number; data: Partial<TransactionData> }) => {
      // Convert partial TransactionData to DTO format
      const sanitizedData: Record<string, string | number> = {};
      Object.entries(params.data).forEach(([key, value]) => {
        // Handle null, undefined, or the string 'null'
        if (value === null || value === undefined || value === 'null') {
          // Numeric fields default to 0
          if (
            [
              'Quantity',
              'Unit Price',
              'Discount',
              'Adjustment',
              'Line Total',
            ].includes(key)
          ) {
            sanitizedData[key] = 0;
          } else {
            sanitizedData[key] = '';
          }
        } else {
          sanitizedData[key] = value;
        }
      });

      updateTransaction({ id: params.id, data: sanitizedData as never });
    },
    [updateTransaction]
  );

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // Core data
    transactions,
    isLoading: transactionsLoading,

    // Filtered data
    filteredData,
    searchQuery,
    handleSearch,

    // Status filtering
    selectedStatuses,
    handleStatusFilter,

    // Statistics
    statistics,

    // Lookup data
    customerNames,
    productCodes,
    priceTiers,
    productToShipmentMap,
    productToShipmentStatusMap,

    // Operations
    bulkUpdate,
    update,
  };
}
