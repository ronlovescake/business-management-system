'use client';

// ==============================================================================
// ⚠️⚠️⚠️ CRITICAL WARNING - READ BEFORE MAKING ANY CHANGES ⚠️⚠️⚠️
// ==============================================================================
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

import React, { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { DataTable, StatCard, useDataTable } from '../../../../components/ui';
import { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';
import { GridCellKind } from '@glideapps/glide-data-grid';
import { allCells } from '@glideapps/glide-data-grid-cells';
import { Button, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconRefresh,
  IconReceipt,
  IconCurrencyDollar,
  IconPackage,
  IconTruck,
  IconShoppingCart,
  IconAdjustments,
  IconPercentage,
  IconCheck,
  IconClock,
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
  // State for customer names from customers page
  const [customerNames, setCustomerNames] = useState<string[]>([]);

  // State for product codes from prices page
  const [productCodes, setProductCodes] = useState<string[]>([]);

  // State for price tiers - store all price data for lookup
  const [priceTiers, setPriceTiers] = useState<
    Array<{
      'Product Code': string;
      'Lower Limit': number;
      'Upper Limit': number;
      Prices: number;
    }>
  >([]);

  // State for product-to-shipment mapping from products page
  const [productToShipmentMap, setProductToShipmentMap] = useState<
    Record<string, string>
  >({});

  // State for product-to-shipment-status mapping from products page
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

  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    loadSavedFilterState()
  );
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  // ============================================================================
  // DATABASE INTEGRATION - Load transactions from API
  // ============================================================================
  // Load transactions from database on component mount
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/transactions');
        if (response.ok) {
          const data = await response.json();
          setTransactions(data);
          console.log(`Loaded ${data.length} transactions from database`);
        } else {
          console.error('Failed to load transactions:', response.statusText);
          notifications.show({
            title: 'Error',
            message: 'Failed to load transactions from database',
            color: 'red',
          });
        }
      } catch (error) {
        console.error('Error loading transactions:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load transactions from database',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
  }, []); // Run once on mount

  // Load customer names from customers API and imported transactions
  useEffect(() => {
    const loadCustomerNames = async () => {
      try {
        let apiCustomers: string[] = [];

        // Try to fetch customer names from the customers API
        try {
          const response = await fetch('/api/customers');
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
          .filter(Boolean)
          .filter((name, index, array) => array.indexOf(name) === index);

        // Combine API customers and transaction customers, then deduplicate and sort
        const allCustomers = [...apiCustomers, ...transactionCustomers]
          .filter(Boolean)
          .filter((name, index, array) => array.indexOf(name) === index)
          .sort();

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
        const response = await fetch('/api/prices');
        if (response.ok) {
          const pricesData = await response.json();

          // Store all price tiers for unit price lookup
          setPriceTiers(pricesData);

          // Extract unique product codes and sort them
          const codes = pricesData
            .map((price: { 'Product Code': string }) => price['Product Code'])
            .filter(Boolean)
            .filter(
              (code: string, index: number, array: string[]) =>
                array.indexOf(code) === index
            )
            .sort();

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
          fetch('/api/products'),
          fetch('/api/shipments'),
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
              console.log(
                'Debug - Shipment Mapping:',
                shipmentCode,
                '->',
                shipmentStatus
              );
            }
          });

          // Debug: Log the first few products and shipments to see the structure
          console.log(
            'Debug - Products Data Sample:',
            productsData.slice(0, 3)
          );
          console.log(
            'Debug - Shipments Data Sample:',
            shipmentsData.slice(0, 3)
          );

          productsData.forEach((product: Record<string, unknown>) => {
            // Log each product to see its structure
            console.log('Debug - Individual Product:', product);

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

              console.log(
                'Debug - Mapped Product:',
                productCode,
                'to Shipment:',
                shipmentCode,
                'with Status:',
                correspondingShipmentStatus
              );
            }

            // Special debug for the specific product we're testing
            if (productCode && productCode.includes('MBEB-010425')) {
              console.log('Debug - Found MBEB product:', product);
              console.log('Debug - Product shipment code:', shipmentCode);
              console.log(
                'Debug - Looking up status for shipment code:',
                shipmentCode
              );
              console.log(
                'Debug - Found shipment status:',
                shipmentCodeToStatus[shipmentCode]
              );
              console.log(
                'Debug - All available shipment codes:',
                Object.keys(shipmentCodeToStatus)
              );
            }
          });

          console.log('Debug - Final Status Mapping:', statusMapping);

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
      setTransactions((currentTransactions) => {
        let updatedCount = 0;
        const updatedTransactions = currentTransactions.map((transaction) => {
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

          // Show notification to user
          notifications.show({
            title: 'ORDER STATUS Updated',
            message: `Synced ${updatedCount} transaction(s) with current shipment status`,
            color: 'blue',
            position: 'top-right',
          });
        }

        return updatedTransactions;
      });
    },
    [getOrderStatusFromShipmentStatus]
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

  // Manual sync function for the button
  const handleManualSync = useCallback(async () => {
    console.log('🔄 Manual sync triggered - Refreshing shipment data...');

    try {
      // Fetch fresh shipment data
      const [productsResponse, shipmentsResponse] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/shipments'),
      ]);

      if (productsResponse.ok && shipmentsResponse.ok) {
        const productsData = await productsResponse.json();
        const shipmentsData = await shipmentsResponse.json();

        // Rebuild the status mapping with fresh data
        const shipmentCodeToStatus: Record<string, string> = {};
        const statusMapping: Record<string, string> = {};

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
            const correspondingShipmentStatus =
              shipmentCodeToStatus[shipmentCode] || '';
            statusMapping[productCode] = correspondingShipmentStatus;
          }
        });

        // Update the mappings and sync transactions
        setProductToShipmentStatusMap(statusMapping);
        syncTransactionsWithShipmentStatus(statusMapping);

        notifications.show({
          title: 'Sync Complete',
          message: 'ORDER STATUS has been refreshed with latest shipment data',
          color: 'green',
          position: 'top-right',
        });
      } else {
        throw new Error('Failed to fetch fresh data');
      }
    } catch (error) {
      console.error('Error during manual sync:', error);
      notifications.show({
        title: 'Sync Failed',
        message: 'Could not refresh ORDER STATUS. Please try again.',
        color: 'red',
        position: 'top-right',
      });
    }
  }, [syncTransactionsWithShipmentStatus]);

  // Invoice generation function
  const handleGenerateInvoice = useCallback(async () => {
    console.log('📄 Generating invoices for Warehouse transactions...');
    setIsGeneratingInvoice(true);

    try {
      // Filter for "Warehouse" status transactions only
      const warehouseTransactions = transactions.filter(
        (transaction) => transaction['Order Status'] === 'Warehouse'
      );

      if (warehouseTransactions.length === 0) {
        notifications.show({
          title: '⚠️ No Warehouse Transactions',
          message:
            'No transactions with "Warehouse" status found for invoice generation.',
          color: 'yellow',
          autoClose: 5000,
        });
        return;
      }

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
        transactions: warehouseTransactions,
        customers: customersData,
      };

      console.log(
        `📋 Found ${warehouseTransactions.length} warehouse transactions for invoice generation`
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
        notifications.show({
          title: '✅ Invoices Generated',
          message: `PDF with invoices for ${warehouseTransactions.length} warehouse transactions has been downloaded.`,
          color: 'green',
          autoClose: 5000,
        });

        // Update Invoice Date for the processed transactions
        const currentDate = new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });

        // Update transactions with invoice date (only those without existing dates)
        const updatedTransactions = transactions.map((transaction) => {
          if (
            transaction['Order Status'] === 'Warehouse' &&
            !transaction['Invoice Date']
          ) {
            return {
              ...transaction,
              'Invoice Date': currentDate,
            };
          }
          return transaction;
        });

        setTransactions(updatedTransactions);
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
    }
  }, [transactions]);

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

    if (individual.length === 0) {
      // No individual statuses selected -> show only rows without Order Status
      return searchFilteredData.filter((transaction) => {
        const status = transaction['Order Status'];
        return !status || status.trim() === '';
      });
    }

    // Filter by selected individual statuses (OR logic) AND always include rows without Order Status
    return searchFilteredData.filter((transaction) => {
      const status = transaction['Order Status'];
      // Always show rows without Order Status, or rows with selected statuses
      return (
        !status ||
        status.trim() === '' ||
        (status && individual.includes(status))
      );
    });
  }, [searchFilteredData, selectedStatuses]);

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

      // Make Order Date column editable
      if (column.id === 'orderDate') {
        return {
          kind: GridCellKind.Text,
          data: (value ?? '').toString(),
          displayData: (value ?? '').toString(),
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Make Customers column editable with dropdown
      if (column.id === 'customers') {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: true,
          copyData: (value ?? '').toString(),
          data: {
            kind: 'dropdown-cell',
            value: (value ?? '').toString(),
            allowedValues: customerNames,
          },
        } as GridCell;
      }

      // Make Product Code column editable with dropdown
      if (column.id === 'productCode') {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: true,
          copyData: (value ?? '').toString(),
          data: {
            kind: 'dropdown-cell',
            value: (value ?? '').toString(),
            allowedValues: productCodes,
          },
        } as GridCell;
      }

      // Make Quantity column editable
      if (column.id === 'quantity') {
        const displayValue =
          typeof value === 'number' && value === 0
            ? ''
            : (value ?? '').toString();
        return {
          kind: GridCellKind.Text,
          data: (value ?? '').toString(),
          displayData: displayValue,
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Make Discount column editable
      if (column.id === 'discount') {
        const displayValue =
          typeof value === 'number' && value === 0
            ? ''
            : (value ?? '').toString();
        return {
          kind: GridCellKind.Text,
          data: (value ?? '').toString(),
          displayData: displayValue,
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Make Adjustment column editable
      if (column.id === 'adjustment') {
        const displayValue =
          typeof value === 'number' && value === 0
            ? ''
            : (value ?? '').toString();
        return {
          kind: GridCellKind.Text,
          data: (value ?? '').toString(),
          displayData: displayValue,
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Make Order Status column editable with dropdown
      if (column.id === 'orderStatus') {
        return {
          kind: GridCellKind.Custom,
          allowOverlay: true,
          copyData: (value ?? '').toString(),
          data: {
            kind: 'dropdown-cell',
            value: (value ?? '').toString(),
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
        return {
          kind: GridCellKind.Text,
          data: (value ?? '').toString(),
          displayData: (value ?? '').toString(),
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Auto-populate Shipment Code based on Product Code (read-only)
      if (column.id === 'shipmentCode') {
        const currentProductCode = item['Product Code'];
        let displayValue = (value ?? '').toString();

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

        return {
          kind: GridCellKind.Number,
          data: value,
          displayData: displayValue,
          allowOverlay: false,
        } as GridCell;
      }

      return {
        kind: GridCellKind.Text,
        data: (value ?? '').toString(),
        displayData: (value ?? '').toString(),
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

      // Find the index in the original transactions array using the unique ID
      const transactionIndex = transactions.findIndex(
        (t) => t.id === transaction.id
      );

      // If no ID match found, this is a serious data consistency issue
      if (transactionIndex === -1) {
        console.error('Transaction not found in original array:', transaction);
        return;
      }

      if (column.id === 'orderDate') {
        // Create a new updated transaction
        const updatedTransaction = {
          ...transaction,
          'Order Date': 'data' in newValue ? (newValue.data as string) : '',
        };

        // Update the transactions array
        const newTransactions = [...transactions];
        newTransactions[transactionIndex] = updatedTransaction;
        setTransactions(newTransactions);

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          notifications.show({
            title: 'Error',
            message: 'Failed to save Order Date to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        notifications.show({
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

        // Auto-populate Order Date when customer is selected (only if it's empty)
        const currentOrderDate = transaction['Order Date'];
        const shouldAutoPopulateDate =
          !currentOrderDate || currentOrderDate.trim() === '';

        let autoPopulatedOrderDate = currentOrderDate;
        if (
          shouldAutoPopulateDate &&
          dropdownValue &&
          dropdownValue.trim() !== ''
        ) {
          const now = new Date();
          autoPopulatedOrderDate = now.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
        }

        // Create a new updated transaction
        const updatedTransaction = {
          ...transaction,
          Customers: dropdownValue as string,
          'Order Date': autoPopulatedOrderDate,
        };

        // Update the transactions array
        const newTransactions = [...transactions];
        newTransactions[transactionIndex] = updatedTransaction;
        setTransactions(newTransactions);

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          notifications.show({
            title: 'Error',
            message: 'Failed to save Customer to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        notifications.show({
          title: 'Success',
          message:
            shouldAutoPopulateDate &&
            dropdownValue &&
            dropdownValue.trim() !== ''
              ? 'Customer updated and Order Date auto-populated'
              : 'Customer updated successfully',
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

        // Update the transactions array
        const newTransactions = [...transactions];
        newTransactions[transactionIndex] = updatedTransaction;
        setTransactions(newTransactions);

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          notifications.show({
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

        // Add note if ORDER STATUS was preserved
        if (!shouldAutoPopulateStatus && currentOrderStatus) {
          message += ` (Order Status "${currentOrderStatus}" preserved)`;
        }

        notifications.show({
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
        const newTransactions = [...transactions];
        newTransactions[transactionIndex] = updatedTransaction;
        setTransactions(newTransactions);

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          notifications.show({
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

        notifications.show({
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

        // Update the transactions array
        const newTransactions = [...transactions];
        newTransactions[transactionIndex] = updatedTransaction;
        setTransactions(newTransactions);

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          notifications.show({
            title: 'Error',
            message: 'Failed to save Unit Price to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        notifications.show({
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

        // Update the transactions array
        const newTransactions = [...transactions];
        newTransactions[transactionIndex] = updatedTransaction;
        setTransactions(newTransactions);

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          notifications.show({
            title: 'Error',
            message: 'Failed to save Discount to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        notifications.show({
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

        // Update the transactions array
        const newTransactions = [...transactions];
        newTransactions[transactionIndex] = updatedTransaction;
        setTransactions(newTransactions);

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          notifications.show({
            title: 'Error',
            message: 'Failed to save Adjustment to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        notifications.show({
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

        // Create a new updated transaction
        const updatedTransaction = {
          ...transaction,
          'Order Status': dropdownValue as string,
        };

        // Update the transactions array
        const newTransactions = [...transactions];
        newTransactions[transactionIndex] = updatedTransaction;
        setTransactions(newTransactions);

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          notifications.show({
            title: 'Error',
            message: 'Failed to save Order Status to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        notifications.show({
          title: 'Success',
          message: 'Order Status updated successfully',
          color: 'green',
        });
      }

      if (column.id === 'notes') {
        // Create a new updated transaction
        const updatedTransaction = {
          ...transaction,
          Notes: 'data' in newValue ? (newValue.data as string) : '',
        };

        // Update the transactions array
        const newTransactions = [...transactions];
        newTransactions[transactionIndex] = updatedTransaction;
        setTransactions(newTransactions);

        // Save to database
        saveTransactionToDatabase(updatedTransaction).catch((error) => {
          notifications.show({
            title: 'Error',
            message: 'Failed to save Notes to database',
            color: 'red',
          });
          console.error('Database save error:', error);
        });

        notifications.show({
          title: 'Success',
          message: 'Notes updated successfully',
          color: 'green',
        });
      }
    },
    [
      transactions,
      columns,
      productToShipmentMap,
      productToShipmentStatusMap,
      filteredData,
      getOrderStatusFromShipmentStatus,
      getUnitPriceForQuantity,
      calculateLineTotal,
    ]
  );

  // Initialize with empty data (no database for now)
  useEffect(() => {
    setLoading(false);
  }, []);

  // Calculate statistics dynamically based on filtered data (excluding cancelled orders)
  const totalTransactions = filteredData.length;
  const totalRevenue = filteredData
    .filter((t) => t['Order Status']?.toLowerCase() !== 'cancelled')
    .reduce((sum, t) => sum + (t['Quantity'] || 0) * (t['Unit Price'] || 0), 0);
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
  const pendingOrders = filteredData.filter(
    (t) => t['Order Status']?.toLowerCase() === 'pending'
  ).length;
  const processingOrders = filteredData.filter(
    (t) => t['Order Status']?.toLowerCase() === 'processing'
  ).length;
  const shippedOrders = filteredData.filter(
    (t) => t['Order Status']?.toLowerCase() === 'shipped'
  ).length;
  const deliveredOrders = filteredData.filter(
    (t) => t['Order Status']?.toLowerCase() === 'delivered'
  ).length;

  // Define stats cards
  const statsCards: StatCard[] = [
    {
      title: 'Total Transactions',
      value: totalTransactions.toString(),
      icon: <IconReceipt size={18} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-6)',
    },
    {
      title: 'Total Revenue',
      value: `₱${totalRevenue.toLocaleString()}`,
      icon: <IconCurrencyDollar size={18} />,
      color: 'green',
      backgroundColor: 'var(--mantine-color-green-6)',
    },
    {
      title: 'In Transit',
      value: `₱${inTransitTotal.toLocaleString()}`,
      icon: <IconPackage size={18} />,
      color: 'orange',
      backgroundColor: '#fd7e14',
    },
    {
      title: 'Warehouse',
      value: `₱${warehouseTotal.toLocaleString()}`,
      icon: <IconShoppingCart size={18} />,
      color: 'purple',
      backgroundColor: '#9775fa',
    },
    {
      title: 'Prepared',
      value: `₱${preparedTotal.toLocaleString()}`,
      icon: <IconPercentage size={18} />,
      color: 'yellow',
      backgroundColor: 'var(--mantine-color-yellow-6)',
    },
    {
      title: 'Pending Payment',
      value: `₱${pendingPaymentTotal.toLocaleString()}`,
      icon: <IconAdjustments size={18} />,
      color: 'indigo',
      backgroundColor: 'var(--mantine-color-indigo-6)',
    },
    {
      title: 'Pending Orders',
      value: pendingOrders,
      icon: <IconClock size={18} />,
      color: 'yellow',
      backgroundColor: 'var(--mantine-color-yellow-7)',
    },
    {
      title: 'Processing',
      value: processingOrders,
      icon: <IconClock size={18} />,
      color: 'blue',
      backgroundColor: 'var(--mantine-color-blue-7)',
    },
    {
      title: 'Shipped',
      value: shippedOrders,
      icon: <IconTruck size={18} />,
      color: 'cyan',
      backgroundColor: 'var(--mantine-color-cyan-6)',
    },
    {
      title: 'Delivered',
      value: deliveredOrders,
      icon: <IconCheck size={18} />,
      color: 'green',
      backgroundColor: 'var(--mantine-color-green-7)',
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
        setTransactions(data);
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
          setTransactions(reloadedData);
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

  if (loading) {
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
      <DataTable
        data={transactions}
        filteredData={filteredData}
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
        footerLeft={
          <Group gap="md" align="center">
            <Button
              variant="outline"
              size="sm"
              leftSection={<IconPlus size={14} />}
              onClick={handleAdd10Rows}
            >
              Add 10 Rows
            </Button>
            <Text size="sm" c="dimmed">
              {`Showing ${filteredData.length} of ${transactions.length} transactions`}
            </Text>
          </Group>
        }
        searchRightButtons={
          <Group gap="xs" wrap="wrap">
            {statusOptions.map((status) => (
              <Button
                key={status}
                variant={selectedStatuses.has(status) ? 'filled' : 'outline'}
                color={selectedStatuses.has(status) ? 'blue' : 'gray'}
                size="sm"
                onClick={() => handleStatusFilter(status)}
              >
                {status}
              </Button>
            ))}
          </Group>
        }
        actionButtons={
          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              color="blue"
              variant="light"
              onClick={handleManualSync}
            >
              Sync ORDER STATUS
            </Button>
            <Button
              leftSection={<IconReceipt size={16} />}
              color="green"
              onClick={handleGenerateInvoice}
              loading={isGeneratingInvoice}
              disabled={isGeneratingInvoice}
            >
              {isGeneratingInvoice ? 'Generating...' : 'Generate Invoice'}
            </Button>
            <Button leftSection={<IconPlus size={16} />} color="blue">
              Generate Packing List
            </Button>
            <Button leftSection={<IconPlus size={16} />} color="violet">
              Generate Distribution
            </Button>
          </Group>
        }
      />
    </PageLayout>
  );
}
