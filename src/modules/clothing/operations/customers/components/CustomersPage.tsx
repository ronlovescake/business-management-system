'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  Title,
  Checkbox,
  ActionIcon,
  Tooltip,
  Center,
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
  IconColumns3,
  IconX,
  IconUsers,
  IconSearchOff,
  IconRefresh,
} from '@tabler/icons-react';
import { GridView } from '@/components/grid';
import { PageLayout } from '@/components/layout/PageLayout';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { throttle } from '@/lib/performance';
import { showNotification } from '@mantine/notifications';
import { useMediaQuery } from '@mantine/hooks';
import { useCustomersData } from '../hooks/useCustomersData';
import { useCustomerForm } from '../hooks/useCustomerForm';
import { useCustomerDuplicateCheck } from '../hooks/useCustomerDuplicateCheck';
import {
  customerColumns,
  defaultCustomerColumnIds,
  useCustomersGrid,
} from '../hooks/useCustomersGrid';
import { useCustomersCSV } from '../hooks/useCustomersCSV';
import { CustomerStatsCards } from './CustomerStatsCards';
import { useCtrlFFocus } from '@/hooks/useCtrlFFocus';

interface CustomersPageProps {
  apiBasePath?: string;
  directoryView?: boolean;
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

/**
 * Customers Page Component
 * Main component for customer management with grid view, search, CSV import, and CRUD operations
 */
export function CustomersPage({
  apiBasePath,
  directoryView = true,
}: CustomersPageProps) {
  const isDesktop = useMediaQuery('(min-width: 48em)');
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

  const [visibleColumnIds, setVisibleColumnIds] = useState<readonly string[]>(
    defaultCustomerColumnIds
  );
  const { columns, getData, getRowCount, drawCell, handleCellClick } =
    useCustomersGrid({ filteredCustomers, visibleColumnIds, directoryView });

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
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading || !gridRef.current) {
      return;
    }

    const updateHeight = () => {
      if (!gridRef.current) {
        return;
      }
      const top = gridRef.current.getBoundingClientRect().top + window.scrollY;
      setGridHeight(
        directoryView
          ? Math.max(280, Math.floor(window.innerHeight - top - 24))
          : Math.max(300, Math.floor(window.innerHeight * 0.85))
      );
    };

    const throttledResize = throttle(updateHeight, 150);

    updateHeight();
    window.addEventListener('resize', throttledResize);
    const observer = new ResizeObserver(throttledResize);
    if (gridRef.current.parentElement) {
      observer.observe(gridRef.current.parentElement);
    }

