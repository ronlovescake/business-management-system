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
  Items: string;
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
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Define columns for the transactions table
  const columns: GridColumn[] = [
    { title: 'ORDER DATE', width: 200, id: 'orderDate' },
    { title: 'CUSTOMERS', width: 300, id: 'customers' },
    { title: 'ITEMS', width: 400, id: 'items' },
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
    items: 'Items',
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
  const { searchQuery, filteredData, handleSearch, getCellContent } =
    useDataTable({
      data: transactions,
      searchFields: [
        'Customers',
        'Items',
        'Order Status',
        'Notes',
        'Shipment Code',
      ],
    });

  // Create cell content getter function that properly handles the parameters
  const cellContentGetter = (cell: Item): GridCell => {
    return getCellContent(cell, columns, idToKey) as GridCell;
  };

  // Load transactions data
  useEffect(() => {
    const loadTransactions = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/transactions');

        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const data = await response.json();
        setTransactions(data);
      } catch (error) {
        console.error('Failed to load transactions:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load transactions data',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    loadTransactions();
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

      // Save to database via API (bulk import)
      const saveResponse = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importedTransactions),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save transactions to database');
      }

      // Reload transactions from database
      const reloadResponse = await fetch('/api/transactions');
      if (reloadResponse.ok) {
        const reloadedTransactions = await reloadResponse.json();
        setTransactions(reloadedTransactions);
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
        searchPlaceholder="Search transactions by customer, items, status, notes, or shipment code..."
        getCellContent={cellContentGetter}
        statsCards={statsCards}
        enableCSVImport={true}
        csvFile={csvFile}
        onFileChange={setCsvFile}
        onCSVImport={handleCSVImport}
        footerLeft={`Showing ${filteredData.length} of ${transactions.length} transactions`}
        searchRightButtons={
          <Group gap="xs" wrap="wrap">
            <Button variant="outline" color="gray" size="sm">
              All Status
            </Button>
            <Button variant="outline" color="blue" size="sm">
              In Transit
            </Button>
            <Button variant="outline" color="orange" size="sm">
              Warehouse
            </Button>
            <Button variant="outline" color="green" size="sm">
              Prepared
            </Button>
            <Button variant="outline" color="cyan" size="sm">
              Ready For Dispatch
            </Button>
            <Button variant="outline" color="purple" size="sm">
              Checked Out
            </Button>
            <Button variant="outline" color="pink" size="sm">
              Lalamove
            </Button>
            <Button variant="outline" color="yellow" size="sm">
              On-Hold
            </Button>
            <Button variant="outline" color="red" size="sm">
              Pending Payment
            </Button>
            <Button variant="outline" color="teal" size="sm">
              Shipped
            </Button>
            <Button variant="outline" color="dark" size="sm">
              Cancelled
            </Button>
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
