'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Stack,
  Text,
  TextInput,
  Card,
  Group,
  Button,
  Menu,
  FileButton,
} from '@mantine/core';
import {
  IconSearch,
  IconDownload,
  IconChevronDown,
  IconFileSpreadsheet,
  IconTable,
  IconChartBar,
  IconUpload,
  IconPlus,
} from '@tabler/icons-react';
import { GridView } from '@/components/grid';
import { PageLayout } from '@/components/layout/PageLayout';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { throttle } from '@/lib/performance';
import { showNotification } from '@mantine/notifications';
import { useCustomersData } from '../hooks/useCustomersData';
import { useCustomerForm } from '../hooks/useCustomerForm';
import { useCustomerDuplicateCheck } from '../hooks/useCustomerDuplicateCheck';
import { useCustomersGrid } from '../hooks/useCustomersGrid';
import { useCustomersCSV } from '../hooks/useCustomersCSV';
import { CustomerStatsCards } from './CustomerStatsCards';
import { operationsActionButtonStyles } from '../../common/buttonStyles';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

interface CustomersPageProps {
  apiBasePath?: string;
}

// Lazy load modal component
const AddCustomerModal = dynamic(
  () =>
    import('./AddCustomerModal').then((mod) => ({
      default: mod.AddCustomerModal,
    })),
  {
    ssr: false,
    loading: () => null,
  }
);

// Custom styles for larger font and center aligned headers
const customGridStyles = `
  .data-grid-container * {
    font-size: 20px !important;
    font-family: Inter, sans-serif !important;
  }
  .data-grid-container canvas {
    font-size: 20px !important;
  }
  .data-grid-container .gdg-cell {
    font-size: 20px !important;
    font-family: Inter, sans-serif !important;
  }
  .data-grid-container .gdg-header {
    font-size: 20px !important;
    font-weight: 600 !important;
    font-family: Inter, sans-serif !important;
    text-align: center !important;
  }
  .data-grid-container .gdg-cell-text {
    font-size: 20px !important;
  }
  .data-grid-container [role="gridcell"] {
    font-size: 20px !important;
  }
  .data-grid-container [role="columnheader"] {
    font-size: 20px !important;
    font-weight: 600 !important;
    text-align: center !important;
    justify-content: center !important;
    display: flex !important;
    align-items: center !important;
  }
  .data-grid-container div {
    font-size: 20px !important;
  }
  .dvn-scroller {
    font-size: 20px !important;
  }
  
  /* Make customer name column look clickable */
  .data-grid-container canvas {
    cursor: default;
  }
  .data-grid-container:hover canvas {
    cursor: pointer;
  }
`;

/**
 * Customers Page Component
 * Main component for customer management with grid view, search, CSV import, and CRUD operations
 */
