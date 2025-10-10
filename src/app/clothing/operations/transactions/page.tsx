'use client';

// ==============================================================================
// 🚨🚨🚨 CRITICAL WARNING - READ BEFORE MAKING ANY CHANGES 🚨🚨🚨
// ==============================================================================
//
// 🔒 **PROTECTED BUSINESS LOGIC** 🔒
//
// This file contains FINALIZED and BUSINESS-APPROVED logic including:
// ✅ BEAUTIFUL INVOICE GENERATION SYSTEM (handleGenerateInvoice function)
// ✅ PERFECT DATABASE PERSISTENCE (comprehensive save operations)
// ✅ AUTOMATED BUSINESS WORKFLOWS (customer consolidation & status updates)
//
// 📋 See INVOICE_GENERATION_LOGIC_PROTECTION.md for complete protection details
//
// This file contains FINALIZED business logic that has been carefully designed,
// tested, and approved by the business owner.
//
// ✅ ALLOWED MODIFICATIONS:
//    - Fix TypeScript/ESLint errors or warnings
//    - Fix runtime bugs that break functionality
//    - Improve code structure/organization (refactoring)
//    - Add new features that don't affect existing logic
//    - Update UI/styling without changing behavior
//
// ❌ FORBIDDEN MODIFICATIONS (without explicit business approval):
//    - Change computation formulas (Unit Price, Line Total)
//    - Modify auto-population logic (Product Code, Quantity, Discount handlers)
//    - Alter business rules or calculation sequences
//    - Change when/how fields are auto-populated or cleared
//
// 📋 FINALIZED FORMULAS - DO NOT CHANGE:
//    1. Unit Price = Tier Price - Discount
//    2. Line Total = (Quantity × Unit Price) - Adjustment
//
// 📚 DOCUMENTATION:
//    - Complete logic documentation: TRANSACTIONS_LOGIC_SUMMARY.md
//    - Look for "⚠️ FINALIZED LOGIC" comments throughout this file
//
// 🚨 IF YOU NEED TO CHANGE THE BUSINESS LOGIC:
//    1. DO NOT proceed without business owner approval
//    2. Update TRANSACTIONS_LOGIC_SUMMARY.md with changes
//    3. Test thoroughly with real business scenarios
//    4. Update all warning comments to reflect new logic
//
// ==============================================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { StatCard, useDataTable } from '../../../../components/ui';
import { TransactionsLayout } from '../../../../components/features/transactions';
import { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';
import { useTransactionData } from '../../../../hooks/useSheetData';
import { GridCellKind } from '@glideapps/glide-data-grid';
import { allCells } from '@glideapps/glide-data-grid-cells';
import { notifications } from '@mantine/notifications';
import {
  Modal,
  Button,
  Text,
  Group,
  Stack,
  Alert,
  Divider,
} from '@mantine/core';
import {
  IconReceipt,
  IconCurrencyDollar,
  IconPackage,
  IconTruck,
  IconShoppingCart,
  IconAdjustments,
  IconPercentage,
  IconCheck,
  IconAlertTriangle,
  IconUsers,
  IconClipboardList,
  IconX,
} from '@tabler/icons-react';

interface TransactionData {
  id?: number;
  'Order Date': string;
  Customers: string;
  'Product Code': string;
  Quantity: number | null;
  'Unit Price': number | null;
  Discount: number | null;
  Adjustment: number | null;
  'Line Total': number | null;
  'Order Status': string;
  Notes: string;
  'Invoice Date': string;
  'Packed Date': string;
  'Shipment Code': string;
}

export default function Transactions() {
  // ============================================================================
  // 🚀 ABSTRACTION LAYER - Replace direct API calls with service layer
  // ============================================================================

  // Main data hooks - replace direct API calls
  const {
    data: transactions,
    isLoading: transactionsLoading,
    bulkUpdate: bulkUpdateTransactions,
    update: updateTransaction,
  } = useTransactionData();

  // Batch mode tracking for paste operations - use ref for synchronous updates
  const isBatchModeRef = useRef(false);
  const batchUpdatesRef = useRef<Map<number, Partial<TransactionData>>>(
    new Map()
  );

  // Listen for batch start and complete events from HandsontableGrid
  useEffect(() => {
    const handleBatchStart = () => {
      console.log(
        '🚀 Batch mode STARTED - suppressing notifications and batching API calls'
      );
      isBatchModeRef.current = true;
      batchUpdatesRef.current.clear(); // Clear any previous batch
    };

    const handleBatchComplete = (event: Event) => {
      const customEvent = event as CustomEvent<{ count: number }>;
      console.log(
        `✅ Batch mode COMPLETE - processed ${customEvent.detail.count} cells`
      );

      // Flush all batched updates to API using bulk update
      const batchedUpdates: TransactionData[] = [];

      batchUpdatesRef.current.forEach((data, id) => {
        // Convert TransactionData (nullable) to TransactionDTO (non-nullable) format
        const fullTransaction = transactions.find((t) => t.id === id);
        if (fullTransaction) {
          batchedUpdates.push({
            ...fullTransaction,
            ...data,
            // Ensure non-null values for required fields
            Quantity: data.Quantity ?? fullTransaction.Quantity ?? 0,
            'Unit Price':
              data['Unit Price'] ?? fullTransaction['Unit Price'] ?? 0,
            Discount: data.Discount ?? fullTransaction.Discount ?? 0,
            Adjustment: data.Adjustment ?? fullTransaction.Adjustment ?? 0,
            'Line Total':
              data['Line Total'] ?? fullTransaction['Line Total'] ?? 0,
          });
        }
      });

      if (batchedUpdates.length > 0) {
        console.log(
          `📤 Flushing ${batchedUpdates.length} batched updates to API`
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        bulkUpdateTransactions(batchedUpdates as any); // Type cast to handle DTO conversion
      }

      isBatchModeRef.current = false;
      batchUpdatesRef.current.clear();

      // Show SINGLE summary notification for all batch changes
      notifications.show({
        title: 'Success',
        message: `Successfully updated ${batchedUpdates.length} transactions`,
        color: 'green',
      });
    };

    window.addEventListener('handsontable-batch-start', handleBatchStart);
    window.addEventListener('handsontable-batch-complete', handleBatchComplete);

    return () => {
      window.removeEventListener('handsontable-batch-start', handleBatchStart);
      window.removeEventListener(
        'handsontable-batch-complete',
        handleBatchComplete
      );
    };
  }, [transactions, bulkUpdateTransactions]);

  // Derived state from service data (replaces direct API state)
  const [customerNames, setCustomerNames] = useState<string[]>([]);
  const [productCodes, setProductCodes] = useState<string[]>([]);
  const [priceTiers, setPriceTiers] = useState<
    Array<{
      'Product Code': string;
      'Lower Limit': number;
      'Upper Limit': number;
      Prices: number;
    }>
  >([]);
  const [productToShipmentMap, setProductToShipmentMap] = useState<
    Record<string, string>
  >({});
  const [productToShipmentStatusMap, setProductToShipmentStatusMap] = useState<
    Record<string, string>
  >({});

  // Define which statuses are controlled by "All Status"
  const allStatusControlledStatuses = [
    'In Transit',
    'Warehouse',
    'Prepared',
    'Ready For Dispatch',
    'Checked Out',
    'Lalamove',
    'On-Hold',
    'Pending Payment',
  ];

  // Load saved filter state from localStorage
  const loadSavedFilterState = (): Set<string> => {
    try {
      if (typeof window === 'undefined') return new Set(['All Status']);
      const saved = localStorage.getItem('transactions-filter-state');
      if (saved) {
        const parsedArray = JSON.parse(saved) as string[];
        const savedSet = new Set(parsedArray);

        // If "All Status" is saved, ensure all controlled statuses are also included
        if (savedSet.has('All Status')) {
          allStatusControlledStatuses.forEach((status) => savedSet.add(status));
        }

        return savedSet;
      }
    } catch (error) {
      console.error('Error loading filter state:', error);
    }
    // Default state: All Status + all controlled statuses
    const defaultSet = new Set(['All Status']);
    allStatusControlledStatuses.forEach((status) => defaultSet.add(status));
    return defaultSet;
  };

  // UI state - Service layer handles data loading
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    loadSavedFilterState()
  );
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isGeneratingDistribution, setIsGeneratingDistribution] =
    useState(false);
  const [isGeneratingPackingList, setIsGeneratingPackingList] = useState(false);

  // Modern confirmation dialog state
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    customers: number;
    warehouseOrders: number;
    preparedOrders: number;
    totalTransactions: number;
  }>({
    customers: 0,
    warehouseOrders: 0,
    preparedOrders: 0,
    totalTransactions: 0,
  });
  const [pendingInvoiceData, setPendingInvoiceData] = useState<
    TransactionData[] | null
  >(null);

  // Packing list confirmation dialog state
  const [showPackingListModal, setShowPackingListModal] = useState(false);
  const [packingListData, setPackingListData] = useState<{
    eligibleTransactions: number;
    customers: number;
    totalValue: number;
  }>({ eligibleTransactions: 0, customers: 0, totalValue: 0 });
  const [pendingPackingListData, setPendingPackingListData] = useState<
    TransactionData[] | null
  >(null);

  // Distribution confirmation dialog state
  const [showDistributionModal, setShowDistributionModal] = useState(false);
  const [distributionData, setDistributionData] = useState<{
    warehouseTransactions: number;
    customers: number;
    totalValue: number;
    totalQuantity: number;
  }>({
    warehouseTransactions: 0,
    customers: 0,
    totalValue: 0,
    totalQuantity: 0,
  });
  const [pendingDistributionData, setPendingDistributionData] = useState<
    TransactionData[] | null
  >(null);

  // Customer warning modal state
  const [showCustomerWarningModal, setShowCustomerWarningModal] =
    useState(false);
  const [customerWarningData, setCustomerWarningData] = useState<{
    customerName: string;
    warnings: string[];
    onProceed: () => void;
    onCancel: () => void;
  } | null>(null);

  // ============================================================================
  // SERVICE LAYER INTEGRATION - Transactions data loaded via useTransactionData()
  // ============================================================================
  // Transactions are now loaded automatically via service layer
  console.log(`Loaded ${transactions.length} transactions from service layer`);

  // Load customer names from customers API and imported transactions
  useEffect(() => {
    const loadCustomerNames = async () => {
      try {
        let apiCustomers: string[] = [];

        // Try to fetch customer names from the customers API
        try {
          const response = await fetch('/api/customers', {
            next: { revalidate: 30 },
          });
          if (response.ok) {
            const customersData = await response.json();
            // Extract customer names from the API data (handle various possible field names)
            apiCustomers = customersData
              .map((customer: Record<string, unknown>) => {
                return (
                  customer.name ||
                  customer.Name ||
                  customer.customerName ||
                  customer['Customer Name']
                );
              })
              .filter(Boolean)
              .map(String); // Ensure all values are strings
          }
        } catch (apiError) {
          console.warn('Could not fetch customers from API:', apiError);
        }

        // Extract unique customer names from imported transactions
        const transactionCustomers = transactions
          .map((t) => t.Customers)
          .filter(Boolean);

        // 🚀 PERFORMANCE: Use Set for O(n) deduplication instead of O(n²)
        const allCustomers = Array.from(
          new Set([...apiCustomers, ...transactionCustomers])
        ).sort();

        setCustomerNames(allCustomers);
      } catch (error) {
        console.error('Error loading customer names:', error);
        setCustomerNames([]);
      }
    };

    loadCustomerNames();
  }, [transactions]); // Re-run when transactions change

  // Load product codes from prices API
  useEffect(() => {
    const loadProductCodes = async () => {
      try {
        const response = await fetch('/api/prices', {
          next: { revalidate: 30 },
        });
        if (response.ok) {
          const pricesData = await response.json();

          // Store all price tiers for unit price lookup
          setPriceTiers(pricesData);

          // 🚀 PERFORMANCE: Use Set for O(n) deduplication instead of O(n²)
          const codes = Array.from(
            new Set(
              pricesData
                .map(
                  (price: { 'Product Code': string }) => price['Product Code']
                )
                .filter(Boolean)
            )
          ).sort() as string[];

          setProductCodes(codes);
        } else {
          console.error('Failed to fetch prices data');
          setProductCodes([]);
          setPriceTiers([]);
        }
      } catch (error) {
        console.error('Error loading product codes:', error);
        setProductCodes([]);
        setPriceTiers([]);
      }
    };

    loadProductCodes();
  }, []); // Run once on component mount

  // Load product-to-shipment and product-to-shipment-status mappings from products API
  useEffect(() => {
    const loadProductMappings = async () => {
      try {
        // Fetch both products and shipments data
        const [productsResponse, shipmentsResponse] = await Promise.all([
          fetch('/api/products', { next: { revalidate: 30 } }),
          fetch('/api/shipments', { next: { revalidate: 30 } }),
        ]);

        if (productsResponse.ok && shipmentsResponse.ok) {
          const productsData = await productsResponse.json();
          const shipmentsData = await shipmentsResponse.json();

          // Create mapping from Product Code to Shipment Code
          const shipmentMapping: Record<string, string> = {};
          // Create mapping from Product Code to Shipment Status
          const statusMapping: Record<string, string> = {};

          // Create mapping from Shipment Code to Shipment Status from shipments data
          const shipmentCodeToStatus: Record<string, string> = {};

          shipmentsData.forEach((shipment: Record<string, unknown>) => {
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

          productsData.forEach((product: Record<string, unknown>) => {
            const productCode = String(
              product.productCode || product['Product Code'] || ''
            );
            const shipmentCode = String(
              product.shipmentCode || product['Shipment Code'] || ''
            );

            if (productCode && shipmentCode) {
              shipmentMapping[productCode] = shipmentCode;

              // Get the shipment status from the shipments data using the shipment code
              const correspondingShipmentStatus =
                shipmentCodeToStatus[shipmentCode] || '';
              statusMapping[productCode] = correspondingShipmentStatus;
            }
          });

          console.log(
            `✅ Loaded product-to-shipment mappings: ${Object.keys(statusMapping).length} products mapped`
          );

          setProductToShipmentMap(shipmentMapping);
          setProductToShipmentStatusMap(statusMapping);
        } else {
          console.error(
            'Failed to fetch data:',
            !productsResponse.ok ? 'products API failed' : '',
            !shipmentsResponse.ok ? 'shipments API failed' : ''
          );
          setProductToShipmentMap({});
          setProductToShipmentStatusMap({});
        }
      } catch (error) {
        console.error('Error loading product mappings:', error);
        setProductToShipmentMap({});
        setProductToShipmentStatusMap({});
      }
    };

    loadProductMappings();
  }, []); // Run once on component mount

  // ============================================================================
  // CUSTOMER VALIDATION LOGIC - Check for banned customers and high cancellation rates
  // ============================================================================
  const validateCustomer = useCallback(
    async (
      customerName: string
    ): Promise<{
      isValid: boolean;
      warnings: string[];
      customerData?: Record<string, unknown>;
    }> => {
      try {
        if (!customerName || customerName.trim() === '') {
          return { isValid: true, warnings: [] };
        }

        // Fetch all customers to find the selected customer
        const response = await fetch('/api/customers');
        if (!response.ok) {
          console.warn('Could not fetch customer data for validation');
          return { isValid: true, warnings: [] };
        }

        const customersData = await response.json();
        const customer = customersData.find(
          (c: Record<string, unknown>) =>
            (c['Customer Name'] || c.customerName || c.name) ===
            customerName.trim()
        );

        if (!customer) {
          // Customer not found in database, allow but warn
          return {
            isValid: true,
            warnings: [`Customer "${customerName}" not found in database`],
          };
        }

        const warnings: string[] = [];
        let isValid = true;
        const customerStatus =
          customer['Customer Status'] || customer.customerStatus || '';

        // Check if customer is banned
        if (customerStatus.toLowerCase().includes('banned')) {
          warnings.push(
            `🚫 BANNED CUSTOMER: "${customerName}" is marked as BANNED`
          );
          isValid = false; // This is a critical warning
        }

        // Calculate cancellation rate from transactions
        try {
          const customerId = customer.id;
          if (customerId) {
            const transactionsResponse = await fetch(
              `/api/customers/${customerId}/transactions`
            );
            if (transactionsResponse.ok) {
              const customerTransactions = await transactionsResponse.json();

              if (customerTransactions.length > 0) {
                const cancelledTransactions = customerTransactions.filter(
                  (t: Record<string, unknown>) =>
                    String(t.orderStatus || '')
                      .toLowerCase()
                      .includes('cancel')
                ).length;

                const cancellationRate = Math.round(
                  (cancelledTransactions / customerTransactions.length) * 100
                );

                if (cancellationRate >= 50) {
                  // 50% or higher cancellation rate
                  warnings.push(
                    `⚠️ HIGH CANCELLATION RATE: "${customerName}" has a ${cancellationRate}% cancellation rate (${cancelledTransactions}/${customerTransactions.length} orders cancelled)`
                  );
                }
              }
            }
          }
        } catch (error) {
          console.warn(
            'Could not calculate cancellation rate for customer:',
            error
          );
        }

        return {
          isValid,
          warnings,
          customerData: customer,
        };
      } catch (error) {
        console.error('Error validating customer:', error);
        return { isValid: true, warnings: [] };
      }
    },
    []
  );

  // Helper function to determine Order Status based on Shipment Status
  const getOrderStatusFromShipmentStatus = useCallback(
    (shipmentStatus: string): string => {
      if (!shipmentStatus || shipmentStatus.trim() === '') {
        return 'In Transit';
      }

      const normalizedStatus = shipmentStatus.trim();

      // If Shipment Status is: blank, In Transit, Manila Port, With Pier Gatepass, PH Warehouse
      // Set Order Status to: "In Transit"
      const inTransitStatuses = [
        'In Transit',
        'Manila Port',
        'With Pier Gatepass',
        'PH Warehouse',
      ];

      // If Shipment Status is: For Pickup, Sorting, Delivered
      // Set Order Status to: "Warehouse"
      const warehouseStatuses = ['For Pickup', 'Sorting', 'Delivered'];

      if (inTransitStatuses.includes(normalizedStatus)) {
        return 'In Transit';
      } else if (warehouseStatuses.includes(normalizedStatus)) {
        return 'Warehouse';
      }

      // Default fallback for unknown statuses
      return 'In Transit';
    },
    []
  );

  // Function to sync existing transactions with current shipment status
  const syncTransactionsWithShipmentStatus = useCallback(
    (statusMap: Record<string, string>) => {
      let updatedCount = 0;
      const updatedTransactions = transactions.map((transaction) => {
        const productCode = transaction['Product Code'];

        if (!productCode) {
          return transaction; // No product code, can't sync
        }

        const currentOrderStatus = transaction['Order Status'] || '';
        const shouldAutoPopulateStatus =
          currentOrderStatus === '' ||
          currentOrderStatus.toLowerCase() === 'in transit' ||
          currentOrderStatus.toLowerCase() === 'warehouse'; // Allow updating Warehouse status too

        if (!shouldAutoPopulateStatus) {
          return transaction; // Don't override manually set statuses
        }

        // Get current shipment status for this product
        const currentShipmentStatus = statusMap[productCode];

        if (!currentShipmentStatus || currentShipmentStatus === '') {
          return transaction; // No shipment status found
        }

        // Calculate what the ORDER STATUS should be
        const newOrderStatus = getOrderStatusFromShipmentStatus(
          currentShipmentStatus
        );

        // Only update if different
        if (currentOrderStatus !== newOrderStatus) {
          updatedCount++;
          console.log(
            `Syncing transaction: ${productCode} -> ${currentOrderStatus} to ${newOrderStatus} (shipment status: ${currentShipmentStatus})`
          );

          return {
            ...transaction,
            'Order Status': newOrderStatus,
          };
        }

        return transaction;
      });

      if (updatedCount > 0) {
        console.log(
          `✅ Synced ${updatedCount} transactions with current shipment status`
        );

        // Update via service layer
        bulkUpdateTransactions(updatedTransactions);

        // Show notification to user
        notifications.show({
          title: 'ORDER STATUS Updated',
          message: `Synced ${updatedCount} transaction(s) with current shipment status`,
          color: 'blue',
          position: 'top-right',
        });
      }
    },
    [transactions, getOrderStatusFromShipmentStatus, bulkUpdateTransactions]
  );

  // Sync transactions with current shipment status whenever mappings or transactions change
  useEffect(() => {
    if (
      Object.keys(productToShipmentStatusMap).length > 0 &&
      transactions.length > 0
    ) {
      console.log('🔄 Syncing transactions with current shipment status...');
      syncTransactionsWithShipmentStatus(productToShipmentStatusMap);
    }
  }, [
    productToShipmentStatusMap,
    transactions.length,
    syncTransactionsWithShipmentStatus,
  ]);

  // Save filter state to localStorage whenever it changes
  useEffect(() => {
    try {
      const statusArray = Array.from(selectedStatuses);
      localStorage.setItem(
        'transactions-filter-state',
        JSON.stringify(statusArray)
      );
    } catch (error) {
      console.error('Error saving filter state:', error);
    }
  }, [selectedStatuses]);

  // ============================================================================
  // 🚨🚨🚨 CRITICAL: FINALIZED INVOICE GENERATION LOGIC - DO NOT MODIFY! 🚨🚨🚨
  // ============================================================================
  //
  // ⚠️ THIS FUNCTION IS PRODUCTION-READY AND BUSINESS-APPROVED ⚠️
  //
  // This invoice generation function has been carefully designed and tested.
  // It handles complex business logic including:
  //
  // ✅ FINALIZED FEATURES (DO NOT CHANGE):
  //    1. Customer order consolidation (Warehouse + Prepared orders)
  //    2. Automated status workflow (Warehouse → Prepared after invoicing)
  //    3. Consistent invoice date setting and database persistence
  //    4. Professional PDF layout with optimized template
  //    5. Comprehensive database updates for all processed transactions
  //
  // 🚫 ABSOLUTELY FORBIDDEN TO MODIFY:
  //    - Customer consolidation algorithm (3-step process)
  //    - Status update logic (Warehouse → Prepared)
  //    - Invoice date setting and database persistence
  //    - Transaction processing workflow
  //    - Database save operations
  //
  // 💫 BUSINESS IMPACT:
  //    - Eliminates manual invoice generation processes
  //    - Provides automated order status management
  //    - Ensures professional invoice appearance
  //    - Maintains complete audit trail in database
  //
  // 🚨 WARNING: Any modifications to this function could break:
  //    - Invoice generation workflow
  //    - Customer order consolidation
  //    - Database consistency
  //    - Business process automation
  //
  // 📞 CONTACT BUSINESS OWNER BEFORE ANY CHANGES!
  // ============================================================================
  // Note: This needs to be moved after filteredData is defined
  // For now, we'll pass filteredData as a parameter
  const handleGenerateInvoice = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      // ⚠️ FINALIZED LOGIC - DO NOT MODIFY
      console.log(
        '📄 Preparing invoice generation for customers with Warehouse orders...'
      );

      try {
        // Step 1: Find customers who have orders with "Warehouse" status FROM VISIBLE/FILTERED DATA
        const warehouseTransactions = visibleTransactions.filter(
          (transaction) => transaction['Order Status'] === 'Warehouse'
        );

        if (warehouseTransactions.length === 0) {
          notifications.show({
            title: '⚠️ No Warehouse Transactions',
            message:
              'No visible transactions with "Warehouse" status found for invoice generation.',
            color: 'yellow',
            autoClose: 5000,
          });
          return;
        }

        // Step 2: Get unique customers who have warehouse orders IN VISIBLE DATA for confirmation
        const previewCustomersWithWarehouseOrders = new Set(
          warehouseTransactions
            .map((transaction) => transaction.Customers)
            .filter(Boolean)
        );

        // Step 3: Count orders for confirmation dialog
        let previewTotalWarehouseOrders = 0;
        let previewTotalPreparedOrders = 0;

        previewCustomersWithWarehouseOrders.forEach((customerName) => {
          // Get all warehouse orders for this customer FROM VISIBLE DATA
          const customerWarehouseOrders = visibleTransactions.filter(
            (transaction) =>
              transaction.Customers === customerName &&
              transaction['Order Status'] === 'Warehouse'
          );

          // Get all prepared orders for this customer FROM VISIBLE DATA
          const customerPreparedOrders = visibleTransactions.filter(
            (transaction) =>
              transaction.Customers === customerName &&
              transaction['Order Status'] === 'Prepared'
          );

          previewTotalWarehouseOrders += customerWarehouseOrders.length;
          previewTotalPreparedOrders += customerPreparedOrders.length;
        });

        // Show modern confirmation dialog with detailed information
        setConfirmationData({
          customers: previewCustomersWithWarehouseOrders.size,
          warehouseOrders: previewTotalWarehouseOrders,
          preparedOrders: previewTotalPreparedOrders,
          totalTransactions:
            previewTotalWarehouseOrders + previewTotalPreparedOrders,
        });
        setPendingInvoiceData(visibleTransactions);
        setShowConfirmationModal(true);
      } catch (error) {
        console.error('Error preparing invoice generation:', error);
        notifications.show({
          title: '❌ Invoice Preparation Failed',
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while preparing invoice generation',
          color: 'red',
          autoClose: 7000,
        });
      }
    },
    []
  );

  // Handle confirmation modal actions
  const handleConfirmInvoiceGeneration = useCallback(async () => {
    setShowConfirmationModal(false);

    if (!pendingInvoiceData) {
      notifications.show({
        title: '❌ Error',
        message: 'No invoice data available for processing',
        color: 'red',
        autoClose: 5000,
      });
      return;
    }

    // User confirmed - proceed with invoice generation
    console.log('📄 User confirmed - proceeding with invoice generation...');
    setIsGeneratingInvoice(true);

    try {
      const visibleTransactions = pendingInvoiceData;

      // Step 1: Find customers who have orders with "Warehouse" status FROM VISIBLE/FILTERED DATA
      const warehouseTransactions = visibleTransactions.filter(
        (transaction) => transaction['Order Status'] === 'Warehouse'
      );

      // Step 2: Get unique customers who have warehouse orders IN VISIBLE DATA
      const customersWithWarehouseOrders = new Set(
        warehouseTransactions
          .map((transaction) => transaction.Customers)
          .filter(Boolean)
      );
      console.log(
        '👥 Customers with Warehouse orders (from visible data):',
        Array.from(customersWithWarehouseOrders)
      );

      // Step 3: For each customer with warehouse orders, get their orders FROM VISIBLE DATA ONLY
      const invoiceTransactions: TransactionData[] = [];
      let totalWarehouseOrders = 0;
      let totalPreparedOrders = 0;

      customersWithWarehouseOrders.forEach((customerName) => {
        // Get all warehouse orders for this customer FROM VISIBLE DATA
        const customerWarehouseOrders = visibleTransactions.filter(
          (transaction) =>
            transaction.Customers === customerName &&
            transaction['Order Status'] === 'Warehouse'
        );

        // Get all prepared orders for this customer FROM VISIBLE DATA
        const customerPreparedOrders = visibleTransactions.filter(
          (transaction) =>
            transaction.Customers === customerName &&
            transaction['Order Status'] === 'Prepared'
        );

        // Combine both warehouse and prepared orders for this customer
        const customerAllOrders = [
          ...customerWarehouseOrders,
          ...customerPreparedOrders,
        ];

        console.log(
          `📦 Customer "${customerName}": ${customerWarehouseOrders.length} Warehouse + ${customerPreparedOrders.length} Prepared = ${customerAllOrders.length} total orders (from visible data)`
        );

        invoiceTransactions.push(...customerAllOrders);
        totalWarehouseOrders += customerWarehouseOrders.length;
        totalPreparedOrders += customerPreparedOrders.length;
      });

      // Fetch customer details for the invoice
      const customersResponse = await fetch('/api/customers');
      let customersData = [];

      if (customersResponse.ok) {
        customersData = await customersResponse.json();
      } else {
        console.warn(
          'Could not fetch customer details, proceeding without full customer info'
        );
      }

      // Prepare data for invoice generation API
      const invoicePayload = {
        transactions: invoiceTransactions,
        customers: customersData,
      };

      console.log(
        `📋 Found ${totalWarehouseOrders} Warehouse + ${totalPreparedOrders} Prepared = ${invoiceTransactions.length} total transactions for ${customersWithWarehouseOrders.size} customers`
      );

      // Call the invoice generation API
      const response = await fetch('/api/generate-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invoicePayload),
      });

      if (response.ok) {
        // Get the PDF blob
        const pdfBlob = await response.blob();

        // Create download link
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;

        // Generate filename with timestamp
        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:-]/g, '');
        link.download = `invoices-${timestamp}.pdf`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Show success notification
        const statusUpdateMessage =
          totalWarehouseOrders > 0
            ? ` All ${totalWarehouseOrders} Warehouse orders updated to Prepared status.`
            : '';

        notifications.show({
          title: '✅ Invoices Generated & Status Updated',
          message: `PDF with invoices for ${totalWarehouseOrders} Warehouse + ${totalPreparedOrders} Prepared orders (${invoiceTransactions.length} total) from ${customersWithWarehouseOrders.size} customers has been downloaded.${statusUpdateMessage}`,
          color: 'green',
          autoClose: 8000,
        });

        // ========================================================================
        // 🚨 CRITICAL DATABASE PERSISTENCE LOGIC - FINALIZED - DO NOT MODIFY! 🚨
        // ========================================================================
        //
        // ⚠️ THIS SECTION ENSURES INVOICE DATES ARE PERMANENTLY SAVED
        //
        // BUSINESS CRITICAL FUNCTIONALITY:
        // 1. Sets invoice dates for ALL processed transactions
        // 2. Updates Warehouse orders to Prepared status
        // 3. Saves EVERYTHING to database (prevents data loss)
        // 4. Handles edge cases (empty strings, whitespace)
        //
        // 🚫 DO NOT MODIFY - COULD CAUSE DATA LOSS:
        //    - Invoice date checking logic
        //    - Database persistence operations
        //    - Status update workflow
        //    - Transaction processing sequence
        //
        // This logic was specifically designed to fix critical bugs where
        // invoice dates were not being saved to database consistently.
        // ========================================================================

        // ⚠️ FINALIZED: Invoice date setting logic
        const currentDate = new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

        // ⚠️ FINALIZED: Transaction processing identification
        const processedTransactionIds = new Set(
          invoiceTransactions.map((t) => t.id)
        );

        const updatedTransactions = transactions.map((transaction) => {
          const updates: Partial<TransactionData> = {};
          let hasUpdates = false;

          // Set Invoice Date if not already set (check for empty, null, or whitespace)
          if (
            processedTransactionIds.has(transaction.id) &&
            (!transaction['Invoice Date'] ||
              transaction['Invoice Date'].trim() === '')
          ) {
            updates['Invoice Date'] = currentDate;
            hasUpdates = true;
          }

          // Update Warehouse orders to Prepared status after invoicing
          if (
            processedTransactionIds.has(transaction.id) &&
            transaction['Order Status'] === 'Warehouse'
          ) {
            updates['Order Status'] = 'Prepared';
            hasUpdates = true;
          }

          return hasUpdates ? { ...transaction, ...updates } : transaction;
        });

        // Update transactions via service layer
        const sanitizedTransactions = updatedTransactions.map((t) => ({
          ...t,
          Quantity: t.Quantity ?? 0,
          'Unit Price': t['Unit Price'] ?? 0,
          Discount: t.Discount ?? 0,
          Adjustment: t.Adjustment ?? 0,
          'Line Total': t['Line Total'] ?? 0,
        }));
        bulkUpdateTransactions(sanitizedTransactions);

        // ========================================================================
        // 🚨 CRITICAL DATABASE SAVE OPERATION - FINALIZED - DO NOT MODIFY! 🚨
        // ========================================================================
        //
        // ⚠️ THIS IS THE CORE DATABASE PERSISTENCE LOGIC
        //
        // CRITICAL BUG FIX: This section was specifically added to solve
        // the issue where invoice dates were not being saved consistently.
        //
        // 🚫 ABSOLUTELY DO NOT MODIFY:
        //    - Transaction filtering logic
        //    - Promise.all database operations
        //    - Error handling for database saves
        //    - Logging and counting logic
        //
        // ANY CHANGES HERE COULD CAUSE:
        //    - Invoice dates to disappear after page reload
        //    - Database inconsistency
        //    - Loss of transaction status updates
        //    - Business process failures
        // ========================================================================

        // ⚠️ FINALIZED: Identify all transactions that need database updates
        const transactionsToSave = updatedTransactions.filter((transaction) =>
          processedTransactionIds.has(transaction.id)
        );

        if (transactionsToSave.length > 0) {
          // ⚠️ FINALIZED: Comprehensive database save operation
          try {
            const updatePromises = transactionsToSave.map((transaction) =>
              saveTransactionToDatabase(transaction)
            );
            await Promise.all(updatePromises);

            // 🚀 PERFORMANCE: Create Map for O(1) lookups instead of O(n) .find()
            const originalTransactionsMap = new Map(
              transactions.map((t) => [t.id, t])
            );

            // Count different types of updates for logging
            const invoiceDateUpdates = transactionsToSave.filter(
              (transaction) => {
                const original = originalTransactionsMap.get(transaction.id);
                return (
                  !original?.['Invoice Date'] && transaction['Invoice Date']
                );
              }
            ).length;

            const statusUpdates = transactionsToSave.filter((transaction) => {
              const original = originalTransactionsMap.get(transaction.id);
              return (
                transaction['Order Status'] === 'Prepared' &&
                original?.['Order Status'] === 'Warehouse'
              );
            }).length;

            console.log(
              `✅ Saved to database: ${invoiceDateUpdates} Invoice Date updates + ${statusUpdates} Warehouse→Prepared status updates`
            );
          } catch (updateError) {
            console.error('Error saving transaction updates:', updateError);
            notifications.show({
              title: '⚠️ Database Save Warning',
              message:
                'Invoices generated successfully, but some database updates failed',
              color: 'yellow',
              autoClose: 5000,
            });
          }
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate invoices');
      }
    } catch (error) {
      console.error('Error generating invoices:', error);
      notifications.show({
        title: '❌ Invoice Generation Failed',
        message:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        color: 'red',
        autoClose: 7000,
      });
    } finally {
      setIsGeneratingInvoice(false);
      setPendingInvoiceData(null); // Clear pending data
    }
  }, [transactions, bulkUpdateTransactions, pendingInvoiceData]);

  // Handle cancellation of invoice generation
  const handleCancelInvoiceGeneration = useCallback(() => {
    setShowConfirmationModal(false);
    setPendingInvoiceData(null);

    notifications.show({
      title: '✅ Invoice Generation Cancelled',
      message:
        'Invoice generation was cancelled by user. No changes were made.',
      color: 'blue',
      autoClose: 4000,
    });
  }, []);

  // Distribution generation function
  const handleGenerateDistribution = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      console.log(
        '📦 Preparing distribution slip generation for Warehouse orders...'
      );

      try {
        // Filter only "Warehouse" status transactions from visible/filtered data
        const warehouseTransactions = visibleTransactions.filter(
          (transaction) => transaction['Order Status'] === 'Warehouse'
        );

        if (warehouseTransactions.length === 0) {
          notifications.show({
            title: '⚠️ No Warehouse Transactions',
            message:
              'No visible transactions with "Warehouse" status found for distribution slip generation.',
            color: 'yellow',
            autoClose: 5000,
          });
          return;
        }

        // Calculate statistics for confirmation dialog
        const uniqueCustomers = new Set(
          warehouseTransactions
            .map((transaction) => transaction.Customers)
            .filter(Boolean)
        );

        const totalValue = warehouseTransactions.reduce(
          (sum, transaction) => sum + (Number(transaction['Line Total']) || 0),
          0
        );

        const totalQuantity = warehouseTransactions.reduce(
          (sum, transaction) => sum + (Number(transaction.Quantity) || 0),
          0
        );

        // Show modern confirmation dialog with detailed information
        setDistributionData({
          warehouseTransactions: warehouseTransactions.length,
          customers: uniqueCustomers.size,
          totalValue: totalValue,
          totalQuantity: totalQuantity,
        });
        setPendingDistributionData(visibleTransactions);
        setShowDistributionModal(true);
      } catch (error) {
        console.error('Error preparing distribution generation:', error);
        notifications.show({
          title: '❌ Distribution Preparation Failed',
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while preparing distribution generation',
          color: 'red',
          autoClose: 7000,
        });
      }
    },
    []
  );

  // Handle distribution confirmation modal actions
  const handleConfirmDistributionGeneration = useCallback(async () => {
    setShowDistributionModal(false);

    if (!pendingDistributionData) {
      notifications.show({
        title: '❌ Error',
        message: 'No distribution data available for processing',
        color: 'red',
        autoClose: 5000,
      });
      return;
    }

    // User confirmed - proceed with distribution generation
    console.log(
      '📦 User confirmed - proceeding with distribution generation...'
    );
    setIsGeneratingDistribution(true);

    try {
      const visibleTransactions = pendingDistributionData;

      // Filter only "Warehouse" status transactions from visible/filtered data
      const warehouseTransactions = visibleTransactions.filter(
        (transaction) => transaction['Order Status'] === 'Warehouse'
      );

      console.log(
        `📋 Found ${warehouseTransactions.length} Warehouse transactions (from visible data) for distribution slips`
      );

      // Call the distribution generation API
      const response = await fetch('/api/generate-distribution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transactions: warehouseTransactions }),
      });

      if (response.ok) {
        // Get the PDF blob
        const pdfBlob = await response.blob();

        // Create download link
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;

        // Generate filename with timestamp
        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:-]/g, '');
        link.download = `distribution-slips-${timestamp}.pdf`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Show success notification
        notifications.show({
          title: '✅ Distribution Slips Generated',
          message: `PDF with ${warehouseTransactions.length} distribution slips has been downloaded (sorted by quantity ascending)`,
          color: 'green',
          autoClose: 8000,
        });
      } else {
        const errorData = await response.json();
        throw new Error(
          errorData.error || 'Failed to generate distribution slips'
        );
      }
    } catch (error) {
      console.error('Error generating distribution slips:', error);
      notifications.show({
        title: '❌ Distribution Generation Failed',
        message:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        color: 'red',
        autoClose: 7000,
      });
    } finally {
      setIsGeneratingDistribution(false);
      setPendingDistributionData(null); // Clear pending data
    }
  }, [pendingDistributionData]);

  // Handle cancellation of distribution generation
  const handleCancelDistributionGeneration = useCallback(() => {
    setShowDistributionModal(false);
    setPendingDistributionData(null);

    notifications.show({
      title: '✅ Distribution Generation Cancelled',
      message:
        'Distribution generation was cancelled by user. No changes were made.',
      color: 'blue',
      autoClose: 4000,
    });
  }, []);

  const handleGeneratePackingList = useCallback(
    async (visibleTransactions: TransactionData[]) => {
      console.log(
        '📋 Preparing packing list generation for Prepared orders...'
      );

      try {
        // Filter transactions from visible/filtered data based on validation rules:
        // 1. Only "Prepared" status
        // 2. Line total ≤ ₱50.00
        const preparedTransactions = visibleTransactions.filter(
          (transaction) => {
            const status = transaction['Order Status'];
            const lineTotal = Number(transaction['Line Total']) || 0;

            return status === 'Prepared' && lineTotal <= 50.0;
          }
        );

        if (preparedTransactions.length === 0) {
          notifications.show({
            title: '⚠️ No Prepared Transactions',
            message:
              'No visible transactions found with "Prepared" status and line total ≤ ₱50.00 for packing list generation.',
            color: 'yellow',
            autoClose: 5000,
          });
          return;
        }

        // Calculate statistics for confirmation dialog
        const uniqueCustomers = new Set(
          preparedTransactions
            .map((transaction) => transaction.Customers)
            .filter(Boolean)
        );

        const totalValue = preparedTransactions.reduce(
          (sum, transaction) => sum + (Number(transaction['Line Total']) || 0),
          0
        );

        // Show modern confirmation dialog with detailed information
        setPackingListData({
          eligibleTransactions: preparedTransactions.length,
          customers: uniqueCustomers.size,
          totalValue: totalValue,
        });
        setPendingPackingListData(visibleTransactions);
        setShowPackingListModal(true);
      } catch (error) {
        console.error('Error preparing packing list generation:', error);
        notifications.show({
          title: '❌ Packing List Preparation Failed',
          message:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred while preparing packing list generation',
          color: 'red',
          autoClose: 7000,
        });
      }
    },
    []
  );

  // Handle packing list confirmation modal actions
  const handleConfirmPackingListGeneration = useCallback(async () => {
    setShowPackingListModal(false);

    if (!pendingPackingListData) {
      notifications.show({
        title: '❌ Error',
        message: 'No packing list data available for processing',
        color: 'red',
        autoClose: 5000,
      });
      return;
    }

    // User confirmed - proceed with packing list generation
    console.log(
      '📋 User confirmed - proceeding with packing list generation...'
    );
    setIsGeneratingPackingList(true);

    try {
      const visibleTransactions = pendingPackingListData;

      // Filter transactions from visible/filtered data based on validation rules:
      // 1. Only "Prepared" status
      // 2. Line total ≤ ₱50.00
      const preparedTransactions = visibleTransactions.filter((transaction) => {
        const status = transaction['Order Status'];
        const lineTotal = Number(transaction['Line Total']) || 0;

        return status === 'Prepared' && lineTotal <= 50.0;
      });

      console.log(
        `📋 Found ${preparedTransactions.length} eligible transactions (from visible data) for packing lists`
      );

      // Transform the data to match backend interface
      const transformedTransactions = preparedTransactions.map(
        (transaction) => ({
          id: String(transaction.id || ''),
          orderDate: transaction['Order Date'] || '',
          customers: transaction.Customers || '',
          productCode: transaction['Product Code'] || '',
          quantity: Number(transaction.Quantity) || 0,
          unitPrice: Number(transaction['Unit Price']) || 0,
          discount: Number(transaction.Discount) || 0,
          adjustment: Number(transaction.Adjustment) || 0,
          lineTotal: Number(transaction['Line Total']) || 0,
          status: transaction['Order Status'] || '',
          notes: transaction.Notes || '',
          invoiceDate: transaction['Invoice Date'] || '',
          packedDate: transaction['Packed Date'] || '',
          shipmentCode: transaction['Shipment Code'] || '',
        })
      );

      // Call the packing list generation API
      const response = await fetch('/api/generate-packing-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transformedTransactions),
      });

      if (response.ok) {
        // Get the PDF blob
        const pdfBlob = await response.blob();

        // Create download link
        const url = window.URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;

        // Generate filename with timestamp
        const timestamp = new Date()
          .toISOString()
          .slice(0, 19)
          .replace(/[:-]/g, '');
        link.download = `packing-lists-${timestamp}.pdf`;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        // Show success notification
        notifications.show({
          title: '✅ Packing Lists Generated',
          message: `PDF with packing lists for ${preparedTransactions.length} eligible transactions has been downloaded`,
          color: 'green',
          autoClose: 8000,
        });

        // ========================================================================
        // PACKED DATE SETTING LOGIC - Set current date for generated packing lists
        // ========================================================================
        // Set the current date for all processed transactions that had packing lists generated
        // This ensures we track when packing lists were created for business audit purposes
        // ========================================================================

        // Set current date in the same format as invoice generation
        const currentDate = new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

        // Identify transactions that were processed for packing lists
        const processedTransactionIds = new Set(
          preparedTransactions.map((t) => t.id)
        );

        const updatedTransactions = transactions.map((transaction) => {
          const updates: Partial<TransactionData> = {};
          let hasUpdates = false;

          // Set Packed Date if not already set (check for empty, null, or whitespace)
          if (
            processedTransactionIds.has(transaction.id) &&
            (!transaction['Packed Date'] ||
              transaction['Packed Date'].trim() === '')
          ) {
            updates['Packed Date'] = currentDate;
            hasUpdates = true;
          }

          return hasUpdates ? { ...transaction, ...updates } : transaction;
        });

        // Update transactions via service layer
        const sanitizedTransactions = updatedTransactions.map((t) => ({
          ...t,
          Quantity: t.Quantity ?? 0,
          'Unit Price': t['Unit Price'] ?? 0,
          Discount: t.Discount ?? 0,
          Adjustment: t.Adjustment ?? 0,
          'Line Total': t['Line Total'] ?? 0,
        }));
        bulkUpdateTransactions(sanitizedTransactions);

        // Save to database for persistence
        const transactionsToSave = updatedTransactions.filter((transaction) =>
          processedTransactionIds.has(transaction.id)
        );

        if (transactionsToSave.length > 0) {
          try {
            const updatePromises = transactionsToSave.map((transaction) =>
              saveTransactionToDatabase(transaction)
            );
            await Promise.all(updatePromises);

            const packedDateUpdates = transactionsToSave.filter(
              (transaction) => {
                const original = transactions.find(
                  (t) => t.id === transaction.id
                );
                return (
                  (!original?.['Packed Date'] ||
                    original['Packed Date'].trim() === '') &&
                  transaction['Packed Date']
                );
              }
            ).length;

            console.log(
              `✅ Saved to database: ${packedDateUpdates} Packed Date updates`
            );
          } catch (updateError) {
            console.error('Error saving packed date updates:', updateError);
            notifications.show({
              title: '⚠️ Database Save Warning',
              message:
                'Packing lists generated successfully, but some database updates failed',
              color: 'yellow',
              autoClose: 5000,
            });
          }
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate packing lists');
      }
    } catch (error) {
      console.error('Error generating packing lists:', error);
      notifications.show({
        title: '❌ Packing List Generation Failed',
        message:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        color: 'red',
        autoClose: 7000,
      });
    } finally {
      setIsGeneratingPackingList(false);
      setPendingPackingListData(null); // Clear pending data
    }
  }, [pendingPackingListData, transactions, bulkUpdateTransactions]);

  // Handle cancellation of packing list generation
  const handleCancelPackingListGeneration = useCallback(() => {
    setShowPackingListModal(false);
    setPendingPackingListData(null);

    notifications.show({
      title: '✅ Packing List Generation Cancelled',
      message:
        'Packing list generation was cancelled by user. No changes were made.',
      color: 'blue',
      autoClose: 4000,
    });
  }, []);

  // Define status filter options
  const statusOptions = [
    'All Status',
    'In Transit',
    'Warehouse',
    'Prepared',
    'Ready For Dispatch',
    'Checked Out',
    'Lalamove',
    'On-Hold',
    'Pending Payment',
    'Shipped',
    'Cancelled',
  ];

  // Handle status filter selection with toggle functionality
  const handleStatusFilter = (status: string) => {
    setSelectedStatuses((prev) => {
      const newSet = new Set(prev);

      if (status === 'All Status') {
        if (newSet.has('All Status')) {
          // Toggle off All Status and all controlled statuses
          newSet.delete('All Status');
          allStatusControlledStatuses.forEach((s) => newSet.delete(s));
        } else {
          // Toggle on All Status and all controlled statuses
          newSet.add('All Status');
          allStatusControlledStatuses.forEach((s) => newSet.add(s));
        }
      } else {
        // Handle individual status toggle
        if (newSet.has(status)) {
          newSet.delete(status);
          // If this was one of the controlled statuses, also remove All Status
          if (allStatusControlledStatuses.includes(status)) {
            newSet.delete('All Status');
          }
        } else {
          newSet.add(status);
          // Check if all controlled statuses are now selected, if so add All Status
          if (
            allStatusControlledStatuses.every(
              (s) => newSet.has(s) || s === status
            )
          ) {
            newSet.add('All Status');
          }
        }
      }

      return newSet;
    });
    // TODO: Implement actual filtering logic here
  };

  // Define columns for the transactions table
  const columns: GridColumn[] = React.useMemo(
    () => [
      { title: 'ORDER DATE', width: 180, id: 'orderDate' },
      { title: 'CUSTOMERS', width: 500, id: 'customers' },
      { title: 'PRODUCT CODE', width: 550, id: 'productCode' },
      { title: 'QUANTITY', width: 180, id: 'quantity' },
      { title: 'UNIT PRICE', width: 180, id: 'unitPrice' },
      { title: 'DISCOUNT', width: 180, id: 'discount' },
      { title: 'ADJUSTMENT', width: 180, id: 'adjustment' },
      { title: 'LINE TOTAL', width: 200, id: 'lineTotal' },
      { title: 'ORDER STATUS', width: 200, id: 'orderStatus' },
      { title: 'NOTES', width: 300, grow: 1, id: 'notes' },
      { title: 'INVOICE DATE', width: 200, id: 'invoiceDate' },
      { title: 'PACKED DATE', width: 200, id: 'packedDate' },
      { title: 'SHIPMENT CODE', width: 200, id: 'shipmentCode' },
    ],
    []
  );

  // Map column IDs to data keys
  const idToKey: Record<string, keyof TransactionData> = React.useMemo(
    () => ({
      orderDate: 'Order Date',
      customers: 'Customers',
      productCode: 'Product Code',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      discount: 'Discount',
      adjustment: 'Adjustment',
      lineTotal: 'Line Total',
      orderStatus: 'Order Status',
      notes: 'Notes',
      invoiceDate: 'Invoice Date',
      packedDate: 'Packed Date',
      shipmentCode: 'Shipment Code',
    }),
    []
  );

  // 🚀 PERFORMANCE: Create a memoized Map for O(1) transaction lookups by ID
  const transactionIndexMap = React.useMemo(() => {
    const map = new Map<number, number>();
    transactions.forEach((transaction, index) => {
      if (transaction.id !== undefined) {
        map.set(transaction.id, index);
      }
    });
    return map;
  }, [transactions]);

  // Use the data table hook for search functionality
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

  // Apply status filtering on top of search filtering
  const filteredData = React.useMemo(() => {
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
      // Filter by selected individual statuses (OR logic) AND always include rows without Order Status
      filtered = searchFilteredData.filter((transaction) => {
        const status = transaction['Order Status'];
        // Always show rows without Order Status, or rows with selected statuses
        return (
          !status ||
          status.trim() === '' ||
          (status && individual.includes(status))
        );
      });
    }

    // If there's an active search, append empty rows for adding new entries
    // This allows users to add new orders for the filtered customer
    if (searchQuery && searchQuery.trim() !== '') {
      // Get all empty/blank rows from the original transactions
      const emptyRows = transactions.filter((transaction) => {
        // A row is considered empty if it has no customer and no product code
        const hasCustomer =
          transaction.Customers && transaction.Customers.trim() !== '';
        const hasProductCode =
          transaction['Product Code'] &&
          transaction['Product Code'].trim() !== '';
        return !hasCustomer && !hasProductCode;
      });

      // Append empty rows to the filtered results
      return [...filtered, ...emptyRows];
    }

    return filtered;
  }, [searchFilteredData, selectedStatuses, searchQuery, transactions]);

  // Create cell content getter that uses the FINAL filteredData (search + status)
  const cellContentGetter = React.useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;
      const item = filteredData[row] as TransactionData | undefined;
      const column = columns[col];

      if (!item || !column) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
        } as GridCell;
      }

      const key = idToKey[column.id as string];
      const value = item[key];

      // Helper function to sanitize values (treat "null" string as empty)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sanitizeValue = (val: any): string => {
        if (val === null || val === undefined || val === 'null' || val === '') {
          return '';
        }
        return String(val);
      };

      // Helper function for numeric columns: also treat 0 as blank
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sanitizeNumericValue = (val: any): string => {
        if (
          val === null ||
          val === undefined ||
          val === 'null' ||
          val === '' ||
          val === 0 ||
          val === '0'
        ) {
          return '';
        }
        return String(val);
      };

      // Make Order Date column editable
      if (column.id === 'orderDate') {
        const sanitized = sanitizeValue(value);
        return {
          kind: GridCellKind.Text,
          data: sanitized,
          displayData: sanitized,
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Make Customers column editable with dropdown
      if (column.id === 'customers') {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: true,
          copyData: sanitizeValue(value),
          data: {
            kind: 'dropdown-cell',
            value: sanitizeValue(value),
            allowedValues: customerNames,
          },
        } as GridCell;
      }

      // Make Product Code column editable with dropdown
      if (column.id === 'productCode') {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: true,
          copyData: sanitizeValue(value),
          data: {
            kind: 'dropdown-cell',
            value: sanitizeValue(value),
            allowedValues: productCodes,
          },
        } as GridCell;
      }

      // Make Quantity column editable
      if (column.id === 'quantity') {
        const sanitized = sanitizeNumericValue(value);
        return {
          kind: GridCellKind.Text,
          data: sanitized,
          displayData: sanitized,
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Make Discount column editable
      if (column.id === 'discount') {
        const sanitized = sanitizeNumericValue(value);
        return {
          kind: GridCellKind.Text,
          data: sanitized,
          displayData: sanitized,
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Make Adjustment column editable
      if (column.id === 'adjustment') {
        const sanitized = sanitizeNumericValue(value);
        return {
          kind: GridCellKind.Text,
          data: sanitized,
          displayData: sanitized,
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Make Order Status column editable with dropdown
      if (column.id === 'orderStatus') {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: true,
          copyData: sanitizeValue(value),
          data: {
            kind: 'dropdown-cell',
            value: sanitizeValue(value),
            allowedValues: [
              'In Transit',
              'Warehouse',
              'Prepared',
              'Ready For Dispatch',
              'Checked Out',
              'Lalamove',
              'On-Hold',
              'Pending Payment',
              'Shipped',
              'Cancelled',
            ],
          },
        } as GridCell;
      }

      // Make Notes column editable
      if (column.id === 'notes') {
        const sanitized = sanitizeValue(value);
        return {
          kind: GridCellKind.Text,
          data: sanitized,
          displayData: sanitized,
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Auto-populate Shipment Code based on Product Code (read-only)
      if (column.id === 'shipmentCode') {
        const currentProductCode = item['Product Code'];
        let displayValue = sanitizeValue(value);

        // If there's a product code and we have a mapping, auto-populate the shipment code
        if (currentProductCode && productToShipmentMap[currentProductCode]) {
          displayValue = productToShipmentMap[currentProductCode];
        }

        return {
          kind: GridCellKind.Text,
          data: displayValue,
          displayData: displayValue,
          allowOverlay: false,
          readonly: true,
        } as GridCell;
      }

      // Handle numeric columns - show blank if value is 0
      if (typeof value === 'number') {
        // Show blank cell for zero values to make it easier to spot missing data
        const displayValue = value === 0 ? '' : value.toLocaleString();
        const dataValue = value === 0 ? '' : String(value);

        return {
          kind: GridCellKind.Text,
          data: dataValue,
          displayData: displayValue,
          allowOverlay: false,
        } as GridCell;
      }

      return {
        kind: GridCellKind.Text,
        data: sanitizeValue(value),
        displayData: sanitizeValue(value),
        allowOverlay: false,
      } as GridCell;
    },
    [
      filteredData,
      columns,
      idToKey,
      customerNames,
      productCodes,
      productToShipmentMap,
    ]
  );

  // Handle cell edits
  // ============================================================================
  // ⚠️ WARNING: FINALIZED LOGIC - DO NOT MODIFY WITHOUT APPROVAL ⚠️
  // ============================================================================
  // The following helper functions contain FINALIZED business logic that has been
  // carefully designed and approved. DO NOT change the core logic without explicit
  // approval from the business owner.
  //
  // ✅ ALLOWED: Fix linting issues, type errors, or refactor code structure
  // ❌ FORBIDDEN: Change formulas, computation logic, or business rules
  //
  // Reference: See TRANSACTIONS_LOGIC_SUMMARY.md for complete logic documentation
  // ============================================================================

  /**
   * Helper function to get unit price based on product code and quantity
   *
   * ⚠️ FINALIZED LOGIC - DO NOT MODIFY
   *
   * This function looks up the tier price from the prices table based on:
   * - Product Code: Identifies the product
   * - Quantity: Determines which price tier applies
   *
   * Returns the Prices value from the matching tier, or null if no match found.
   *
   * @param productCode - The product code to lookup
   * @param quantity - The quantity to match against tier ranges
   * @returns The tier price (Prices field) or null
   */
  const getUnitPriceForQuantity = useCallback(
    (productCode: string, quantity: number): number | null => {
      if (!productCode || !quantity || quantity <= 0) return null;

      // Find all price tiers for this product code
      const productTiers = priceTiers.filter(
        (tier) => tier['Product Code'] === productCode
      );

      if (productTiers.length === 0) return null;

      // Find the tier that contains this quantity
      const matchingTier = productTiers.find(
        (tier) =>
          quantity >= tier['Lower Limit'] && quantity <= tier['Upper Limit']
      );

      return matchingTier ? matchingTier.Prices : null;
    },
    [priceTiers]
  );

  /**
   * Helper function to calculate Line Total
   *
   * ⚠️ FINALIZED FORMULA - DO NOT MODIFY
   *
   * Formula: LINE TOTAL = (QUANTITY × UNIT PRICE) - ADJUSTMENT
   *
   * IMPORTANT NOTES:
   * - Discount is NOT included in this formula
   * - Discount affects Unit Price directly (Unit Price = Tier Price - Discount)
   * - Adjustment is an order-level adjustment applied to the line total
   *
   * @param quantity - Number of units
   * @param unitPrice - Price per unit (already includes discount)
   * @param adjustment - Order-level adjustment amount
   * @returns The calculated line total
   */
  const calculateLineTotal = useCallback(
    (quantity: number, unitPrice: number, adjustment: number): number => {
      return quantity * unitPrice - adjustment;
    },
    []
  );

  /**
   * Save transaction update to database
   *
   * @param transaction - The transaction object to save
   * @returns Promise that resolves when save is complete
   */
  const saveTransactionToDatabase = async (transaction: TransactionData) => {
    try {
      const response = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transaction),
      });

      if (!response.ok) {
        throw new Error('Failed to save transaction to database');
      }

      return await response.json();
    } catch (error) {
      console.error('Error saving transaction:', error);
      throw error;
    }
  };

  const handleCellEdited = useCallback(
    (cell: Item, newValue: GridCell) => {
      const [col, row] = cell;
      const column = columns[col];
      const transaction = filteredData[row]; // Use filteredData instead of transactions

      if (!transaction) return; // Safety check

      // Check if this is part of a batch paste operation
      const isBatchEdit =
        '_isBatchMode' in newValue &&
        (newValue as unknown as { _isBatchMode?: boolean })._isBatchMode;

      // Helper function to batch or immediately execute updates
      const updateTransactionData = (data: Partial<TransactionData>) => {
        if (!transaction.id) return;

        if (isBatchEdit || isBatchModeRef.current) {
          // BATCH MODE: Accumulate changes instead of making immediate API calls
          console.log(
            `📦 Batching update for transaction ${transaction.id}:`,
            data
          );

          const existing = batchUpdatesRef.current.get(transaction.id) || {};
          batchUpdatesRef.current.set(transaction.id, { ...existing, ...data });
        } else {
          // NORMAL MODE: Make immediate API call
          console.log(
            `🔄 Immediate update for transaction ${transaction.id}:`,
            data
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updateTransaction({ id: transaction.id, data: data as any });
        }
      };

      // Helper function to conditionally show notifications (suppressed during batch mode)
      const showNotification = (options: {
        title: string;
        message: string;
        color: string;
      }) => {
        // Suppress notifications if we're in batch mode OR this specific cell is part of a batch
        if (!isBatchEdit && !isBatchModeRef.current) {
          notifications.show(options);
        } else {
          console.log(
            '🔇 Notification suppressed (batch mode):',
            options.message
          );
        }
      };

      // 🚀 PERFORMANCE: Use Map for O(1) lookup instead of O(n) findIndex
      const transactionIndex =
        transaction.id !== undefined
          ? transactionIndexMap.get(transaction.id)
          : undefined;

      // If no ID match found, this is a serious data consistency issue
      if (transactionIndex === undefined) {
        console.error('Transaction not found in original array:', transaction);
        return;
      }

      if (column.id === 'orderDate') {
        // Update via service layer (batched or immediate)
        updateTransactionData({
          'Order Date': 'data' in newValue ? (newValue.data as string) : '',
        });

        // Legacy database save (keeping for compatibility) - skip during batch mode
        if (!isBatchEdit && !isBatchModeRef.current) {
          const updatedTransaction = {
            ...transaction,
            'Order Date': 'data' in newValue ? (newValue.data as string) : '',
          };

          saveTransactionToDatabase(updatedTransaction).catch((error) => {
            showNotification({
              title: 'Error',
              message: 'Failed to save Order Date to database',
              color: 'red',
            });
            console.error('Database save error:', error);
          });
        }

        showNotification({
          title: 'Success',
          message: 'Order Date updated successfully',
          color: 'green',
        });
      }

      if (column.id === 'customers') {
        // Handle dropdown cell data structure
        const dropdownValue =
          'data' in newValue &&
          newValue.data &&
          typeof newValue.data === 'object'
            ? (newValue.data as { value: string }).value
            : '';

        // ============================================================================
        // CUSTOMER VALIDATION - Check for banned customers and high cancellation rates
        // ============================================================================
        if (dropdownValue && dropdownValue.trim() !== '') {
          // Perform validation asynchronously without blocking the UI
          validateCustomer(dropdownValue)
            .then((validation) => {
              if (validation.warnings.length > 0) {
                // Show modern warning modal for banned customers or high cancellation rates
                setCustomerWarningData({
                  customerName: dropdownValue,
                  warnings: validation.warnings,
                  onProceed: () => {
                    // User chose to proceed, show acknowledgment
                    setShowCustomerWarningModal(false);
                    notifications.show({
                      title: '⚠️ Warning Acknowledged',
                      message: `Proceeding with customer "${dropdownValue}" despite warnings`,
                      color: 'yellow',
                      autoClose: 6000,
                    });
                  },
                  onCancel: () => {
                    // User cancelled - revert the customer selection
                    setShowCustomerWarningModal(false);
                    updateTransactionData({
                      Customers: '', // Clear the customer
                    });

                    if (!isBatchEdit && !isBatchModeRef.current) {
                      saveTransactionToDatabase({
                        ...transaction,
                        Customers: '',
                      }).catch((error) => {
                        console.error('Database save error:', error);
                      });
                    }

                    notifications.show({
                      title: '🚫 Customer Selection Cancelled',
                      message: `Customer "${dropdownValue}" was not selected due to warnings`,
                      color: 'orange',
                      autoClose: 5000,
                    });
                  },
                });
                setShowCustomerWarningModal(true);
              }
            })
            .catch((error) => {
              console.error('Customer validation error:', error);
              // If validation fails, continue anyway but log the error
            });
        }

        // Auto-populate Order Date when customer is selected (only if date is empty)
        const currentOrderDate = transaction['Order Date'];
        let autoPopulatedOrderDate = currentOrderDate; // Keep existing date by default

        if (
          dropdownValue &&
          dropdownValue.trim() !== '' &&
          (!currentOrderDate || currentOrderDate.trim() === '')
        ) {
          // Customer is selected AND date is empty, set today's date
          const now = new Date();
          autoPopulatedOrderDate = now.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }

        // Update via service layer (batched or immediate)
        updateTransactionData({
          Customers: dropdownValue as string,
          'Order Date': autoPopulatedOrderDate,
        });

        // Save to database - skip during batch mode
        if (!isBatchEdit && !isBatchModeRef.current) {
          saveTransactionToDatabase({
            ...transaction,
            Customers: dropdownValue as string,
            'Order Date': autoPopulatedOrderDate,
          }).catch((error) => {
            showNotification({
              title: 'Error',
              message: 'Failed to save Customer to database',
              color: 'red',
            });
            console.error('Database save error:', error);
          });
        }

        showNotification({
          title: 'Success',
          message:
            dropdownValue &&
            dropdownValue.trim() !== '' &&
            (!transaction['Order Date'] ||
              transaction['Order Date'].trim() === '')
              ? 'Customer updated and Order Date auto-populated'
              : dropdownValue && dropdownValue.trim() !== ''
                ? 'Customer updated successfully'
                : 'Customer cleared',
          color: 'green',
        });
      }

      // ============================================================================
      // PRODUCT CODE HANDLER
      // ⚠️ FINALIZED AUTO-POPULATION LOGIC - DO NOT MODIFY
      // ============================================================================
      // This handler auto-populates:
      // 1. Shipment Code (from product mapping)
      // 2. Order Status (conditionally - only if blank or "In Transit")
      // 3. Unit Price (if Quantity exists, using formula: Tier Price - Discount)
      //
      // DO NOT change these auto-population rules without business approval.
      // ============================================================================
      if (column.id === 'productCode') {
        // Handle dropdown cell data structure
        const dropdownValue =
          'data' in newValue &&
          newValue.data &&
          typeof newValue.data === 'object'
            ? (newValue.data as { value: string }).value
            : '';

        // Auto-populate shipment code based on the selected product code
        const correspondingShipmentCode =
          productToShipmentMap[dropdownValue] || '';

        // Auto-populate order status based on the product's shipment status
        const correspondingShipmentStatus =
          productToShipmentStatusMap[dropdownValue] || '';

        // Debug logging to see what's happening
        console.log('Debug - Product Code:', dropdownValue);
        console.log('Debug - Shipment Status Map:', productToShipmentStatusMap);
        console.log(
          'Debug - Found Shipment Status:',
          correspondingShipmentStatus
        );

        // Only auto-populate ORDER STATUS if it's currently blank or "In Transit"
        const currentOrderStatus = transaction['Order Status'] || '';
        const shouldAutoPopulateStatus =
          currentOrderStatus === '' ||
          currentOrderStatus.toLowerCase() === 'in transit';

        let finalOrderStatus = currentOrderStatus; // Keep existing by default

        if (shouldAutoPopulateStatus && correspondingShipmentStatus !== '') {
          finalOrderStatus = getOrderStatusFromShipmentStatus(
            correspondingShipmentStatus
          );
        }

        console.log('Debug - Current Order Status:', currentOrderStatus);
        console.log(
          'Debug - Should Auto-populate Status:',
          shouldAutoPopulateStatus
        );
        console.log('Debug - Final Order Status:', finalOrderStatus);

        // ========================================================================
        // ORDER STATUS CLEARING LOGIC WHEN PRODUCT CODE IS CLEARED
        // ========================================================================
        // If Product Code is cleared, handle Order Status based on current status:
        // - If "In Transit" or "Warehouse": Clear Order Status automatically
        // - If other status: Show confirmation dialog before clearing Product Code
        // ========================================================================
        if (!dropdownValue || dropdownValue.trim() === '') {
          // Product Code is being cleared
          if (
            currentOrderStatus.toLowerCase() === 'in transit' ||
            currentOrderStatus.toLowerCase() === 'warehouse'
          ) {
            // Clear Order Status for "In Transit" or "Warehouse"
            finalOrderStatus = '';
            console.log(
              `Order Status "${currentOrderStatus}" cleared because Product Code was cleared`
            );
          } else if (currentOrderStatus && currentOrderStatus.trim() !== '') {
            // For important statuses, show confirmation dialog
            const shouldClear = window.confirm(
              `⚠️ CONFIRMATION REQUIRED\n\n` +
                `You are about to clear the Product Code for a transaction with Order Status: "${currentOrderStatus}"\n\n` +
                `This is an important status that may indicate:\n` +
                `• Order is in advanced processing stage\n` +
                `• Customer has been notified\n` +
                `• Business processes may be affected\n\n` +
                `Do you want to continue clearing the Product Code?\n\n` +
                `• Click OK to clear Product Code and preserve Order Status\n` +
                `• Click Cancel to keep both Product Code and Order Status unchanged`
            );

            if (!shouldClear) {
              // User cancelled - prevent the Product Code from being cleared

              // Show info notification
              notifications.show({
                title: '✅ Action Cancelled',
                message: `Product Code clearing cancelled. Order Status "${currentOrderStatus}" and Product Code preserved.`,
                color: 'blue',
                autoClose: 4000,
              });

              // Early return to prevent any updates
              return;
            } else {
              // User confirmed - allow clearing Product Code but preserve Order Status
              notifications.show({
                title: '⚠️ Product Code Cleared',
                message: `Product Code cleared as requested. Order Status "${currentOrderStatus}" preserved for review.`,
                color: 'orange',
                autoClose: 6000,
              });
              console.log(
                `User confirmed: Product Code cleared but preserved Order Status "${currentOrderStatus}"`
              );
            }
          }
        }

        // ========================================================================
        // ⚠️ FINALIZED UNIT PRICE AUTO-POPULATION LOGIC
        // ========================================================================
        // Formula: Unit Price = Tier Price - Discount
        //
        // Logic:
        // - IF Product Code is cleared → Clear Unit Price to 0
        // - IF Product Code exists AND Quantity > 0:
        //   1. Lookup Tier Price using getUnitPriceForQuantity()
        //   2. Subtract Discount from Tier Price
        //   3. Set as Unit Price
        //
        // DO NOT modify this formula without business approval!
        // ========================================================================
        const currentQuantity = transaction.Quantity || 0;
        const currentDiscount = transaction.Discount || 0;
        let autoPopulatedUnitPrice = 0;
        let unitPriceAutoPopulated = false;
        let unitPriceCleared = false;

        if (!dropdownValue || dropdownValue.trim() === '') {
          // Product Code is cleared, so clear Unit Price
          autoPopulatedUnitPrice = 0;
          unitPriceCleared = true;
        } else if (dropdownValue && currentQuantity > 0) {
          // Both Product Code and Quantity exist, lookup price
          const foundTierPrice = getUnitPriceForQuantity(
            dropdownValue,
            currentQuantity
          );
          if (foundTierPrice !== null) {
            // ⚠️ FINALIZED FORMULA: Unit Price = Tier Price - Discount
            autoPopulatedUnitPrice = foundTierPrice - currentDiscount;
            unitPriceAutoPopulated = true;
          }
        }

        // Create a new updated transaction with Product Code, Shipment Code, Order Status, and Unit Price
        const updatedTransaction = {
          ...transaction,
          'Product Code': dropdownValue as string,
          'Shipment Code': correspondingShipmentCode,
          'Order Status': finalOrderStatus,
          'Unit Price': autoPopulatedUnitPrice,
        };

        // Update via service layer
        if (transaction.id) {
          updateTransactionData(updatedTransaction);
        }

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          showNotification({
            title: 'Error',
            message: 'Failed to save Product Code to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        // Build notification message based on what was auto-populated
        let message = 'Product Code updated successfully';
        const autopopulated = [];
        if (correspondingShipmentCode) autopopulated.push('Shipment Code');
        if (
          shouldAutoPopulateStatus &&
          correspondingShipmentStatus !== undefined
        ) {
          autopopulated.push('Order Status');
        }
        if (unitPriceAutoPopulated) autopopulated.push('Unit Price');

        if (autopopulated.length > 0) {
          message += ` and ${autopopulated.join(' & ')} auto-populated`;
        }

        // Add note if Unit Price was cleared
        if (unitPriceCleared) {
          message += ' (Unit Price cleared)';
        }

        // Add note if Order Status was cleared when Product Code was cleared
        if (
          (!dropdownValue || dropdownValue.trim() === '') &&
          (currentOrderStatus.toLowerCase() === 'in transit' ||
            currentOrderStatus.toLowerCase() === 'warehouse') &&
          finalOrderStatus === ''
        ) {
          message += ` (Order Status "${currentOrderStatus}" cleared)`;
        }

        // Add note if ORDER STATUS was preserved
        if (
          !shouldAutoPopulateStatus &&
          currentOrderStatus &&
          finalOrderStatus === currentOrderStatus
        ) {
          message += ` (Order Status "${currentOrderStatus}" preserved)`;
        }

        showNotification({
          title: 'Success',
          message,
          color: 'green',
        });
      }

      // ============================================================================
      // QUANTITY HANDLER
      // ⚠️ FINALIZED AUTO-POPULATION & COMPUTATION LOGIC - DO NOT MODIFY
      // ============================================================================
      // This handler:
      // 1. Auto-populates Unit Price (if Product Code exists)
      //    Formula: Unit Price = Tier Price - Discount
      // 2. Calculates Line Total
      //    Formula: Line Total = (Quantity × Unit Price) - Adjustment
      //
      // DO NOT change these formulas without business approval!
      // ============================================================================
      if (column.id === 'quantity') {
        const newQuantity =
          'data' in newValue ? Number(newValue.data as string) || 0 : 0;

        // ========================================================================
        // ⚠️ FINALIZED UNIT PRICE AUTO-POPULATION LOGIC
        // ========================================================================
        // Formula: Unit Price = Tier Price - Discount
        // ========================================================================
        const currentProductCode = transaction['Product Code'] || '';
        const currentDiscount = transaction.Discount || 0;
        let autoPopulatedUnitPrice = 0;
        let unitPriceAutoPopulated = false;
        let unitPriceCleared = false;

        if (newQuantity <= 0) {
          // Quantity is cleared or zero, so clear Unit Price
          autoPopulatedUnitPrice = 0;
          unitPriceCleared = true;
        } else if (
          currentProductCode &&
          currentProductCode.trim() !== '' &&
          newQuantity > 0
        ) {
          // Both Product Code and Quantity exist, lookup price
          const foundTierPrice = getUnitPriceForQuantity(
            currentProductCode,
            newQuantity
          );
          if (foundTierPrice !== null) {
            // ⚠️ FINALIZED FORMULA: Unit Price = Tier Price - Discount
            autoPopulatedUnitPrice = foundTierPrice - currentDiscount;
            unitPriceAutoPopulated = true;
          }
        }

        // ========================================================================
        // ⚠️ FINALIZED LINE TOTAL CALCULATION
        // ========================================================================
        // Formula: Line Total = (Quantity × Unit Price) - Adjustment
        // Note: Discount is NOT subtracted here (it's already in Unit Price)
        // ========================================================================
        const adjustment = transaction.Adjustment || 0;
        const lineTotal = calculateLineTotal(
          newQuantity,
          autoPopulatedUnitPrice,
          adjustment
        );

        // Create a new updated transaction with Quantity, Unit Price, and Line Total
        const updatedTransaction = {
          ...transaction,
          Quantity: newQuantity,
          'Unit Price': autoPopulatedUnitPrice,
          'Line Total': lineTotal,
        };

        // Update the transactions array
        if (transaction.id) {
          updateTransactionData(updatedTransaction);
        }

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          showNotification({
            title: 'Error',
            message: 'Failed to save Quantity to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        // Build notification message
        let message = 'Quantity updated successfully';
        if (unitPriceAutoPopulated) {
          message = 'Quantity updated and Unit Price auto-populated';
        } else if (unitPriceCleared) {
          message = 'Quantity updated and Unit Price cleared';
        }

        showNotification({
          title: 'Success',
          message,
          color: 'green',
        });
      }

      // ============================================================================
      // UNIT PRICE HANDLER
      // ⚠️ FINALIZED COMPUTATION LOGIC - DO NOT MODIFY
      // ============================================================================
      // This handler allows manual override of Unit Price and recalculates Line Total.
      // Formula: Line Total = (Quantity × Unit Price) - Adjustment
      //
      // Note: Manual edits override auto-populated values.
      // DO NOT change the Line Total formula without business approval!
      // ============================================================================
      if (column.id === 'unitPrice') {
        const newUnitPrice =
          'data' in newValue ? Number(newValue.data as string) || 0 : 0;

        // ========================================================================
        // ⚠️ FINALIZED LINE TOTAL CALCULATION
        // ========================================================================
        // Formula: Line Total = (Quantity × Unit Price) - Adjustment
        // Note: Discount is NOT subtracted here (it's already in Unit Price)
        // ========================================================================
        const quantity = transaction.Quantity || 0;
        const adjustment = transaction.Adjustment || 0;
        const lineTotal = calculateLineTotal(
          quantity,
          newUnitPrice,
          adjustment
        );

        // Create a new updated transaction with Unit Price and Line Total
        const updatedTransaction = {
          ...transaction,
          'Unit Price': newUnitPrice,
          'Line Total': lineTotal,
        };

        // Update via service layer
        if (transaction.id) {
          updateTransactionData(updatedTransaction);
        }

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          showNotification({
            title: 'Error',
            message: 'Failed to save Unit Price to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        showNotification({
          title: 'Success',
          message: 'Unit Price updated successfully',
          color: 'green',
        });
      }

      // ============================================================================
      // DISCOUNT HANDLER
      // ⚠️ FINALIZED COMPUTATION LOGIC - DO NOT MODIFY
      // ============================================================================
      // This handler:
      // 1. Recalculates Unit Price with new Discount
      //    Formula: Unit Price = Tier Price - Discount
      // 2. Recalculates Line Total with new Unit Price
      //    Formula: Line Total = (Quantity × Unit Price) - Adjustment
      //
      // CRITICAL: Discount affects Unit Price, NOT Line Total directly!
      // DO NOT change these formulas without business approval!
      // ============================================================================
      if (column.id === 'discount') {
        const newDiscount =
          'data' in newValue ? Number(newValue.data as string) || 0 : 0;

        // ========================================================================
        // ⚠️ FINALIZED UNIT PRICE RECALCULATION LOGIC
        // ========================================================================
        // Formula: Unit Price = Tier Price - Discount
        //
        // When discount changes, we must:
        // 1. Re-lookup the Tier Price from prices table
        // 2. Apply the new discount: Unit Price = Tier Price - New Discount
        // ========================================================================
        const currentProductCode = transaction['Product Code'] || '';
        const currentQuantity = transaction.Quantity || 0;
        let recalculatedUnitPrice = transaction['Unit Price'] || 0; // Keep existing if no recalculation

        if (
          currentProductCode &&
          currentProductCode.trim() !== '' &&
          currentQuantity > 0
        ) {
          // Re-lookup tier price and apply new discount
          const foundTierPrice = getUnitPriceForQuantity(
            currentProductCode,
            currentQuantity
          );
          if (foundTierPrice !== null) {
            // ⚠️ FINALIZED FORMULA: Unit Price = Tier Price - New Discount
            recalculatedUnitPrice = foundTierPrice - newDiscount;
          }
        }

        // ========================================================================
        // ⚠️ FINALIZED LINE TOTAL CALCULATION
        // ========================================================================
        // Formula: Line Total = (Quantity × Unit Price) - Adjustment
        // Note: Discount is NOT subtracted here (it's already in Unit Price)
        // ========================================================================
        const quantity = transaction.Quantity || 0;
        const adjustment = transaction.Adjustment || 0;
        const lineTotal = calculateLineTotal(
          quantity,
          recalculatedUnitPrice, // Use recalculated Unit Price
          adjustment
        );

        // Create a new updated transaction with Unit Price, Discount and Line Total
        const updatedTransaction = {
          ...transaction,
          'Unit Price': recalculatedUnitPrice, // Update Unit Price with recalculated value
          Discount: newDiscount,
          'Line Total': lineTotal,
        };

        // Update via service layer
        if (transaction.id) {
          updateTransactionData(updatedTransaction);
        }

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          showNotification({
            title: 'Error',
            message: 'Failed to save Discount to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        showNotification({
          title: 'Success',
          message: 'Discount updated successfully',
          color: 'green',
        });
      }

      // ============================================================================
      // ADJUSTMENT HANDLER
      // ⚠️ FINALIZED COMPUTATION LOGIC - DO NOT MODIFY
      // ============================================================================
      // This handler recalculates Line Total when Adjustment changes.
      // Formula: Line Total = (Quantity × Unit Price) - Adjustment
      //
      // DO NOT change this formula without business approval!
      // ============================================================================
      if (column.id === 'adjustment') {
        const newAdjustment =
          'data' in newValue ? Number(newValue.data as string) || 0 : 0;

        // ========================================================================
        // ⚠️ FINALIZED LINE TOTAL CALCULATION
        // ========================================================================
        // Formula: Line Total = (Quantity × Unit Price) - Adjustment
        // Note: Discount is NOT subtracted here (it's already in Unit Price)
        // ========================================================================
        const quantity = transaction.Quantity || 0;
        const unitPrice = transaction['Unit Price'] || 0;
        const lineTotal = calculateLineTotal(
          quantity,
          unitPrice,
          newAdjustment
        );

        // Create a new updated transaction with Adjustment and Line Total
        const updatedTransaction = {
          ...transaction,
          Adjustment: newAdjustment,
          'Line Total': lineTotal,
        };

        // Update via service layer
        if (transaction.id) {
          updateTransactionData(updatedTransaction);
        }

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          showNotification({
            title: 'Error',
            message: 'Failed to save Adjustment to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        showNotification({
          title: 'Success',
          message: 'Adjustment updated successfully',
          color: 'green',
        });
      }

      if (column.id === 'orderStatus') {
        // Handle dropdown cell data structure
        const dropdownValue =
          'data' in newValue &&
          newValue.data &&
          typeof newValue.data === 'object'
            ? (newValue.data as { value: string }).value
            : '';

        // Update via service layer (batched or immediate) - only send changed field
        updateTransactionData({
          'Order Status': dropdownValue as string,
        });

        showNotification({
          title: 'Success',
          message: 'Order Status updated successfully',
          color: 'green',
        });
      }

      if (column.id === 'notes') {
        // Update via service layer (batched or immediate) - only send changed field
        updateTransactionData({
          Notes: 'data' in newValue ? (newValue.data as string) : '',
        });

        showNotification({
          title: 'Success',
          message: 'Notes updated successfully',
          color: 'green',
        });
      }
    },
    [
      // transactions, // removed unnecessary dependency
      transactionIndexMap,
      columns,
      productToShipmentMap,
      productToShipmentStatusMap,
      filteredData,
      getOrderStatusFromShipmentStatus,
      getUnitPriceForQuantity,
      calculateLineTotal,
      updateTransaction,
      validateCustomer,
      // isBatchModeRef is intentionally NOT in deps - it's a ref, not state
    ]
  );

  // Data loading is now handled by service layer (transactionsLoading)

  // Calculate statistics dynamically based on filtered data (excluding cancelled orders)
  // 🚀 PERFORMANCE: Memoize expensive calculations to prevent re-computation on every render
  const statistics = useMemo(() => {
    const totalTransactions = filteredData.length;
    const totalRevenue = filteredData
      .filter((t) => t['Order Status']?.toLowerCase() !== 'cancelled')
      .reduce(
        (sum, t) => sum + (t['Quantity'] || 0) * (t['Unit Price'] || 0),
        0
      );
    const inTransitTotal = filteredData
      .filter((t) => t['Order Status']?.toLowerCase() === 'in transit')
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);
    const warehouseTotal = filteredData
      .filter((t) => t['Order Status']?.toLowerCase() === 'warehouse')
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);
    const preparedTotal = filteredData
      .filter((t) => t['Order Status']?.toLowerCase() === 'prepared')
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);
    const pendingPaymentTotal = filteredData
      .filter((t) => t['Order Status']?.toLowerCase() === 'pending payment')
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);

    // Status counts
    const uniqueCustomers = new Set(
      filteredData.map((t) => t.Customers).filter(Boolean) // Remove empty/null customer names
    ).size;
    const lalamoveOrders = filteredData.filter(
      (t) => t['Order Status']?.toLowerCase() === 'lalamove'
    ).length;
    const shippedOrders = filteredData.filter(
      (t) => t['Order Status']?.toLowerCase() === 'shipped'
    ).length;
    const deliveredOrders = filteredData.filter(
      (t) => t['Order Status']?.toLowerCase() === 'delivered'
    ).length;

    return {
      totalTransactions,
      totalRevenue,
      inTransitTotal,
      warehouseTotal,
      preparedTotal,
      pendingPaymentTotal,
      uniqueCustomers,
      lalamoveOrders,
      shippedOrders,
      deliveredOrders,
    };
  }, [filteredData]);

  // Define stats cards
  const statsCards: StatCard[] = [
    {
      title: 'CUSTOMERS',
      value: statistics.uniqueCustomers,
      icon: <IconUsers size={18} />,
      color: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    {
      title: 'Total Transactions',
      value: statistics.totalTransactions.toString(),
      icon: <IconReceipt size={18} />,
      color: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    {
      title: 'Total Revenue',
      value: `₱${statistics.totalRevenue.toLocaleString()}`,
      icon: <IconCurrencyDollar size={18} />,
      color: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    {
      title: 'In Transit',
      value: `₱${statistics.inTransitTotal.toLocaleString()}`,
      icon: <IconPackage size={18} />,
      color: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    {
      title: 'Warehouse',
      value: `₱${statistics.warehouseTotal.toLocaleString()}`,
      icon: <IconShoppingCart size={18} />,
      color: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    {
      title: 'Prepared',
      value: `₱${statistics.preparedTotal.toLocaleString()}`,
      icon: <IconPercentage size={18} />,
      color: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    {
      title: 'Pending Payment',
      value: `₱${statistics.pendingPaymentTotal.toLocaleString()}`,
      icon: <IconAdjustments size={18} />,
      color: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    {
      title: 'LALAMOVE',
      value: statistics.lalamoveOrders,
      icon: <IconTruck size={18} />,
      color: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    {
      title: 'Shipped',
      value: statistics.shippedOrders,
      icon: <IconTruck size={18} />,
      color: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
    {
      title: 'Delivered',
      value: statistics.deliveredOrders,
      icon: <IconCheck size={18} />,
      color: 'white',
      backgroundColor: 'rgba(255, 255, 255, 0.15)',
    },
  ];

  // Handle adding empty rows
  const handleAdd10Rows = async () => {
    const newEmptyRows: TransactionData[] = [];

    for (let i = 0; i < 10; i++) {
      newEmptyRows.push({
        id: Date.now() + Math.random() * 10000 + i * 100, // Temporary IDs
        'Order Date': '',
        Customers: '',
        'Product Code': '',
        Quantity: null,
        'Unit Price': null,
        Discount: null,
        Adjustment: null,
        'Line Total': null,
        'Order Status': '',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '-', // Temporary marker for empty row
      });
    }

    try {
      // Save empty rows to database
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newEmptyRows),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API error response:', errorData);
        throw new Error(
          errorData.details ||
            errorData.error ||
            'Failed to save empty rows to database'
        );
      }

      // Reload transactions from database to get the saved rows with proper IDs
      const reloadResponse = await fetch('/api/transactions');
      if (reloadResponse.ok) {
        const data = await reloadResponse.json();
        bulkUpdateTransactions(data);
      }

      notifications.show({
        title: 'Success',
        message: '10 empty rows added successfully',
        color: 'green',
        autoClose: 3000,
      });
    } catch (error) {
      console.error('Error adding empty rows:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to add empty rows to database';
      notifications.show({
        title: 'Error',
        message: errorMessage,
        color: 'red',
        autoClose: 5000,
      });
    }
  };

  // Handle CSV import
  const handleCSVImport = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n');

      // Parse CSV properly handling quoted fields
      const parseCSVLine = (line: string): string[] => {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };

      const headers = parseCSVLine(lines[0]);

      // Map CSV headers (which may be uppercase) to TransactionData keys
      const headerMap: Record<string, keyof TransactionData> = {
        'ORDER DATE': 'Order Date',
        CUSTOMERS: 'Customers',
        'PRODUCT CODE': 'Product Code',
        QUANTITY: 'Quantity',
        'UNIT PRICE': 'Unit Price',
        DISCOUNT: 'Discount',
        ADJUSTMENT: 'Adjustment',
        'LINE TOTAL': 'Line Total',
        'ORDER STATUS': 'Order Status',
        NOTES: 'Notes',
        'INVOICE DATE': 'Invoice Date',
        'PACKED DATE': 'Packed Date',
        'SHIPMENT CODE': 'Shipment Code',
      };
      const importedTransactions: TransactionData[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const values = parseCSVLine(line);
          const transactionData: Record<string, unknown> = {
            id: Date.now() + Math.random() * 10000 + i * 100,
          };

          headers.forEach((rawHeader, index) => {
            const normalized = headerMap[rawHeader.trim().toUpperCase()];
            if (!normalized) return; // Skip unknown columns

            const rawValue = values[index];
            if (rawValue === undefined || rawValue === '') return;

            // Convert numeric fields (strip currency symbols/commas/spaces)
            if (
              [
                'Quantity',
                'Unit Price',
                'Discount',
                'Adjustment',
                'Line Total',
              ].includes(normalized as string)
            ) {
              const sanitized = rawValue
                .replace(/[^0-9.\-]/g, '') // keep digits, dot, minus
                .trim();
              const num = parseFloat(sanitized);
              transactionData[normalized] = Number.isFinite(num) ? num : 0;
            } else {
              transactionData[normalized] = rawValue;
            }
          });

          importedTransactions.push(
            transactionData as unknown as TransactionData
          );
        }
      }

      if (importedTransactions.length === 0) {
        notifications.show({
          title: '⚠️ Import Warning',
          message: 'No valid transaction data found in the CSV file',
          color: 'yellow',
          autoClose: 4000,
        });
        return;
      }

      // ========================================================================
      // ⚠️ DATABASE INTEGRATION - Import to database via API
      // ========================================================================
      // Send imported transactions to API for:
      // 1. Unit Price auto-calculation (from price tiers)
      // 2. Line Total auto-calculation
      // 3. Database persistence
      // ========================================================================
      try {
        const response = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(importedTransactions),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('Import result:', result);

        // Reload transactions from database to get calculated values
        const reloadResponse = await fetch('/api/transactions');
        if (reloadResponse.ok) {
          const reloadedData = await reloadResponse.json();
          bulkUpdateTransactions(reloadedData);
        }

        notifications.show({
          title: '✅ Import Successful',
          message: `${result.count} transactions imported with auto-calculated Unit Price and Line Total`,
          color: 'green',
          autoClose: 5000,
        });
      } catch (apiError) {
        console.error('API import failed:', apiError);
        notifications.show({
          title: '❌ Import Failed',
          message:
            'Failed to import transactions to database. Check console for details.',
          color: 'red',
          autoClose: 5000,
        });
        return;
      }

      setCsvFile(null);

      notifications.show({
        title: '🎉 Import Successful!',
        message: `Successfully imported ${importedTransactions.length} transaction records`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });
    } catch (error) {
      console.error('Import error:', error);
      notifications.show({
        title: '❌ Import Failed',
        message: 'Failed to parse CSV file. Please check the file format.',
        color: 'red',
        autoClose: 4000,
      });
    }
  };

  if (transactionsLoading) {
    return (
      <PageLayout>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '400px',
          }}
        >
          Loading transactions...
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout fluid withPadding>
      {/* Modern Invoice Generation Confirmation Modal */}
      <Modal
        opened={showConfirmationModal}
        onClose={handleCancelInvoiceGeneration}
        title={
          <Group gap="sm">
            <IconReceipt size={24} color="#228be6" />
            <Text size="lg" fw={600}>
              Invoice Generation Confirmation
            </Text>
          </Group>
        }
        size="lg"
        centered
        overlayProps={{ blur: 3 }}
      >
        <Stack gap="lg">
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Important Changes Will Occur"
            color="orange"
            variant="light"
          >
            <Text size="sm">
              This action will modify your data and cannot be undone. Please
              review the details below.
            </Text>
          </Alert>

          <div>
            <Text size="md" fw={500} mb="md">
              You are about to generate invoices for:
            </Text>

            <Stack gap="xs">
              <Group gap="sm">
                <IconUsers size={18} color="#228be6" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {confirmationData.customers}
                  </Text>{' '}
                  customers
                </Text>
              </Group>

              <Group gap="sm">
                <IconPackage size={18} color="#fd7e14" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {confirmationData.warehouseOrders}
                  </Text>{' '}
                  Warehouse orders
                </Text>
              </Group>

              <Group gap="sm">
                <IconCheck size={18} color="#51cf66" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {confirmationData.preparedOrders}
                  </Text>{' '}
                  Prepared orders
                </Text>
              </Group>

              <Group gap="sm">
                <IconClipboardList size={18} color="#7950f2" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {confirmationData.totalTransactions}
                  </Text>{' '}
                  total transactions
                </Text>
              </Group>
            </Stack>
          </div>

          <Divider />

          <div>
            <Text size="md" fw={500} mb="md">
              Important Changes That Will Occur:
            </Text>

            <Stack gap="xs">
              <Text size="sm">
                • All{' '}
                <Text component="span" fw={600}>
                  {confirmationData.warehouseOrders}
                </Text>{' '}
                Warehouse orders will be updated to &ldquo;Prepared&rdquo;
                status
              </Text>
              <Text size="sm">
                • Invoice dates will be set for all processed transactions
              </Text>
              <Text size="sm">
                • A PDF invoice will be generated and downloaded
              </Text>
              <Text size="sm">• All changes will be saved to the database</Text>
            </Stack>
          </div>

          <Divider />

          <Text size="sm" c="dimmed" ta="center">
            Do you want to proceed with invoice generation?
          </Text>

          <Group justify="center" gap="md" mt="md">
            <Button
              variant="outline"
              leftSection={<IconX size={16} />}
              onClick={handleCancelInvoiceGeneration}
              color="gray"
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={handleConfirmInvoiceGeneration}
              color="blue"
              loading={isGeneratingInvoice}
            >
              Generate Invoices
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modern Packing List Generation Confirmation Modal */}
      <Modal
        opened={showPackingListModal}
        onClose={handleCancelPackingListGeneration}
        title={
          <Group gap="sm">
            <IconClipboardList size={24} color="#7950f2" />
            <Text size="lg" fw={600}>
              Packing List Generation Confirmation
            </Text>
          </Group>
        }
        size="lg"
        centered
        overlayProps={{ blur: 3 }}
      >
        <Stack gap="lg">
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Packing List Generation"
            color="violet"
            variant="light"
          >
            <Text size="sm">
              This will generate packing lists for all eligible
              &ldquo;Prepared&rdquo; orders with line total ≤ ₱50.00.
            </Text>
          </Alert>

          <div>
            <Text size="md" fw={500} mb="md">
              You are about to generate packing lists for:
            </Text>

            <Stack gap="xs">
              <Group gap="sm">
                <IconClipboardList size={18} color="#7950f2" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {packingListData.eligibleTransactions}
                  </Text>{' '}
                  eligible transactions
                </Text>
              </Group>

              <Group gap="sm">
                <IconUsers size={18} color="#228be6" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {packingListData.customers}
                  </Text>{' '}
                  customers
                </Text>
              </Group>

              <Group gap="sm">
                <IconCurrencyDollar size={18} color="#51cf66" />
                <Text size="sm">
                  Total value:{' '}
                  <Text component="span" fw={600}>
                    ₱{packingListData.totalValue.toLocaleString()}
                  </Text>
                </Text>
              </Group>
            </Stack>
          </div>

          <Divider />

          <div>
            <Text size="md" fw={500} mb="md">
              Eligibility Criteria:
            </Text>

            <Stack gap="xs">
              <Text size="sm">
                • Only transactions with &ldquo;Prepared&rdquo; status
              </Text>
              <Text size="sm">• Line total must be ≤ ₱50.00</Text>
              <Text size="sm">
                • PDF packing lists will be generated and downloaded
              </Text>
            </Stack>
          </div>

          <Divider />

          <Text size="sm" c="dimmed" ta="center">
            Do you want to proceed with packing list generation?
          </Text>

          <Group justify="center" gap="md" mt="md">
            <Button
              variant="outline"
              leftSection={<IconX size={16} />}
              onClick={handleCancelPackingListGeneration}
              color="gray"
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconClipboardList size={16} />}
              onClick={handleConfirmPackingListGeneration}
              color="violet"
              loading={isGeneratingPackingList}
            >
              Generate Packing Lists
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modern Distribution Generation Confirmation Modal */}
      <Modal
        opened={showDistributionModal}
        onClose={handleCancelDistributionGeneration}
        title={
          <Group gap="sm">
            <IconTruck size={24} color="#fd7e14" />
            <Text size="lg" fw={600}>
              Distribution Slip Generation Confirmation
            </Text>
          </Group>
        }
        size="lg"
        centered
        overlayProps={{ blur: 3 }}
      >
        <Stack gap="lg">
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Distribution Slip Generation"
            color="orange"
            variant="light"
          >
            <Text size="sm">
              This will generate distribution slips for all
              &ldquo;Warehouse&rdquo; status orders, sorted by quantity
              ascending.
            </Text>
          </Alert>

          <div>
            <Text size="md" fw={500} mb="md">
              You are about to generate distribution slips for:
            </Text>

            <Stack gap="xs">
              <Group gap="sm">
                <IconPackage size={18} color="#fd7e14" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {distributionData.warehouseTransactions}
                  </Text>{' '}
                  Warehouse transactions
                </Text>
              </Group>

              <Group gap="sm">
                <IconUsers size={18} color="#228be6" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {distributionData.customers}
                  </Text>{' '}
                  customers
                </Text>
              </Group>

              <Group gap="sm">
                <IconShoppingCart size={18} color="#7950f2" />
                <Text size="sm">
                  Total quantity:{' '}
                  <Text component="span" fw={600}>
                    {distributionData.totalQuantity.toLocaleString()}
                  </Text>{' '}
                  items
                </Text>
              </Group>

              <Group gap="sm">
                <IconCurrencyDollar size={18} color="#51cf66" />
                <Text size="sm">
                  Total value:{' '}
                  <Text component="span" fw={600}>
                    ₱{distributionData.totalValue.toLocaleString()}
                  </Text>
                </Text>
              </Group>
            </Stack>
          </div>

          <Divider />

          <div>
            <Text size="md" fw={500} mb="md">
              Distribution Features:
            </Text>

            <Stack gap="xs">
              <Text size="sm">
                • Only transactions with &ldquo;Warehouse&rdquo; status
              </Text>
              <Text size="sm">
                • Distribution slips sorted by quantity (ascending)
              </Text>
              <Text size="sm">
                • PDF distribution slips will be generated and downloaded
              </Text>
              <Text size="sm">
                • Optimized for warehouse picking operations
              </Text>
            </Stack>
          </div>

          <Divider />

          <Text size="sm" c="dimmed" ta="center">
            Do you want to proceed with distribution slip generation?
          </Text>

          <Group justify="center" gap="md" mt="md">
            <Button
              variant="outline"
              leftSection={<IconX size={16} />}
              onClick={handleCancelDistributionGeneration}
              color="gray"
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconTruck size={16} />}
              onClick={handleConfirmDistributionGeneration}
              color="orange"
              loading={isGeneratingDistribution}
            >
              Generate Distribution Slips
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Customer Warning Modal */}
      <Modal
        opened={showCustomerWarningModal}
        onClose={() => {
          setShowCustomerWarningModal(false);
          setCustomerWarningData(null);
        }}
        title={
          <Group gap="sm">
            <IconAlertTriangle size={24} color="#fa5252" />
            <Text size="lg" fw={600} c="red">
              Customer Warning
            </Text>
          </Group>
        }
        centered
        size="md"
        radius="md"
        withCloseButton={false}
        overlayProps={{ blur: 3 }}
      >
        <Stack gap="lg">
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Important Notice"
            color="red"
            variant="light"
          >
            <Text size="sm">
              This customer has been flagged with critical issues. Please review
              the details below before proceeding.
            </Text>
          </Alert>

          <div>
            <Text size="md" fw={500} mb="md">
              Customer:{' '}
              <Text component="span" fw={700} c="dark">
                {customerWarningData?.customerName}
              </Text>
            </Text>

            <Stack gap="sm">
              {customerWarningData?.warnings.map((warning, index) => {
                const isBanned = warning.includes('BANNED CUSTOMER');
                const isCancellation = warning.includes(
                  'HIGH CANCELLATION RATE'
                );

                return (
                  <Group key={index} gap="sm" align="flex-start">
                    {isBanned ? (
                      <IconX
                        size={18}
                        color="#fa5252"
                        style={{ marginTop: 2 }}
                      />
                    ) : isCancellation ? (
                      <IconAlertTriangle
                        size={18}
                        color="#fd7e14"
                        style={{ marginTop: 2 }}
                      />
                    ) : (
                      <IconAlertTriangle
                        size={18}
                        color="#228be6"
                        style={{ marginTop: 2 }}
                      />
                    )}
                    <Text
                      size="sm"
                      style={{ flex: 1 }}
                      c={isBanned ? 'red' : isCancellation ? 'orange' : 'dark'}
                    >
                      {warning.replace(/^🚫|^⚠️/, '').trim()}
                    </Text>
                  </Group>
                );
              })}
            </Stack>
          </div>

          <Divider />

          <Text size="sm" c="dimmed" ta="center">
            Would you like to proceed with this customer despite the warnings?
          </Text>

          <Group justify="center" gap="md" mt="md">
            <Button
              variant="outline"
              leftSection={<IconX size={16} />}
              onClick={customerWarningData?.onCancel}
              color="gray"
            >
              Cancel Selection
            </Button>
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={customerWarningData?.onProceed}
              color="red"
            >
              Proceed Anyway
            </Button>
          </Group>
        </Stack>
      </Modal>

      <TransactionsLayout
        data={transactions as unknown as Item[]}
        filteredData={filteredData as unknown as Item[]}
        columns={columns}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        searchPlaceholder="Search transactions by customer, product code, status, notes, or shipment code..."
        getCellContent={cellContentGetter}
        onCellEdited={handleCellEdited}
        statsCards={statsCards}
        enableCSVImport={true}
        enableCtrlF={true}
        csvFile={csvFile}
        onFileChange={setCsvFile}
        onCSVImport={handleCSVImport}
        customRenderers={
          allCells as unknown as readonly Record<string, unknown>[]
        }
        onAddRows={handleAdd10Rows}
        statusOptions={statusOptions}
        selectedStatuses={selectedStatuses}
        onStatusFilter={handleStatusFilter}
        onGenerateInvoice={
          handleGenerateInvoice as unknown as (data: Item[]) => Promise<void>
        }
        onGeneratePackingList={
          handleGeneratePackingList as unknown as (
            data: Item[]
          ) => Promise<void>
        }
        onGenerateDistribution={
          handleGenerateDistribution as unknown as (
            data: Item[]
          ) => Promise<void>
        }
        isGeneratingInvoice={isGeneratingInvoice}
        isGeneratingPackingList={isGeneratingPackingList}
        isGeneratingDistribution={isGeneratingDistribution}
      />
    </PageLayout>
  );
}
