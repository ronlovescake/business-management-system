'use client';

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
        return {
          kind: GridCellKind.Text,
          data: (value ?? '').toString(),
          displayData: (value ?? '').toString(),
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Make Discount column editable
      if (column.id === 'discount') {
        return {
          kind: GridCellKind.Text,
          data: (value ?? '').toString(),
          displayData: (value ?? '').toString(),
          allowOverlay: true,
          readonly: false,
        } as GridCell;
      }

      // Make Adjustment column editable
      if (column.id === 'adjustment') {
        return {
          kind: GridCellKind.Text,
          data: (value ?? '').toString(),
          displayData: (value ?? '').toString(),
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

      if (typeof value === 'number') {
        return {
          kind: GridCellKind.Number,
          data: value,
          displayData: value.toLocaleString(),
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
  // Helper function to get unit price based on product code and quantity
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

  // Helper function to calculate Line Total
  // Formula: (QUANTITY * UNIT PRICE) - DISCOUNT - ADJUSTMENT
  const calculateLineTotal = useCallback(
    (
      quantity: number,
      unitPrice: number,
      adjustment: number
    ): number => {
      return quantity * unitPrice - adjustment;
    },
    []
  );

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

        // Auto-populate or clear Unit Price based on Product Code and Quantity
        // Formula: Unit Price = (Tier Price - Discount)
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
            // Apply discount: Unit Price = Tier Price - Discount
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

      if (column.id === 'quantity') {
        const newQuantity =
          'data' in newValue ? Number(newValue.data as string) || 0 : 0;

        // Auto-populate or clear Unit Price based on Quantity and Product Code
        // Formula: Unit Price = (Tier Price - Discount)
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
            // Apply discount: Unit Price = Tier Price - Discount
            autoPopulatedUnitPrice = foundTierPrice - currentDiscount;
            unitPriceAutoPopulated = true;
          }
        }

        // Calculate Line Total: (QUANTITY * UNIT PRICE) - ADJUSTMENT
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

      if (column.id === 'unitPrice') {
        const newUnitPrice =
          'data' in newValue ? Number(newValue.data as string) || 0 : 0;

        // Calculate Line Total: (QUANTITY * UNIT PRICE) - DISCOUNT - ADJUSTMENT
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

        notifications.show({
          title: 'Success',
          message: 'Unit Price updated successfully',
          color: 'green',
        });
      }

      if (column.id === 'discount') {
        const newDiscount =
          'data' in newValue ? Number(newValue.data as string) || 0 : 0;

        // Recalculate Unit Price with new Discount
        // Formula: Unit Price = (Tier Price - Discount)
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
            // Apply new discount: Unit Price = Tier Price - New Discount
            recalculatedUnitPrice = foundTierPrice - newDiscount;
          }
        }

        // Calculate Line Total: (QUANTITY * UNIT PRICE) - DISCOUNT - ADJUSTMENT
        // Calculate Line Total: (QUANTITY * UNIT PRICE) - ADJUSTMENT
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

        notifications.show({
          title: 'Success',
          message: 'Discount updated successfully',
          color: 'green',
        });
      }

      if (column.id === 'adjustment') {
        const newAdjustment =
          'data' in newValue ? Number(newValue.data as string) || 0 : 0;

        // Calculate Line Total: (QUANTITY * UNIT PRICE) - DISCOUNT - ADJUSTMENT
        // Calculate Line Total: (QUANTITY * UNIT PRICE) - ADJUSTMENT
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

  // Calculate statistics dynamically based on filtered data
  const totalTransactions = filteredData.length;
  const totalRevenue = filteredData.reduce(
    (sum, t) => sum + (t['Line Total'] || 0),
    0
  );
  const totalQuantity = filteredData.reduce(
    (sum, t) => sum + (t['Quantity'] || 0),
    0
  );
  const totalDiscount = filteredData.reduce(
    (sum, t) => sum + (t['Discount'] || 0),
    0
  );
  const totalAdjustment = filteredData.reduce(
    (sum, t) => sum + (t['Adjustment'] || 0),
    0
  );
  const avgOrderValue =
    totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

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
      title: 'Total Quantity',
      value: totalQuantity.toLocaleString(),
      icon: <IconPackage size={18} />,
      color: 'orange',
      backgroundColor: '#fd7e14',
    },
    {
      title: 'Avg Order Value',
      value: `₱${avgOrderValue.toLocaleString()}`,
      icon: <IconShoppingCart size={18} />,
      color: 'purple',
      backgroundColor: '#9775fa',
    },
    {
      title: 'Total Discounts',
      value: `₱${totalDiscount.toLocaleString()}`,
      icon: <IconPercentage size={18} />,
      color: 'yellow',
      backgroundColor: 'var(--mantine-color-yellow-6)',
    },
    {
      title: 'Total Adjustments',
      value: `₱${totalAdjustment.toLocaleString()}`,
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
  const handleAdd10Rows = () => {
    const newEmptyRows: TransactionData[] = [];

    for (let i = 0; i < 10; i++) {
      newEmptyRows.push({
        id: Date.now() + Math.random() * 10000 + i * 100, // More unique IDs
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
        'Shipment Code': '',
      });
    }

    // Add the new empty rows to the existing transactions
    setTransactions((prevTransactions) => [
      ...prevTransactions,
      ...newEmptyRows,
    ]);

    notifications.show({
      title: 'Success',
      message: '10 empty rows added successfully',
      color: 'green',
      autoClose: 3000,
    });
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

      // Load imported data directly into component state (no database for now)
      setTransactions(importedTransactions);

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
            <Button leftSection={<IconPlus size={16} />} color="green">
              Add Transaction
            </Button>
          </Group>
        }
      />
    </PageLayout>
  );
}