export function CustomersPage({ apiBasePath }: CustomersPageProps) {
  // Data hooks
  const {
    customers,
    filteredCustomers,
    searchQuery,
    stats,
    isLoading,
    handleSearch,
    addCustomer,
  } = useCustomersData(apiBasePath);

  const {
    formData,
    isModalOpen,
    handleCustomerNameChange,
    handleFieldChange,
    closeModal,
    openModal,
    getValidatedCustomerData,
  } = useCustomerForm(customers);

  const { checkForDuplicates } = useCustomerDuplicateCheck(apiBasePath);

  // Grid logic hook
  const { columns, getData, getRowCount, drawHeader, handleCellClick } =
    useCustomersGrid({ filteredCustomers });

  // CSV operations hook
  const {
    file,
    setFile,
    handleImportCSV,
    handleExportCSV,
    handleExportDetailedCSV,
    handleExportAnalysisCSV,
  } = useCustomersCSV({ customers, filteredCustomers, apiBasePath });

  // Local state for responsive grid height
  const [gridHeight, setGridHeight] = useState<number>(600);

  // Keep grid height at ~85vh responsively
  useEffect(() => {
    const updateHeight = () => {
      const h = Math.floor(window.innerHeight * 0.85);
      setGridHeight(Math.max(300, h));
    };

    const throttledResize = throttle(updateHeight, 150);

    updateHeight();
    window.addEventListener('resize', throttledResize);

    return () => {
      window.removeEventListener('resize', throttledResize);
      throttledResize.cancel(); // Cancel any pending throttled calls
    };
  }, []);

  useCtrlFFocus('[data-ctrlf-target="customers-search-input"]', true);

  // Handle add customer submission
  const handleAddCustomer = async () => {
    const result = getValidatedCustomerData();

    if (!result.isValid || !result.data) {
      showNotification({
        title: 'Validation Error',
        message: result.errors?.join(', ') || 'Please check the form',
        color: 'red',
      });
      return;
    }

    try {
      const shouldProceed = await checkForDuplicates({
        customerName: result.data['Customer Name'],
        phoneNumber: result.data['Phone Number'],
        address: result.data.Address,
      });

      if (!shouldProceed) {
        return;
      }

      await addCustomer(result.data);
      closeModal();

      showNotification({
        title: '🎉 Customer Added Successfully!',
        message: `${result.data['Customer Name']} has been added to your customer database`,
        color: 'green',
        autoClose: 4000,
      });
    } catch (error) {
      showNotification({
        title: 'Saved locally only',
        message: 'Database not reachable',
        color: 'yellow',
      });
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PageLayout fluid withPadding>
        <TableSkeleton rows={15} columns={11} />
      </PageLayout>
    );
  }

  return (
    <PageLayout fluid withPadding>
      <style dangerouslySetInnerHTML={{ __html: customGridStyles }} />
      <Stack
        gap="md"
        style={{ width: '100%', maxWidth: 'none', margin: '0 auto' }}
      >
        {/* Stats cards */}
        <CustomerStatsCards stats={stats} />

        {/* Search and controls */}
        <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
          <TextInput
            placeholder={'Search customers... (Ctrl+F)'}
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ flex: 1, minWidth: 300 }}
            styles={{
              input: {
                backgroundColor: '#ffffff',
                border: '1px solid #dee2e6',
                '&:focus': { borderColor: '#228be6' },
              },
            }}
            data-ctrlf-target="customers-search-input"
          />

          <Group gap="sm">
            <Menu shadow="md" width={280} position="bottom-end">
              <Menu.Target>
                <Button
                  leftSection={<IconDownload size={16} color="#ffffff" />}
                  rightSection={<IconChevronDown size={16} color="#ffffff" />}
                  styles={operationsActionButtonStyles}
                >
                  Export CSV
                </Button>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Label>Export Format</Menu.Label>
                <Menu.Item
                  leftSection={<IconFileSpreadsheet size={16} />}
                  onClick={handleExportCSV}
                >
                  <div>
                    <Text size="sm" fw={500}>
                      Standard CSV
                    </Text>
                    <Text size="xs" c="dimmed">
                      Basic customer info only
                    </Text>
                  </div>
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconTable size={16} />}
                  onClick={handleExportDetailedCSV}
                >
                  <div>
                    <Text size="sm" fw={500}>
                      Detailed (Numbered Columns)
                    </Text>
                    <Text size="xs" c="dimmed">
                      With Shopee usernames, addresses, phones
                    </Text>
                  </div>
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconChartBar size={16} />}
                  onClick={handleExportAnalysisCSV}
                >
                  <div>
                    <Text size="sm" fw={500}>
                      For Analysis (Duplicate Rows)
                    </Text>
                    <Text size="xs" c="dimmed">
                      One row per additional info item
                    </Text>
                  </div>
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            <Group gap="xs">
              <FileButton accept=".csv" onChange={setFile}>
                {(fileButtonProps) => (
                  <Button
                    {...fileButtonProps}
                    leftSection={<IconUpload size={16} color="#ffffff" />}
                    styles={operationsActionButtonStyles}
                  >
                    {file ? 'Change CSV' : 'Select CSV'}
                  </Button>
                )}
              </FileButton>
              {file && (
                <Button
                  onClick={() => handleImportCSV(file)}
                  leftSection={<IconUpload size={16} color="#ffffff" />}
                  styles={operationsActionButtonStyles}
                >
                  Import
                </Button>
              )}
            </Group>

            <Button
              leftSection={<IconPlus size={16} />}
              color="blue"
              onClick={openModal}
            >
              Add Customer
            </Button>
          </Group>
        </Group>

        {/* Add New Customer Modal */}
        <AddCustomerModal
          isOpen={isModalOpen}
          formData={formData}
          onClose={closeModal}
          onCustomerNameChange={handleCustomerNameChange}
          onFieldChange={handleFieldChange}
          onSubmit={handleAddCustomer}
        />

        <Card
          withBorder
          shadow="sm"
          radius="md"
          padding={0}
          style={{
            height: gridHeight,
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            position: 'relative',
            background: '#fff',
            fontSize: '18px',
          }}
          className="data-grid-container"
        >
          <GridView
            getCellContent={getData}
            columns={columns}
            rows={getRowCount()}
            height={gridHeight}
            width={'100%'}
            overscrollX={0}
            smoothScrollX={true}
            smoothScrollY={true}
            rowHeight={70}
            headerHeight={80}
            rowMarkers="none"
            isDraggable={false}
            onCellClicked={handleCellClick}
            experimental={{ scrollbarWidthOverride: 16 }}
            drawHeader={drawHeader}
            theme={{
              accentColor: '#228be6',
              accentLight: 'rgba(34, 139, 230, 0.1)',
              textDark: '#212529',
              textMedium: '#495057',
              textLight: '#868e96',
              textBubble: '#ffffff',
              bgIconHeader: '#f8f9fa',
              fgIconHeader: '#495057',
              textHeader: '#343a40',
              textHeaderSelected: '#228be6',
              bgCell: '#ffffff',
              bgCellMedium: '#ffffff',
              bgHeader: '#f8f9fa',
              bgHeaderHasFocus: '#e9ecef',
              bgHeaderHovered: '#e9ecef',
              bgBubble: '#228be6',
              bgBubbleSelected: '#1c7ed6',
              bgSearchResult: '#fff3cd',
              borderColor: 'rgba(206, 212, 218, 0.5)',
              drilldownBorder: 'rgba(34, 139, 230, 0.4)',
              linkColor: '#228be6',
              headerFontStyle: 'bold 17px Inter',
              baseFontStyle: '17px Inter',
              editorFontSize: '20',
              fontFamily: 'Inter',
              cellHorizontalPadding: 12,
              cellVerticalPadding: 8,
            }}
            getCellsForSelection={true}
          />
        </Card>

        {/* Pagination counter */}
        <Text size="sm" c="dimmed" ta="center">
          {customers.length > 0
            ? `Showing ${filteredCustomers.length} of ${customers.length} customers${
                searchQuery ? ' (filtered)' : ''
              }`
            : 'Customer management system - import CSV file to get started'}
        </Text>
      </Stack>
    </PageLayout>
  );
}
