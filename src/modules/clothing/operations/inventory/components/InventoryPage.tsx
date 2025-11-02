'use client';

import { useMemo, useState } from 'react';
import { Stack, Text, Group, Table } from '@mantine/core';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import { showInfo } from '@/lib/alerts';

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

  // Static data placeholder until API wiring is ready
  const data = useMemo<InventoryItem[]>(
    () => [
      {
        id: 'P-0001',
        productCode: 'P-0001',
        quantity: 1250,
        onhand: 940,
        totalOrder: 1100,
        availableStock: 550,
        totalSales: 245000,
        cogs: 168500,
        netProfit: 76500,
        percentage: 0.3125,
        endingInventoryValue: 103250,
        shipmentCode: 'SHIP-2025-001',
        shipmentStatus: 'In Transit',
      },
      {
        id: 'P-0002',
        productCode: 'P-0002',
        quantity: 820,
        onhand: 780,
        totalOrder: 640,
        availableStock: 410,
        totalSales: 198750,
        cogs: 122400,
        netProfit: 76350,
        percentage: 0.3844,
        endingInventoryValue: 65400,
        shipmentCode: 'SHIP-2025-004',
        shipmentStatus: 'Delivered',
      },
      {
        id: 'P-0003',
        productCode: 'P-0003',
        quantity: 540,
        onhand: 320,
        totalOrder: 480,
        availableStock: 175,
        totalSales: 146500,
        cogs: 98750,
        netProfit: 47750,
        percentage: 0.3261,
        endingInventoryValue: 38200,
        shipmentCode: 'SHIP-2025-008',
        shipmentStatus: 'Awaiting Sorting',
      },
      {
        id: 'P-0004',
        productCode: 'P-0004',
        quantity: 1090,
        onhand: 870,
        totalOrder: 950,
        availableStock: 620,
        totalSales: 312400,
        cogs: 221600,
        netProfit: 90800,
        percentage: 0.2906,
        endingInventoryValue: 158700,
        shipmentCode: 'SHIP-2025-010',
        shipmentStatus: 'For Pickup',
      },
      {
        id: 'P-0005',
        productCode: 'P-0005',
        quantity: 460,
        onhand: 240,
        totalOrder: 390,
        availableStock: 140,
        totalSales: 118950,
        cogs: 80400,
        netProfit: 38550,
        percentage: 0.3242,
        endingInventoryValue: 26750,
        shipmentCode: 'SHIP-2025-013',
        shipmentStatus: 'Queued',
      },
    ],
    []
  );

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
