'use client';

import { useMemo, useState, useEffect } from 'react';
import { Stack, Text, Group, Table } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import { showInfo } from '@/lib/alerts';
import { logger } from '@/lib/logger';

interface ProductFromAPI {
  id: string;
  'Product Code': string | null;
  Quantity: number;
  COGS: number;
  'Shipment Code': string | null;
  'Shipment Status': string | null;
}

interface TransactionFromAPI {
  id: string;
  'Product Code': string | null;
  Quantity: number;
  'Unit Price': number;
  'Order Status': string | null;
}

interface InventoryItem {
  id: string;
  productCode: string;
  quantity: number;
  onhand: number;
  totalOrder: number;
  availableStock: number;
  totalSales: number;
  cogs: number;
  netProfit: number;
  percentage: number; // Stored as decimal (e.g. 0.175 = 17.5%)
  endingInventoryValue: number;
  shipmentCode: string;
  shipmentStatus: string;
}

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const percentFormatter = new Intl.NumberFormat('en-PH', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [products, setProducts] = useState<ProductFromAPI[]>([]);
  const [transactions, setTransactions] = useState<TransactionFromAPI[]>([]);

  // Fetch products and transactions from API on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch products and transactions in parallel
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

        const [productsData, transactionsData] = await Promise.all([
          productsResponse.json(),
          transactionsResponse.json(),
        ]);

        setProducts(productsData);
        setTransactions(transactionsData);
      } catch (error) {
        logger.error('Failed to load data:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load inventory data',
          color: 'red',
        });
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, []);

  // Transform products API data to inventory items
  const data = useMemo<InventoryItem[]>(() => {
    // Calculate total order and total sales per product code from transactions
    // Sum quantities and sales where Order Status is NOT "Cancelled"
    const totalOrderByProduct = new Map<string, number>();
    const totalSalesByProduct = new Map<string, number>();

    transactions.forEach((transaction) => {
      const productCode = transaction['Product Code'];
      const orderStatus = transaction['Order Status'];
      const quantity = transaction.Quantity || 0;
      const unitPrice = transaction['Unit Price'] || 0;

      // Only count non-cancelled orders
      if (productCode && orderStatus !== 'Cancelled') {
        // Total Order: sum of quantities
        const currentTotalOrder = totalOrderByProduct.get(productCode) || 0;
        totalOrderByProduct.set(productCode, currentTotalOrder + quantity);

        // Total Sales: sum of (unit price × quantity)
        const currentTotalSales = totalSalesByProduct.get(productCode) || 0;
        totalSalesByProduct.set(
          productCode,
          currentTotalSales + unitPrice * quantity
        );
      }
    });

    return products.map((product) => {
      const productCode = product['Product Code'] || '';
      const totalOrder = totalOrderByProduct.get(productCode) || 0;
      const totalSales = totalSalesByProduct.get(productCode) || 0;
      const cogs = product.COGS || 0;

      return {
        id: product.id,
        productCode,
        quantity: product.Quantity || 0,
        onhand: 0, // TODO: Calculate from transactions/sales
        totalOrder,
        availableStock: 0, // TODO: Calculate (onhand - totalOrder)
        totalSales,
        cogs,
        netProfit: 0, // TODO: Calculate (totalSales - cogs)
        percentage: 0, // TODO: Calculate profit percentage
        endingInventoryValue: 0, // TODO: Calculate (availableStock * cost)
        shipmentCode: product['Shipment Code'] || '',
        shipmentStatus: product['Shipment Status'] || '',
      };
    });
  }, [products, transactions]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return data;
    }

    const query = searchQuery.trim().toLowerCase();

    return data.filter((item) => {
      const searchableValues = [
        item.productCode,
        item.shipmentCode,
        item.shipmentStatus,
        item.quantity,
        item.onhand,
        item.totalOrder,
        item.availableStock,
        item.totalSales,
        item.cogs,
        item.netProfit,
        item.percentage,
        item.endingInventoryValue,
      ]
        .map((value) =>
          typeof value === 'number'
            ? value.toString()
            : (value?.toString() ?? '')
        )
        .join(' ')
        .toLowerCase();

      return searchableValues.includes(query);
    });
  }, [data, searchQuery]);

  const totals = useMemo(
    () =>
      filteredData.reduce(
        (acc, item) => {
          acc.quantity += item.quantity;
          acc.onhand += item.onhand;
          acc.totalOrder += item.totalOrder;
          acc.availableStock += item.availableStock;
          acc.totalSales += item.totalSales;
          acc.cogs += item.cogs;
          acc.netProfit += item.netProfit;
          acc.endingInventoryValue += item.endingInventoryValue;
          return acc;
        },
        {
          quantity: 0,
          onhand: 0,
          totalOrder: 0,
          availableStock: 0,
          totalSales: 0,
          cogs: 0,
          netProfit: 0,
          endingInventoryValue: 0,
        }
      ),
    [filteredData]
  );

  const handleImportCSV = (file: File | null) => {
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
  };

  const handleExportCSV = () => {
    void showInfo(
      'Would export the filtered inventory dataset to CSV.',
      'Export Simulation'
    );
  };

  const handleAddNew = () => {
    void showInfo(
      'Would open the create inventory item form.',
      'Add New Simulation'
    );
  };

  const headers = [
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
  ];

  const emptyStateMessage = searchQuery
    ? `No inventory records match "${searchQuery}".`
    : 'No inventory records yet. Use import or add new to populate the table.';

  // Show loading state
  if (isLoading) {
    return (
      <Stack gap="md">
        <StandardTableControls
          searchPlaceholder="Search inventory..."
          onSearch={setSearchQuery}
          onImport={handleImportCSV}
          onExport={handleExportCSV}
          onAddNew={handleAddNew}
          isImporting={isImporting}
          hideImport
          hideExport
          hideAddNew
        />
        <StandardTableContainer>
          <StandardDataTable
            headers={headers}
            emptyState="Loading inventory data..."
            colSpan={headers.length}
          >
            {[]}
          </StandardDataTable>
        </StandardTableContainer>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <StandardTableControls
        searchPlaceholder="Search inventory..."
        onSearch={setSearchQuery}
        onImport={handleImportCSV}
        onExport={handleExportCSV}
        onAddNew={handleAddNew}
        isImporting={isImporting}
      />

      <StandardTableContainer
        summary={
          <Group justify="space-between" align="center" wrap="wrap">
            <Text size="sm" c="dimmed">
              Showing {filteredData.length} of {data.length} inventory items
            </Text>
            <Group gap="lg" wrap="wrap">
              <Text size="sm" c="dimmed">
                Total Onhand: {numberFormatter.format(totals.onhand)}
              </Text>
              <Text size="sm" c="dimmed">
                Available: {numberFormatter.format(totals.availableStock)}
              </Text>
              <Text size="sm" c="dimmed">
                Ending Value:{' '}
                {currencyFormatter.format(totals.endingInventoryValue)}
              </Text>
            </Group>
          </Group>
        }
      >
        <StandardDataTable
          headers={headers}
          emptyState={emptyStateMessage}
          colSpan={headers.length}
        >
          {filteredData.map((item) => (
            <Table.Tr key={item.id}>
              <Table.Td style={{ textAlign: 'left' }}>
                <Text size="sm" c="#495057">
                  {item.productCode}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text size="sm" c="#495057">
                  {numberFormatter.format(item.quantity)}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text size="sm" c="#495057">
                  {numberFormatter.format(item.onhand)}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text size="sm" c="#495057">
                  {numberFormatter.format(item.totalOrder)}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text size="sm" c="#495057">
                  {numberFormatter.format(item.availableStock)}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text size="sm" c="#495057">
                  {currencyFormatter.format(item.totalSales)}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text size="sm" c="#495057">
                  {currencyFormatter.format(item.cogs)}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text size="sm" c="#495057">
                  {currencyFormatter.format(item.netProfit)}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text size="sm" c="#495057">
                  {percentFormatter.format(item.percentage)}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Text size="sm" c="#495057">
                  {currencyFormatter.format(item.endingInventoryValue)}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'left' }}>
                <Text size="sm" c="#495057">
                  {item.shipmentCode}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text
                  size="sm"
                  c={item.shipmentStatus === 'Delivered' ? 'green' : '#495057'}
                  fw={item.shipmentStatus === 'Delivered' ? 600 : 500}
                >
                  {item.shipmentStatus}
                </Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </StandardDataTable>
      </StandardTableContainer>
    </Stack>
  );
}
