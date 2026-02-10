'use client';

import { memo, useMemo, useCallback } from 'react';
import {
  Stack,
  Text,
  Group,
  Table,
  ActionIcon,
  Tooltip,
  Badge,
  Button,
  Select,
  TextInput,
  FileButton,
} from '@mantine/core';
import {
  IconMessageCircle,
  IconSearch,
  IconUpload,
  IconDownload,
  IconPlus,
} from '@tabler/icons-react';
import { formatDate } from '@/utils/date';
import {
  StandardDataTable,
  StandardTableContainer,
} from '@/components/tables/StandardDataTable';
import type { DispatchItem, RawOrderData } from '../types';

interface CheckoutUpdateTabProps {
  filteredData: DispatchItem[];
  effectiveRawData: RawOrderData[];
  mockData: unknown[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string | null;
  setStatusFilter: (filter: string | null) => void;
  dateRangeFilter: string | null;
  setDateRangeFilter: (filter: string | null) => void;
  handleXlsxImport: (file: File | null) => Promise<void>;
  handleExportCSV: () => void;
  handleAddNew: () => void;
  isImportingRawData: boolean;
  lookupCustomerName: (username: string) => string;
  lookupFacebookLink: (username: string) => string | undefined;
  copyToClipboard: (text: string, label: string) => Promise<void>;
}

function CheckoutUpdateTabComponent({
  filteredData,
  effectiveRawData,
  mockData,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  dateRangeFilter,
  setDateRangeFilter,
  handleXlsxImport,
  handleExportCSV,
  handleAddNew,
  isImportingRawData,
  lookupCustomerName,
  lookupFacebookLink,
  copyToClipboard,
}: CheckoutUpdateTabProps) {
  // Get unique status values for filter dropdown
  const statusOptions = useMemo(() => {
    const statuses = new Set<string>();
    effectiveRawData.forEach((row) => {
      const status = row['Order Status'];
      if (status && typeof status === 'string') {
        statuses.add(status);
      }
    });
    return Array.from(statuses)
      .sort()
      .map((status) => ({ value: status, label: status }));
  }, [effectiveRawData]);

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
      {/* Table Controls with Filter */}
      <Group justify="space-between" wrap="wrap">
        <Group gap="md" style={{ flex: 1 }}>
          <TextInput
            placeholder="Search checkout updates..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, minWidth: '250px' }}
          />
          <Select
            placeholder="Filter by status"
            clearable
            data={statusOptions}
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ minWidth: '180px' }}
          />
          <Select
            placeholder="Filter by date"
            clearable
            data={[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'last7days', label: 'Last 7 Days' },
              { value: 'last30days', label: 'Last 30 Days' },
              { value: 'thisMonth', label: 'This Month' },
              { value: 'lastMonth', label: 'Last Month' },
            ]}
            value={dateRangeFilter}
            onChange={setDateRangeFilter}
            style={{ minWidth: '180px' }}
          />
        </Group>
        <Group gap="sm">
          <FileButton
            onChange={(file) => handleXlsxImport(file)}
            accept=".xlsx,.xls"
          >
            {(props) => (
              <Button
                {...props}
                leftSection={<IconUpload size={16} />}
                loading={isImportingRawData}
              >
                Import
              </Button>
            )}
          </FileButton>
          <Button
            leftSection={<IconDownload size={16} />}
            onClick={handleExportCSV}
          >
            Export
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={handleAddNew}>
            Update Order
          </Button>
        </Group>
      </Group>

      {/* Table Container */}
      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {filteredData.length} of{' '}
              {effectiveRawData.length > 0
                ? effectiveRawData.length
                : mockData.length}{' '}
              checkout updates
            </Text>
          </Group>
        }
      >
        <StandardDataTable
          headers={[
            'ORDER STATUS',
            'UPDATE DATE',
            'USERNAMES',
            'CUSTOMER NAMES',
            'ACTION',
          ]}
          emptyState={
            searchQuery
              ? `No checkout updates found matching "${searchQuery}"`
              : 'No checkout updates available. Import XLSX file or click "Add New" to create one.'
          }
          colSpan={5}
        >
          {filteredData.map((item) => {
            // Get the raw order data to access ship time
            const rawOrder = effectiveRawData.find(
              (row) => String(row['Order ID'] || '') === item.id
            );
            const shipTime = formatShipTime(rawOrder?.['Ship Time']);

            return (
              <Table.Tr key={item.id}>
                <Table.Td style={{ textAlign: 'center' }}>
                  <Text
                    c={
                      item.orderStatus === 'Shipped'
                        ? 'green'
                        : item.orderStatus === 'Processing'
                          ? 'blue'
                          : 'orange'
                    }
                    fw={500}
                  >
                    {item.orderStatus}
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{shipTime}</Table.Td>
                <Table.Td style={{ textAlign: 'left' }}>
                  {item.username}
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
                  <Group gap="xs" justify="center">
                    <Tooltip
                      label={
                        lookupFacebookLink(item.username)
                          ? 'Message customer'
                          : 'No Facebook link available'
                      }
                    >
                      <ActionIcon
                        variant="light"
                        color="blue"
                        component="a"
                        href={lookupFacebookLink(item.username) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Message customer"
                        disabled={!lookupFacebookLink(item.username)}
                        style={{
                          cursor: lookupFacebookLink(item.username)
                            ? 'pointer'
                            : 'not-allowed',
                          opacity: lookupFacebookLink(item.username) ? 1 : 0.5,
                        }}
                      >
                        <IconMessageCircle size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
        </StandardDataTable>
      </StandardTableContainer>
    </Stack>
  );
}

export const CheckoutUpdateTab = memo(CheckoutUpdateTabComponent);
CheckoutUpdateTab.displayName = 'CheckoutUpdateTab';
