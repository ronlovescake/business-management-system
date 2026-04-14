'use client';

/**
 * useTransactionsData Hook
 *
 * Main data hook for Transactions module.
            return await fetchArray<Record<string, unknown>>('/api/customers');
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useTransactionData } from '@/hooks/useSheetData';
import { useDataTable } from '@/components/ui';
import { TransactionService } from '../services/TransactionService';
import { TransactionService as TransactionApiService } from '@/services/TransactionService';
import { GeneralMerchandiseTransactionService } from '@/services/GeneralMerchandiseTransactionService';
import { ALL_STATUS_CONTROLLED_STATUSES } from '../types/transaction.types';
import { MAX_PLACEHOLDER_ROWS } from '@/lib/transactions';
import { queryKeys } from '@/lib/queryKeys';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { ensureArray } from '@/lib/api/normalize';
import { logger } from '@/lib/logger';
import { runMicroBenchmark } from '@/lib/performance/benchmarks';
import type {
  TransactionData,
  PriceTier,
  TransactionStatistics,
} from '../types/transaction.types';
import type { ApiResponse } from '@/types/api';

const SEARCH_STORAGE_KEY = 'transactions-search-query';

async function fetchArray<T>(url: string): Promise<T[]> {
  const response = await api.get<T[] | ApiResponse<T[]>>(url);
  return ensureArray<T>(response);
}

const extractCustomerName = (
  customer: Record<string, unknown>
): string | undefined => {
  const name =
    customer.name ||
    customer.Name ||
    customer.customerName ||
    customer['Customer Name'];

  return name ? String(name) : undefined;
};

/**
 * Safely parse an order date string and return the timestamp for comparisons.
 */
/**
            return await fetchArray<PriceTier>('/api/prices');
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

const loadSavedSearchQuery = (): string => {
  try {
    if (typeof window === 'undefined') {
      return '';
    }
    return localStorage.getItem(SEARCH_STORAGE_KEY) ?? '';
  } catch (error) {
    logger.error('Error loading search query:', error);
    return '';
  }
};

/**
 * Main hook
 */
