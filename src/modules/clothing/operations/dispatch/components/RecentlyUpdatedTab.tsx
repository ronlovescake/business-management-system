'use client';

import { memo, useCallback } from 'react';
import { Stack, Text, Group, Table, Badge } from '@mantine/core';
import { formatDate } from '@/utils/date';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import type { DispatchItem, RawOrderData } from '../types';

interface RecentlyUpdatedTabProps {
  filteredData: DispatchItem[];
  effectiveRawData: RawOrderData[];
  mockData: unknown[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleXlsxImport: (file: File | null) => Promise<void>;
  handleExportCSV: () => void;
  handleAddNew: () => void;
  isImportingRawData: boolean;
  lookupCustomerName: (username: string) => string;
  copyToClipboard: (text: string, label: string) => Promise<void>;
}

function RecentlyUpdatedTabComponent({
  filteredData,
  effectiveRawData,
  mockData,
  searchQuery,
  setSearchQuery,
  handleXlsxImport,
  handleExportCSV,
  handleAddNew,
  isImportingRawData,
  lookupCustomerName,
  copyToClipboard,
}: RecentlyUpdatedTabProps) {
  const formatShipTime = useCallback((rawShipTime: unknown): string => {
    if (!rawShipTime) {
      return '-';
    }

    try {
      const date = new Date(String(rawShipTime));
      if (!isNaN(date.getTime())) {
        return formatDate(date, 'MMMM D, YYYY h:mm A');
      }
    } catch (error) {
      // If parsing fails, use the raw value
      return String(rawShipTime);
    }

    return String(rawShipTime);
  }, []);

  return (
    <Stack gap="md">
      {/* Table Controls */}
      <StandardTableControls
        searchPlaceholder="Search recently updated orders..."
        onSearch={setSearchQuery}
        onImport={handleXlsxImport}
        onExport={handleExportCSV}
        onAddNew={handleAddNew}
        isImporting={isImportingRawData}
        acceptFileTypes=".xlsx,.xls"
      />

      {/* Table Container */}
      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {filteredData.length} of{' '}
              {effectiveRawData.length > 0
                ? effectiveRawData.length
                : mockData.length}{' '}
              recently updated orders
            </Text>
          </Group>
        }
      >
        <StandardDataTable
          headers={[
            'DATE UPDATED',
            'CUSTOMER NAME',
            'PRODUCT CODE',
            'QUANTITY',
          ]}
          emptyState={
            searchQuery
              ? `No orders found matching "${searchQuery}"`
              : 'No recently updated orders available. Import XLSX file or click "Add New" to create one.'
          }
          colSpan={4}
        >
          {filteredData.map((item) => {
            // Get the raw order data to access ship time
            const rawOrder = effectiveRawData.find(
              (row) => String(row['Order ID'] || '') === item.id
            );
            const dateUpdated = formatShipTime(rawOrder?.['Ship Time']);

            return (
              <Table.Tr key={item.id}>
                <Table.Td style={{ textAlign: 'center' }}>
                  {dateUpdated}
                </Table.Td>
                <Table.Td style={{ textAlign: 'left' }}>
                  {item.customerNames ? (
                    <Group gap="xs">
                      <Text
                        onClick={() =>
                          copyToClipboard(item.customerNames, 'Customer name')
                        }
                        style={{ cursor: 'pointer' }}
                      >
                        {item.customerNames}
                      </Text>
                      {lookupCustomerName(item.username) && (
                        <Badge size="xs" color="green" variant="light">
                          Matched
                        </Badge>
                      )}
                    </Group>
                  ) : (
                    <Group gap="xs">
                      <Text c="dimmed" fs="italic">
                        No customer found
                      </Text>
                      <Badge size="xs" color="yellow" variant="light">
                        No Match
                      </Badge>
                    </Group>
                  )}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {String(rawOrder?.['Product Code'] || '-')}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {String(rawOrder?.['Quantity'] || '-')}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </StandardDataTable>
      </StandardTableContainer>
    </Stack>
  );
}

export const RecentlyUpdatedTab = memo(RecentlyUpdatedTabComponent);
RecentlyUpdatedTab.displayName = 'RecentlyUpdatedTab';