    return () => {
      window.removeEventListener('resize', throttledResize);
      observer.disconnect();
      throttledResize.cancel();
    };
  }, [directoryView, isLoading]);

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
        <TableSkeleton
          rows={directoryView ? 10 : 15}
          columns={directoryView ? 5 : 11}
        />
      </PageLayout>
    );
  }

  return (
    <PageLayout fluid withPadding>
      <Stack gap="md" style={{ width: '100%', minWidth: 0, letterSpacing: 0 }}>
        {directoryView && (
          <Group gap="sm" align="baseline">
            <Title order={1} size="h3" fw={650}>
              Customers
            </Title>
            <Text size="sm" c="dimmed" role="status" aria-live="polite">
              {searchQuery
                ? `${filteredCustomers.length.toLocaleString()} of ${customers.length.toLocaleString()} customers`
                : `${customers.length.toLocaleString()} customers`}
            </Text>
          </Group>
        )}
        {/* Stats cards */}
        <CustomerStatsCards stats={stats} subtle={directoryView} />

        {/* Search and controls */}
        <Group justify="space-between" align="center" wrap="wrap" gap="sm">
          <TextInput
            placeholder="Search customers"
            aria-label="Search customers"
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{ flex: '1 1 240px', minWidth: 0, maxWidth: 420 }}
            radius={6}
            rightSection={
              searchQuery ? (
                <Tooltip label="Clear search">
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    aria-label="Clear search"
                    onClick={() => handleSearch('')}
                  >
                    <IconX size={14} />
                  </ActionIcon>
                </Tooltip>
              ) : undefined
            }
            data-ctrlf-target="customers-search-input"
          />

          <Group gap="xs" wrap="wrap">
            {directoryView && (
              <Menu
                shadow="sm"
                width={260}
                position="bottom-end"
                closeOnItemClick={false}
              >
                <Menu.Target>
                  <Button
                    variant="default"
                    radius={6}
                    leftSection={<IconColumns3 size={16} />}
                  >
                    Columns
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Visible columns</Menu.Label>
                  {customerColumns.map((column) => (
                    <Checkbox
                      key={column.id}
                      label={column.title}
                      disabled={column.id === 'customerName'}
                      checked={visibleColumnIds.includes(column.id ?? '')}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked;
                        setVisibleColumnIds((current) =>
                          checked
                            ? [...current, column.id ?? '']
                            : current.filter((id) => id !== column.id)
                        );
                      }}
                      size="xs"
                      m="xs"
                    />
                  ))}
                  <Menu.Divider />
                  <Menu.Item
                    leftSection={<IconTable size={16} />}
                    onClick={() =>
                      setVisibleColumnIds(
                        customerColumns.map((column) => column.id ?? '')
                      )
                    }
                  >
                    Show all columns
                  </Menu.Item>
                  <Menu.Item
                    leftSection={<IconRefresh size={16} />}
                    onClick={() =>
                      setVisibleColumnIds(defaultCustomerColumnIds)
                    }
                  >
                    Reset columns
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            )}
            <Menu shadow="md" width={280} position="bottom-end">
              <Menu.Target>
                <Button
                  leftSection={<IconDownload size={16} />}
                  rightSection={<IconChevronDown size={14} />}
                  variant="default"
                  radius={6}
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
                    leftSection={<IconUpload size={16} />}
                    variant="default"
                    radius={6}
                  >
                    {file ? 'Change CSV' : 'Import CSV'}
                  </Button>
                )}
              </FileButton>
              {file && (
                <Button
                  onClick={() => handleImportCSV(file)}
                  leftSection={<IconUpload size={16} />}
                  variant="light"
                  radius={6}
                >
                  Import
                </Button>
              )}
            </Group>

            <Button
              leftSection={<IconPlus size={16} />}
              color="blue"
              radius={6}
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
          ref={gridRef}
          withBorder
          radius={8}
          padding={0}
          style={{
            height: gridHeight,
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            position: 'relative',
            background: '#fff',
            borderColor: '#e2e6ea',
          }}
          className="data-grid-container"
        >
          {filteredCustomers.length === 0 ? (
            <Center h="100%" px="md">
              <Stack align="center" gap="sm">
                {searchQuery ? (
                  <IconSearchOff size={32} color="#868e96" stroke={1.5} />
                ) : (
                  <IconUsers size={32} color="#868e96" stroke={1.5} />
                )}
                <Text fw={600}>
                  {searchQuery ? 'No matching customers' : 'No customers yet'}
                </Text>
                <Button
                  variant="light"
                  radius={6}
                  leftSection={
                    searchQuery ? <IconX size={16} /> : <IconPlus size={16} />
                  }
                  onClick={searchQuery ? () => handleSearch('') : openModal}
                >
                  {searchQuery ? 'Clear search' : 'Add Customer'}
                </Button>
              </Stack>
            </Center>
          ) : (
            <GridView
              getCellContent={getData}
              columns={columns}
              rows={getRowCount()}
              height={gridHeight}
              width={'100%'}
              overscrollX={0}
              smoothScrollX={true}
              smoothScrollY={true}
              rowHeight={directoryView ? 48 : 70}
              headerHeight={directoryView ? 44 : 80}
              freezeColumns={directoryView && isDesktop ? 1 : 0}
              verticalBorder={!directoryView}
              rowMarkers="none"
              isDraggable={false}
              onCellClicked={handleCellClick}
              experimental={{ scrollbarWidthOverride: 16 }}
              drawCell={directoryView ? drawCell : undefined}
              theme={{
                accentColor: '#228be6',
                accentLight: 'rgba(34, 139, 230, 0.1)',
                textDark: '#27313d',
                textMedium: '#495057',
                textLight: '#868e96',
                textBubble: '#ffffff',
                bgIconHeader: '#f8f9fa',
                fgIconHeader: '#495057',
                textHeader: '#59636e',
                textHeaderSelected: '#228be6',
                bgCell: '#ffffff',
                bgCellMedium: '#ffffff',
                bgHeader: '#f6f8fa',
                bgHeaderHasFocus: '#e9ecef',
                bgHeaderHovered: '#e9ecef',
                bgBubble: '#228be6',
                bgBubbleSelected: '#1c7ed6',
                bgSearchResult: '#fff3cd',
                borderColor: '#e9edf1',
                horizontalBorderColor: '#edf0f3',
                drilldownBorder: 'rgba(34, 139, 230, 0.4)',
                linkColor: '#228be6',
                headerFontStyle: directoryView ? '600 12px' : 'bold 17px',
                baseFontStyle: directoryView ? '14px' : '17px',
                editorFontSize: '14px',
                fontFamily:
                  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                cellHorizontalPadding: 16,
                cellVerticalPadding: 8,
              }}
              getCellsForSelection={true}
            />
          )}
        </Card>
        {!directoryView && (
          <Text size="sm" c="dimmed" ta="center">
            Showing {filteredCustomers.length} of {customers.length} customers
          </Text>
        )}
      </Stack>
    </PageLayout>
  );
}