export function useTransactionsData({
  apiBasePath,
  productCodeSearchQuery,
}: {
  apiBasePath?: string;
  productCodeSearchQuery?: string;
} = {}): UseTransactionsDataReturn {
  const resolvedApiBasePath = apiBasePath ?? '/api';
  const customerLookupBasePath =
    apiBasePath === '/api/general-merchandise' ? undefined : apiBasePath;
  const customerLookupKey = customerLookupBasePath ?? '/api';
  const transactionQueryKey = useMemo(
    () => [...queryKeys.transactions.lists(), resolvedApiBasePath],
    [resolvedApiBasePath]
  );
  const transactionService =
    resolvedApiBasePath === '/api/general-merchandise'
      ? GeneralMerchandiseTransactionService
      : TransactionApiService;
  // ============================================================================
  // DATA FETCHING - Using abstraction layer
  // ============================================================================

  const {
    data: transactions,
    isLoading: transactionsLoading,
    bulkUpdate: bulkUpdateTransactions,
    update: updateTransaction,
  } = useTransactionData({
    service: transactionService,
    queryKey: transactionQueryKey,
  });

  // logger.debug(`Loaded ${transactions.length} transactions from service layer`);

  // ============================================================================
  // LOOKUP DATA - Customer names, product codes, price tiers, mappings
  // ============================================================================

  // Fetch all lookup data in parallel with useQueries
  const lookupQueries = useQueries({
    queries: [
      // Query 1: Customer names from customers API
      {
        queryKey: [...queryKeys.customers.lists(), customerLookupKey],
        queryFn: async () => {
          try {
            const customersData = await api.get<Record<string, unknown>[]>(
              buildApiPath(customerLookupBasePath, '/customers')
            );
            // Extract customer names from the API data
            return customersData
              .map(extractCustomerName)
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
        queryKey: [...queryKeys.prices.lists(), resolvedApiBasePath],
        queryFn: async () => {
          try {
            return await api.get<PriceTier[]>(
              buildApiPath(apiBasePath, '/prices')
            );
          } catch (error) {
            logger.error('Error loading product codes:', error);
            return [];
          }
        },
        staleTime: 30 * 1000,
      },
      // Query 3: Products data for shipment mappings
      {
        queryKey: [...queryKeys.products.lists(), resolvedApiBasePath],
        queryFn: async () => {
          try {
            return await fetchArray<Record<string, unknown>>(
              buildApiPath(apiBasePath, '/products')
            );
          } catch (error) {
            logger.error('Error loading products:', error);
            return [];
          }
        },
        staleTime: 30 * 1000,
      },
      // Query 4: Shipments data for shipment status mappings
      {
        queryKey: [...queryKeys.shipments.lists(), resolvedApiBasePath],
        queryFn: async () => {
          try {
            return await fetchArray<Record<string, unknown>>(
              buildApiPath(apiBasePath, '/shipments')
            );
          } catch (error) {
            logger.error('Error loading shipments:', error);
            return [];
          }
        },
        staleTime: 30 * 1000,
      },
      // Query 5: Split batches so split child SKUs can inherit parent shipment metadata
      {
        queryKey: ['split-batches', resolvedApiBasePath],
        queryFn: async () => {
          try {
            return await fetchArray<Record<string, unknown>>(
              buildApiPath(apiBasePath, '/split-batches')
            );
          } catch (error) {
            logger.error('Error loading split batches:', error);
            return [];
          }
        },
        staleTime: 30 * 1000,
      },
    ],
  });

  // Destructure query results to avoid complex dependencies
  const [customersQuery, pricesQuery, productsQuery, shipmentsQuery, splitBatchesQuery] =
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
  const splitBatchesQueryData = useMemo(
    () => splitBatchesQuery.data || [],
    [splitBatchesQuery.data]
  );

  // Compute customer names from API + transactions
  const customerNames = useMemo(
    () =>
      runMicroBenchmark(
        'useTransactionsData.customerNames',
        () => {
          const normalizedMap = new Map<string, string>();

          const addCustomerName = (rawName: unknown) => {
            if (typeof rawName !== 'string') {
              return;
            }

            const sanitized = rawName.trim();
            if (!sanitized) {
              return;
            }

            const key = sanitized.toLowerCase();
            if (!normalizedMap.has(key)) {
              normalizedMap.set(key, sanitized);
            }
          };

          customersQueryData.forEach(addCustomerName);
          transactions.forEach((transaction) =>
            addCustomerName(transaction.Customers)
          );

          const collator = new Intl.Collator(undefined, {
            sensitivity: 'base',
            numeric: false,
          });

          return Array.from(normalizedMap.values()).sort((a, b) =>
            collator.compare(a, b)
          );
        },
        {
          metadata: {
            customers: customersQueryData.length,
            transactions: transactions.length,
          },
        }
      ),
    [customersQueryData, transactions]
  );

  // Compute product codes and price tiers from prices API
  const { productCodes, priceTiers } = useMemo(
    () =>
      runMicroBenchmark(
        'useTransactionsData.productCodes',
        () => {
          // 🚀 PERFORMANCE: Use Set for O(n) deduplication
          const codes = Array.from(
            new Set(
              pricesQueryData
                .map((price) => price['Product Code'])
                .filter(Boolean)
            )
          ).sort();

          return {
            productCodes: codes,
            priceTiers: pricesQueryData,
          };
        },
        { metadata: { prices: pricesQueryData.length } }
      ),
    [pricesQueryData]
  );

  // Compute product-to-shipment and product-to-shipment-status mappings
  const { productToShipmentMap, productToShipmentStatusMap } = useMemo(
    () =>
      runMicroBenchmark(
        'useTransactionsData.productToShipmentMap',
        () => {
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
            const directShipmentStatus = String(
              product.shipmentStatus || product['Shipment Status'] || ''
            ).trim();

            if (productCode && shipmentCode) {
              shipmentMapping[productCode] = shipmentCode;

              const correspondingShipmentStatus =
                shipmentCodeToStatus[shipmentCode] || directShipmentStatus;
              // Avoid writing blank shipment statuses into the sync map.
              // Blank here is typically a transient fetch-order state and can
              // incorrectly force transactions back to "In Transit".
              if (correspondingShipmentStatus.trim() !== '') {
                statusMapping[productCode] = correspondingShipmentStatus;
              }
            } else if (productCode && directShipmentStatus !== '') {
              statusMapping[productCode] = directShipmentStatus;
            }
          });

          const productMetadataByCode = new Map<
            string,
            { shipmentCode: string; shipmentStatus: string }
          >();

          productsQueryData.forEach((product) => {
            const productCode = String(
              product.productCode || product['Product Code'] || ''
            ).trim();
            if (!productCode) {
              return;
            }

            productMetadataByCode.set(productCode.toLowerCase(), {
              shipmentCode: String(
                product.shipmentCode || product['Shipment Code'] || ''
              ).trim(),
              shipmentStatus: String(
                product.shipmentStatus || product['Shipment Status'] || ''
              ).trim(),
            });
          });

          splitBatchesQueryData.forEach((batch) => {
            const parentSku = String(batch['splitSku'] || '').trim();
            if (!parentSku) {
              return;
            }

            const parentMetadata = productMetadataByCode.get(
              parentSku.toLowerCase()
            );
            if (!parentMetadata) {
              return;
            }

            const components = Array.isArray(batch.components)
              ? (batch.components as Array<Record<string, unknown>>)
              : [];

            components.forEach((component) => {
              const componentSku = String(
                component.componentSku || component['componentSku'] || ''
              ).trim();
              if (!componentSku) {
                return;
              }

              if (parentMetadata.shipmentCode) {
                shipmentMapping[componentSku] = parentMetadata.shipmentCode;
              }

              const resolvedStatus =
                shipmentCodeToStatus[parentMetadata.shipmentCode] ||
                parentMetadata.shipmentStatus;
              if (resolvedStatus) {
                statusMapping[componentSku] = resolvedStatus;
              }
            });
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
        },
        {
          metadata: {
            products: productsQueryData.length,
            shipments: shipmentsQueryData.length,
            splitBatches: splitBatchesQueryData.length,
          },
        }
      ),
    [productsQueryData, shipmentsQueryData, splitBatchesQueryData]
  );

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

  const searchQueryInitialRef = useRef<string | null>(null);
  if (searchQueryInitialRef.current === null) {
    searchQueryInitialRef.current = loadSavedSearchQuery();
  }

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
    searchMode: 'terms-all',
    initialSearchQuery: searchQueryInitialRef.current ?? '',
  });

  useEffect(() => {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      if (!searchQuery || searchQuery.trim() === '') {
        localStorage.removeItem(SEARCH_STORAGE_KEY);
        return;
      }

      localStorage.setItem(SEARCH_STORAGE_KEY, searchQuery);
    } catch (error) {
      logger.error('Error saving search query:', error);
    }
  }, [searchQuery]);

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

  const productCodeFilteredData = useMemo(() => {
    const normalizedProductCodeSearch =
      productCodeSearchQuery?.trim().toLowerCase() ?? '';

    if (!normalizedProductCodeSearch) {
      return filteredData;
    }

    return filteredData.filter((transaction) => {
      const productCode = transaction['Product Code']?.toLowerCase() ?? '';
      return productCode.includes(normalizedProductCodeSearch);
    });
  }, [filteredData, productCodeSearchQuery]);

  // Provide stable placeholder rows so users can create new transactions from the grid
  const placeholderRows = useMemo(() => {
    return Array.from({ length: MAX_PLACEHOLDER_ROWS }).map(
      () =>
        ({
          id: undefined,
          'Order Date': '',
          Customers: '',
          'Product Code': '',
          Quantity: 0,
          'Unit Price': 0,
          Discount: 0,
          Adjustment: 0,
          'Line Total': 0,
          'Order Status': '',
          Notes: '',
          'Invoice Date': '',
          'Packed Date': '',
          'Shipment Code': '',
        }) as TransactionData
    );
  }, []);

  const filteredDataWithPlaceholders = useMemo(() => {
    return [...productCodeFilteredData, ...placeholderRows];
  }, [productCodeFilteredData, placeholderRows]);

  // ============================================================================
  // STATISTICS CALCULATION
  // ============================================================================

  const statistics = useMemo(() => {
    return TransactionService.calculateStatistics(productCodeFilteredData);
  }, [productCodeFilteredData]);

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

        const changedTransactions = updatedTransactions.filter(
          (transaction, index) => {
            const previous = transactions[index];
            return (
              previous &&
              transaction.id !== undefined &&
              transaction['Order Status'] !== previous['Order Status']
            );
          }
        );

        if (changedTransactions.length === 0) {
          return 0;
        }

        const sanitized =
          TransactionService.sanitizeTransactions(changedTransactions);

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
    filteredData: filteredDataWithPlaceholders,
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
