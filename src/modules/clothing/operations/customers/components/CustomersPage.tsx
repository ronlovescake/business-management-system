'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  Stack,
  Text,
  Button,
  Group,
  FileButton,
  TextInput,
  Card,
  Menu,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUpload,
  IconSearch,
  IconPlus,
  IconCheck,
  IconDownload,
  IconChevronDown,
  IconFileSpreadsheet,
  IconTable,
  IconChartBar,
} from '@tabler/icons-react';
import {
  GridCellKind,
  type GridCell,
  type GridColumn,
  type Item,
} from '@glideapps/glide-data-grid';
import { GridView } from '@/components/grid';
import { PageLayout } from '@/components/layout/PageLayout';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { throttle } from '@/lib/performance';
import { logger } from '@/lib/logger';
import { CustomerService } from '../services/CustomerService';
import { useCustomersData } from '../hooks/useCustomersData';
import { useCustomerForm } from '../hooks/useCustomerForm';
import { CustomerStatsCards } from './CustomerStatsCards';
import { operationsActionButtonStyles } from '../../common/buttonStyles';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

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
export function CustomersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const lastClickRef = useRef<{ cell: Item; time: number } | null>(null);

  // Custom hooks
  const {
    customers,
    filteredCustomers,
    searchQuery,
    stats,
    isLoading,
    handleSearch,
    addCustomer,
  } = useCustomersData();

  const {
    formData,
    isModalOpen,
    handleCustomerNameChange,
    handleFieldChange,
    closeModal,
    openModal,
    getValidatedCustomerData,
  } = useCustomerForm(customers);

  // Local state
  const [file, setFile] = useState<File | null>(null);
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

  // Customer columns
  const columns: GridColumn[] = useMemo(
    () => [
      { title: 'Date', width: 160, id: 'date' },
      { title: 'Customer Name', width: 500, id: 'customerName' },
      { title: 'Phone Number', width: 190, id: 'phoneNumber' },
      { title: 'Address', width: 340, id: 'address' },
      { title: 'Facebook', width: 220, id: 'facebook' },
      { title: 'Email Address', width: 260, id: 'emailAddress' },
      { title: 'Business Name', width: 500, id: 'businessName' },
      { title: 'Tax Number', width: 170, id: 'taxNumber' },
      { title: 'Business Address', width: 340, id: 'businessAddress' },
      {
        title: 'Business Contact Number',
        width: 260,
        id: 'businessContactNumber',
      },
      { title: 'Customer Status', width: 120, id: 'customerStatus', grow: 1 },
    ],
    []
  );

  // CSV import functionality
  const handleImportCSV = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      notifications.show({
        id: 'import-progress',
        title: 'Importing...',
        message: 'Processing CSV file, please wait...',
        color: 'blue',
        loading: true,
        autoClose: false,
      });

      const result = await CustomerService.importFromCSV(file);

      notifications.hide('import-progress');

      if (result.success && result.stats) {
        const {
          customersCreated,
          customersUpdated,
          additionalInfoCreated,
          errors,
          totalRows,
        } = result.stats;

        notifications.show({
          title: 'Import Successful',
          message: `Processed ${totalRows} rows. Created ${customersCreated} new customers, updated ${customersUpdated} customers, added ${additionalInfoCreated} additional info records${errors.length > 0 ? `. ${errors.length} errors occurred.` : ''}`,
          color: errors.length > 0 ? 'yellow' : 'green',
          autoClose: 10000,
        });

        if (errors.length > 0) {
          logger.warn('Import errors:', errors);
        }

        // Refresh customers list
        void queryClient.invalidateQueries({
          queryKey: queryKeys.customers.lists(),
        });
      } else {
        notifications.show({
          title: 'Import Failed',
          message: result.error || 'Error importing CSV file.',
          color: 'red',
        });
      }

      setFile(null);
    } catch (error) {
      notifications.hide('import-progress');
      logger.error('Error importing CSV:', error);
      notifications.show({
        title: 'Import Failed',
        message: 'Error importing CSV file. Please check the file format.',
        color: 'red',
      });
    }
  };

  // CSV export functionality
  const handleExportCSV = () => {
    try {
      const dataToExport =
        filteredCustomers.length > 0 ? filteredCustomers : customers;
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `customers-export-${timestamp}.csv`;

      CustomerService.exportToCSV(dataToExport, filename);

      notifications.show({
        title: 'Export Successful',
        message: `Exported ${dataToExport.length} customers to ${filename}`,
        color: 'green',
      });
    } catch (error) {
      logger.error('Error exporting CSV:', error);
      notifications.show({
        title: 'Export Failed',
        message: 'Error exporting CSV file.',
        color: 'red',
      });
    }
  };

  // CSV export with additional info (numbered columns format)
  const handleExportDetailedCSV = async () => {
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `customers-detailed-${timestamp}.csv`;

      const result = await CustomerService.exportToCSVDetailed(filename, 5);

      if (result.warning) {
        notifications.show({
          title: '⚠️ Export Successful (with warnings)',
          message: result.warning,
          color: 'yellow',
          autoClose: 10000,
        });
      } else {
        notifications.show({
          title: 'Export Successful',
          message:
            'Exported customers with all additional info (Shopee usernames, addresses, phones)',
          color: 'green',
        });
      }
    } catch (error) {
      logger.error('Error exporting detailed CSV:', error);
      notifications.show({
        title: 'Export Failed',
        message: 'Error exporting detailed CSV file.',
        color: 'red',
      });
    }
  };

  // CSV export with duplicate rows format (for analysis)
  const handleExportAnalysisCSV = async () => {
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `customers-analysis-${timestamp}.csv`;

      await CustomerService.exportToCSVDuplicateRows(filename);

      notifications.show({
        title: 'Export Successful',
        message: 'Exported customers in duplicate rows format for analysis',
        color: 'green',
      });
    } catch (error) {
      logger.error('Error exporting analysis CSV:', error);
      notifications.show({
        title: 'Export Failed',
        message: 'Error exporting analysis CSV file.',
        color: 'red',
      });
    }
  };

  // Handle add customer submission
  const handleAddCustomer = async () => {
    const result = getValidatedCustomerData();

    if (!result.isValid || !result.data) {
      notifications.show({
        title: 'Validation Error',
        message: result.errors?.join(', ') || 'Please check the form',
        color: 'red',
      });
      return;
    }

    try {
      await addCustomer(result.data);

      closeModal();

      notifications.show({
        title: '🎉 Customer Added Successfully!',
        message: `${result.data['Customer Name']} has been added to your customer database`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });
    } catch (error) {
      logger.error('Failed to add customer', error);
      notifications.show({
        title: 'Saved locally only',
        message: 'Database not reachable',
        color: 'yellow',
      });
    }
  };

  // Data rendering for grid
  const getData = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;

      if (row >= filteredCustomers.length) {
        return {
          kind: GridCellKind.Text,
          data: '',
          displayData: '',
          allowOverlay: false,
          readonly: true,
        } as GridCell;
      }

      const customer = filteredCustomers[row];
      const column = columns[col];

      let rawValue: unknown = '';
      switch (column.id) {
        case 'date':
          rawValue = customer.Date;
          break;
        case 'customerName':
          rawValue = customer['Customer Name'];
          break;
        case 'phoneNumber':
          rawValue = customer['Phone Number'];
          break;
        case 'address':
          rawValue = customer.Address;
          break;
        case 'facebook':
          rawValue = customer.Facebook;
          break;
        case 'emailAddress':
          rawValue = customer['Email Address'];
          break;
        case 'businessName':
          rawValue = customer['Business Name'];
          break;
        case 'taxNumber':
          rawValue = customer['Tax Number'];
          break;
        case 'businessAddress':
          rawValue = customer['Business Address'];
          break;
        case 'businessContactNumber':
          rawValue = customer['Business Contact Number'];
          break;
        case 'customerStatus':
          rawValue = customer['Customer Status'];
          break;
        default:
          rawValue = '';
      }

      const cellData =
        rawValue === null || rawValue === undefined ? '' : String(rawValue);

      // Make customer name column appear as a clickable link
      if (column.id === 'customerName' && cellData && customer.id) {
        return {
          kind: GridCellKind.Text,
          data: cellData,
          displayData: cellData,
          allowOverlay: false,
          readonly: true,
          contentAlign: 'left',
        } as GridCell;
      }

      return {
        kind: GridCellKind.Text,
        data: cellData,
        displayData: cellData,
        allowOverlay: false,
        readonly: true,
      };
    },
    [filteredCustomers, columns]
  );

  const getRowCount = useCallback(
    () => filteredCustomers.length,
    [filteredCustomers]
  );

  interface DrawHeaderArgs {
    ctx: CanvasRenderingContext2D;
    column: GridColumn;
    rect: { x: number; y: number; width: number; height: number };
    theme: {
      bgHeader: string;
      textHeader: string;
      headerFontStyle: string;
    };
  }

  // Custom header renderer for center alignment
  const drawHeader = useCallback((args: DrawHeaderArgs) => {
    const { ctx, column, rect, theme } = args;

    ctx.fillStyle = theme.bgHeader;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    ctx.fillStyle = theme.textHeader;
    ctx.font = theme.headerFontStyle;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    ctx.fillText(column.title, centerX, centerY);

    return true;
  }, []);

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
          <Group gap="md" style={{ flex: 1 }}>
            <TextInput
              placeholder={'Search customers... (Ctrl+F)'}
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              style={{
                flex: 1,
                minWidth: 300,
              }}
              styles={{
                input: {
                  backgroundColor: '#ffffff',
                  border: '1px solid #dee2e6',
                  '&:focus': {
                    borderColor: '#228be6',
                  },
                },
              }}
              data-ctrlf-target="customers-search-input"
            />
          </Group>

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
            <FileButton
              accept=".csv"
              onChange={(uploadedFile) => setFile(uploadedFile)}
            >
              {(fileButtonProps) => (
                <Button
                  {...fileButtonProps}
                  leftSection={<IconUpload size={16} color="#ffffff" />}
                  styles={operationsActionButtonStyles}
                >
                  {file ? 'Change CSV File' : 'Select CSV File'}
                </Button>
              )}
            </FileButton>
            <Button
              onClick={() => handleImportCSV(file)}
              disabled={!file}
              leftSection={<IconUpload size={16} color="#ffffff" />}
              styles={operationsActionButtonStyles}
            >
              Import CSV
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              color="blue"
              onClick={openModal}
            >
              Add New Customer
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
            rowMarkers="number"
            isDraggable={false}
            onCellClicked={(cell: Item) => {
              const [col, row] = cell;
              const column = columns[col];

              if (
                column?.id === 'customerName' &&
                row < filteredCustomers.length
              ) {
                const now = Date.now();
                const lastClick = lastClickRef.current;

                if (
                  lastClick &&
                  lastClick.cell[0] === col &&
                  lastClick.cell[1] === row &&
                  now - lastClick.time < 500
                ) {
                  const customer = filteredCustomers[row];
                  if (customer?.id) {
                    router.push(
                      `/clothing/operations/customers/${customer.id}`
                    );
                  }
                  lastClickRef.current = null;
                } else {
                  lastClickRef.current = { cell, time: now };
                }
              }
            }}
            experimental={{
              scrollbarWidthOverride: 16,
            }}
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
