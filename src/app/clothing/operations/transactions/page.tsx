'use client';

import React, { useState, useEffect } from 'react';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { DataTable, StatCard, useDataTable } from '../../../../components/ui';
import { GridColumn, Item, GridCell } from '@glideapps/glide-data-grid';
import { Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
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
  Quantity: number;
  'Unit Price': number;
  Discount: number;
  Adjustment: number;
  'Line Total': number;
  'Order Status': string;
  Notes: string;
  'Invoice Date': string;
  'Packed Date': string;
  'Shipment Code': string;
}

export default function Transactions() {
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
  const columns: GridColumn[] = [
    { title: 'ORDER DATE', width: 200, id: 'orderDate' },
    { title: 'CUSTOMERS', width: 300, id: 'customers' },
    { title: 'PRODUCT CODE', width: 400, id: 'productCode' },
    { title: 'QUANTITY', width: 150, id: 'quantity' },
    { title: 'UNIT PRICE', width: 180, id: 'unitPrice' },
    { title: 'DISCOUNT', width: 150, id: 'discount' },
    { title: 'ADJUSTMENT', width: 150, id: 'adjustment' },
    { title: 'LINE TOTAL', width: 180, id: 'lineTotal' },
    { title: 'ORDER STATUS', width: 200, id: 'orderStatus' },
    { title: 'NOTES', width: 300, id: 'notes' },
    { title: 'INVOICE DATE', width: 200, id: 'invoiceDate' },
    { title: 'PACKED DATE', width: 200, id: 'packedDate' },
    { title: 'SHIPMENT CODE', width: 200, grow: 1, id: 'shipmentCode' },
  ];

  // Map column IDs to data keys
  const idToKey: Record<string, keyof TransactionData> = {
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
  };

  // Use the data table hook for search functionality
  const {
    searchQuery,
    filteredData: searchFilteredData,
    handleSearch,
    getCellContent,
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
    if (selectedStatuses.size === 0) {
      // No status filters selected, show all search results
      return searchFilteredData;
    }

    // If "All Status" is selected, show all search results
    if (selectedStatuses.has('All Status')) {
      return searchFilteredData;
    }

    // Filter by selected statuses (OR logic - show transactions matching ANY selected status)
    return searchFilteredData.filter((transaction) => {
      const status = transaction['Order Status'];
      return status && selectedStatuses.has(status);
    });
  }, [searchFilteredData, selectedStatuses]);

  // Create cell content getter function that properly handles the parameters
  const cellContentGetter = (cell: Item): GridCell => {
    return getCellContent(cell, columns, idToKey) as GridCell;
  };

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
      const importedTransactions: TransactionData[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const values = parseCSVLine(line);
          const transactionData: Record<string, unknown> = {
            id: Date.now() + i,
          };

          headers.forEach((header, index) => {
            if (values[index] !== undefined && values[index] !== '') {
              // Convert numeric fields
              if (
                [
                  'Quantity',
                  'Unit Price',
                  'Discount',
                  'Adjustment',
                  'Line Total',
                ].includes(header)
              ) {
                transactionData[header] = parseFloat(values[index]) || 0;
              } else {
                transactionData[header] = values[index];
              }
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
        statsCards={statsCards}
        enableCSVImport={true}
        csvFile={csvFile}
        onFileChange={setCsvFile}
        onCSVImport={handleCSVImport}
        footerLeft={`Showing ${filteredData.length} of ${transactions.length} transactions`}
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
          <Button leftSection={<IconPlus size={16} />} color="green">
            Add Transaction
          </Button>
        }
      />
    </PageLayout>
  );
}
