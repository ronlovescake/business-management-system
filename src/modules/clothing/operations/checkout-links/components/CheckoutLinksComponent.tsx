/**
 * Checkout Links Component
 * Main component for managing payment checkout links with product details
 */

'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Stack,
  Text,
  Group,
  Table,
  ActionIcon,
  Tooltip,
  Anchor,
  Tabs,
  Checkbox,
  Modal,
  TextInput,
  Button,
  NumberInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import { getActionLabel } from '@/lib/accessibility';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';

interface CheckoutLinkData {
  id: string;
  weight: string;
  width: string;
  length: string;
  height: string;
  checkoutLinks: string;
  productPortals: string;
  productNames: string;
}

interface InvoiceData {
  id: string;
  customerName: string;
  actualWeight: string;
  finalWeight: string;
  shopeeCheckoutLinks: string;
  driveFiles: string;
  message: string;
  chat: string;
  tickbox: boolean;
}

interface ItemWeightData {
  id: string;
  itemName: string;
  bulkQuantity: string;
  bulkWeight: string;
  approxWeightPerPiece: string;
  createdAt?: string;
}

interface ItemWeightApiResponse {
  id: string;
  itemName: string;
  bulkQuantity: string;
  bulkWeight: string;
  approxWeightPerPiece: string;
  createdAt: string;
}

type ItemWeightFormValues = {
  itemName: string;
  bulkQuantity: number | '';
  bulkWeight: number | '';
};

function mapItemWeightResponse(item: ItemWeightApiResponse): ItemWeightData {
  return {
    id: item.id,
    itemName: item.itemName,
    bulkQuantity: item.bulkQuantity,
    bulkWeight: item.bulkWeight,
    approxWeightPerPiece: item.approxWeightPerPiece,
    createdAt: item.createdAt,
  };
}

export function CheckoutLinksComponent() {
  const [activeTab, setActiveTab] = useState<string | null>('invoicing');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<CheckoutLinkData[]>([]);
  const [invoiceData, setInvoiceData] = useState<InvoiceData[]>([]);
  const [itemWeightData, setItemWeightData] = useState<ItemWeightData[]>([]);
  const [isItemWeightModalOpen, setIsItemWeightModalOpen] = useState(false);
  const [isItemWeightLoading, setIsItemWeightLoading] = useState(true);
  const [isItemWeightSubmitting, setIsItemWeightSubmitting] = useState(false);

  // Form for adding new item weight
  const itemWeightForm = useForm<ItemWeightFormValues>({
    initialValues: {
      itemName: '',
      bulkQuantity: '',
      bulkWeight: '',
    },
    validate: {
      itemName: (value) =>
        value.trim().length === 0 ? 'Item name is required' : null,
      bulkQuantity: (value) => {
        if (value === '' || value === null) {
          return 'Bulk quantity is required';
        }
        if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
          return 'Must be a positive number';
        }
        return null;
      },
      bulkWeight: (value) => {
        if (value === '' || value === null) {
          return 'Bulk weight is required';
        }
        if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
          return 'Must be a positive number';
        }
        return null;
      },
    },
  });

  // Load data from database on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/api/checkout-links');
        const result = await response.json();

        if (result.data) {
          setData(result.data);
        }
      } catch (error) {
        showNotification({
          title: 'Error',
          message: 'Failed to load checkout links',
          color: 'red',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Load invoices from database on mount
  useEffect(() => {
    const loadInvoices = async () => {
      try {
        const response = await fetch('/api/invoices');
        const result = await response.json();

        if (result.data) {
          setInvoiceData(result.data);
        }
      } catch (error) {
        showNotification({
          title: 'Error',
          message: 'Failed to load invoices',
          color: 'red',
        });
      }
    };

    loadInvoices();
  }, []);

  useEffect(() => {
    const loadItemWeights = async () => {
      try {
        const response = await fetch('/api/item-weights');

        if (!response.ok) {
          throw new Error('Failed to load item weights');
        }

        const result = await response.json();
        const items = Array.isArray(result.data) ? result.data : [];

        setItemWeightData(items.map(mapItemWeightResponse));
      } catch (error) {
        showNotification({
          title: 'Error',
          message:
            error instanceof Error
              ? error.message
              : 'Failed to load item weights',
          color: 'red',
        });
      } finally {
        setIsItemWeightLoading(false);
      }
    };

    loadItemWeights();
  }, []);

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return data;
    }

    const query = searchQuery.toLowerCase();
    return data.filter(
      (item) =>
        item.weight.toLowerCase().includes(query) ||
        item.width.toLowerCase().includes(query) ||
        item.length.toLowerCase().includes(query) ||
        item.height.toLowerCase().includes(query) ||
        item.checkoutLinks?.toLowerCase().includes(query) ||
        item.productPortals?.toLowerCase().includes(query) ||
        item.productNames?.toLowerCase().includes(query)
    );
  }, [data, searchQuery]);

  // Filter invoice data based on search query
  const filteredInvoiceData = useMemo(() => {
    if (!searchQuery.trim()) {
      return invoiceData;
    }

    const query = searchQuery.toLowerCase();
    return invoiceData.filter(
      (item) =>
        item.customerName.toLowerCase().includes(query) ||
        item.actualWeight?.toLowerCase().includes(query) ||
        item.finalWeight?.toLowerCase().includes(query) ||
        item.shopeeCheckoutLinks?.toLowerCase().includes(query) ||
        item.driveFiles?.toLowerCase().includes(query) ||
        item.message?.toLowerCase().includes(query) ||
        item.chat?.toLowerCase().includes(query)
    );
  }, [invoiceData, searchQuery]);

  // Filter item weight data based on search query
  const filteredItemWeightData = useMemo(() => {
    if (!searchQuery.trim()) {
      return itemWeightData;
    }

    const query = searchQuery.toLowerCase();
    return itemWeightData.filter(
      (item) =>
        item.itemName.toLowerCase().includes(query) ||
        item.bulkQuantity.toLowerCase().includes(query) ||
        item.bulkWeight.toLowerCase().includes(query) ||
        item.approxWeightPerPiece.toLowerCase().includes(query)
    );
  }, [itemWeightData, searchQuery]);

  const handleEdit = (item: CheckoutLinkData) => {
    // TODO: Implement edit functionality
    void item;
  };

  const handleDelete = (id: string) => {
    // TODO: Implement delete functionality
    void id;
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      showNotification({
        title: 'Invalid File Type',
        message: 'Please upload a CSV file',
        color: 'red',
      });
      return;
    }

    setIsImporting(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter((line) => line.trim());

        if (lines.length < 2) {
          throw new Error('CSV file is empty or invalid');
        }

        // Parse header
        const headers = lines[0].split(',').map((h) => h.trim().toUpperCase());

        // Validate headers
        const expectedHeaders = [
          'WEIGHT',
          'WIDTH',
          'LENGTH',
          'HEIGHT',
          'CHECKOUT LINKS',
          'PRODUCT PORTALS',
          'PRODUCT NAMES',
        ];

        const hasValidHeaders = expectedHeaders.every((header) =>
          headers.includes(header)
        );

        if (!hasValidHeaders) {
          throw new Error(
            'Invalid CSV format. Expected headers: WEIGHT, WIDTH, LENGTH, HEIGHT, CHECKOUT LINKS, PRODUCT PORTALS, PRODUCT NAMES'
          );
        }

        // Parse data rows
        const parsedData: CheckoutLinkData[] = [];
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];
          const values: string[] = [];
          let currentValue = '';
          let insideQuotes = false;

          // Parse CSV with proper quote handling
          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
              insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
              values.push(currentValue.trim());
              currentValue = '';
            } else {
              currentValue += char;
            }
          }
          values.push(currentValue.trim()); // Push last value

          if (values.length >= 7) {
            const [
              weight,
              width,
              length,
              height,
              checkoutLinks,
              productPortals,
              productNames,
            ] = values;

            parsedData.push({
              id: `${weight}-${width}-${length}-${height}-${Date.now()}-${i}`,
              weight: weight || '',
              width: width || '',
              length: length || '',
              height: height || '',
              checkoutLinks: checkoutLinks || '',
              productPortals: productPortals || '',
              productNames: productNames || '',
            });
          }
        }

        setData(parsedData);

        // Save to database
        fetch('/api/checkout-links', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: parsedData.map((item) => ({
              weight: item.weight || '',
              width: item.width || '',
              length: item.length || '',
              height: item.height || '',
              checkoutLinks: item.checkoutLinks || null,
              productPortals: item.productPortals || null,
              productNames: item.productNames || null,
            })),
          }),
        })
          .then((response) => response.json())
          .then((result) => {
            if (result.success) {
              showNotification({
                title: 'Import Successful',
                message:
                  result.message ||
                  `Successfully imported ${parsedData.length} checkout links`,
                color: 'green',
              });
            } else {
              throw new Error(result.error || 'Failed to save to database');
            }
          })
          .catch((error) => {
            showNotification({
              title: 'Database Error',
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to save to database',
              color: 'orange',
            });
          })
          .finally(() => {
            setIsImporting(false);
          });
      } catch (error) {
        showNotification({
          title: 'Import Failed',
          message:
            error instanceof Error ? error.message : 'Failed to parse CSV file',
          color: 'red',
        });
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      showNotification({
        title: 'Import Failed',
        message: 'Failed to read file',
        color: 'red',
      });
      setIsImporting(false);
    };

    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    // TODO: Implement CSV export functionality
  };

  const handleSyncGoogleDrive = async () => {
    setIsSyncing(true);

    try {
      const response = await fetch('/api/google-drive/sync-files');
      const result = await response.json();

      if (!result.success) {
        // Check if it's a configuration error
        if (result.setupInstructions) {
          showNotification({
            title: 'Google Drive Not Configured',
            message:
              result.error ||
              'Please configure Google Drive credentials in your environment variables. Check .env.example for setup instructions.',
            color: 'yellow',
            autoClose: 10000,
          });
          return;
        }

        if (result.instructions) {
          showNotification({
            title: 'Package Not Installed',
            message: result.instructions,
            color: 'yellow',
            autoClose: 10000,
          });
          return;
        }

        throw new Error(result.error || 'Failed to sync Google Drive files');
      }

      // Transform the synced data to match InvoiceData interface
      const syncedData: InvoiceData[] = result.data.map(
        (item: {
          customerName: string;
          driveFiles: string;
          fileId: string;
          fileName: string;
        }) => ({
          id: item.fileId || `temp-${Date.now()}-${Math.random()}`,
          customerName: item.customerName,
          actualWeight: '', // Empty by default - user can fill in
          finalWeight: '', // Empty by default - user can fill in
          shopeeCheckoutLinks: '', // Empty by default - user can fill in
          driveFiles: item.driveFiles,
          message: '', // Empty by default - user can fill in
          chat: '', // Empty by default - user can fill in
          tickbox: false,
        })
      );

      // Save to database (overwrites existing data)
      const saveResponse = await fetch('/api/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoices: syncedData }),
      });

      const saveResult = await saveResponse.json();

      if (!saveResponse.ok || !saveResult.success) {
        throw new Error(
          saveResult.error || 'Failed to save invoices to database'
        );
      }

      // Update state with the saved data from database
      setInvoiceData(saveResult.data);

      showNotification({
        title: 'Sync Successful',
        message: `Successfully synced and saved ${syncedData.length} files from Google Drive`,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Sync Failed',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to sync Google Drive files',
        color: 'red',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddItemWeight = async (values: ItemWeightFormValues) => {
    if (
      typeof values.bulkQuantity !== 'number' ||
      typeof values.bulkWeight !== 'number'
    ) {
      showNotification({
        title: 'Invalid input',
        message: 'Bulk quantity and weight must be valid numbers',
        color: 'red',
      });
      return;
    }

    setIsItemWeightSubmitting(true);

    try {
      const response = await fetch('/api/item-weights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemName: values.itemName.trim(),
          bulkQuantity: values.bulkQuantity,
          bulkWeight: values.bulkWeight,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save item weight');
      }

      const result = await response.json();
      const createdItem = Array.isArray(result.data)
        ? result.data[0]
        : result.data;

      if (!createdItem) {
        throw new Error('Invalid response from server');
      }

      setItemWeightData((prev) => [
        mapItemWeightResponse(createdItem as ItemWeightApiResponse),
        ...prev,
      ]);

      showNotification({
        title: 'Success',
        message: 'Item weight added successfully',
        color: 'green',
      });

      setIsItemWeightModalOpen(false);
      itemWeightForm.reset();
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error ? error.message : 'Failed to save item weight',
        color: 'red',
      });
    } finally {
      setIsItemWeightSubmitting(false);
    }
  };

  return (
    <Stack gap="md">
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="invoicing">Invoicing</Tabs.Tab>
          <Tabs.Tab value="item-weight">Item Weight</Tabs.Tab>
          <Tabs.Tab value="checkout-links">Checkout Link</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="invoicing" pt="md">
          <Stack gap="md">
            <StandardTableControls
              searchPlaceholder="Search invoicing records..."
              onSearch={setSearchQuery}
              onImport={() => {
                // TODO: Implement import functionality
              }}
              onExport={() => {
                // TODO: Implement export functionality
              }}
              onAddNew={handleSyncGoogleDrive}
              addNewLabel="Retrieve Google Drive Invoices"
              isImporting={isSyncing}
            />

            <StandardTableContainer
              summary={
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Showing {filteredInvoiceData.length} of {invoiceData.length}{' '}
                    invoicing records
                  </Text>
                </Group>
              }
            >
              <StandardDataTable
                headers={[
                  'CUSTOMER NAME',
                  'ACTUAL WEIGHT',
                  'FINAL WEIGHT',
                  'SHOPEE CHECKOUT LINKS',
                  'DRIVE FILES',
                  'MESSAGE',
                  'CHAT',
                  'TICKBOX',
                  'ACTION',
                ]}
                emptyState="No invoicing records found. Click 'Add New' to get started."
                colSpan={9}
              >
                {filteredInvoiceData.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {row.customerName}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {row.actualWeight}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {row.finalWeight}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {row.shopeeCheckoutLinks ? (
                        <Anchor
                          href={
                            row.shopeeCheckoutLinks.startsWith('http')
                              ? row.shopeeCheckoutLinks
                              : `https://${row.shopeeCheckoutLinks}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          lineClamp={2}
                        >
                          {row.shopeeCheckoutLinks}
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {row.driveFiles ? (
                        <Anchor
                          href={
                            row.driveFiles.startsWith('http')
                              ? row.driveFiles
                              : `https://${row.driveFiles}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          lineClamp={2}
                        >
                          {row.driveFiles}
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057" lineClamp={2}>
                        {row.message || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {row.chat ? (
                        <Anchor
                          href={
                            row.chat.startsWith('http')
                              ? row.chat
                              : `https://${row.chat}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          lineClamp={2}
                        >
                          Chat Link
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Checkbox
                        checked={row.tickbox}
                        onChange={(event) => {
                          const newData = invoiceData.map((item) =>
                            item.id === row.id
                              ? {
                                  ...item,
                                  tickbox: event.currentTarget.checked,
                                }
                              : item
                          );
                          setInvoiceData(newData);
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="center">
                        <Tooltip label="Edit">
                          <ActionIcon
                            color="blue"
                            variant="light"
                            size="sm"
                            onClick={() => {
                              // TODO: Implement edit functionality
                            }}
                            {...getActionLabel(
                              'Edit',
                              'invoice record',
                              row.customerName
                            )}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            color="red"
                            variant="light"
                            size="sm"
                            onClick={() => {
                              // TODO: Implement delete functionality
                            }}
                            {...getActionLabel(
                              'Delete',
                              'invoice record',
                              row.customerName
                            )}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </StandardDataTable>
            </StandardTableContainer>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="item-weight" pt="md">
          <Stack gap="md">
            <StandardTableControls
              searchPlaceholder="Search item weights..."
              onSearch={setSearchQuery}
              onImport={() => {
                // TODO: Implement import functionality
              }}
              onExport={() => {
                // TODO: Implement export functionality
              }}
              onAddNew={() => setIsItemWeightModalOpen(true)}
              isImporting={false}
            />

            <StandardTableContainer
              summary={
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Showing {filteredItemWeightData.length} of{' '}
                    {itemWeightData.length} item weights
                  </Text>
                </Group>
              }
            >
              <StandardDataTable
                headers={[
                  'ITEM NAME',
                  'BULK QUANTITY',
                  'BULK WEIGHT',
                  'APROX. WEIGHT PER PIECE',
                  'ACTION',
                ]}
                emptyState={
                  isItemWeightLoading
                    ? 'Loading item weights...'
                    : searchQuery
                      ? 'No item weights match your search.'
                      : "No item weights found. Click 'Add New' to get started."
                }
                colSpan={5}
              >
                {filteredItemWeightData.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td>
                      <Text size="sm" c="#495057">
                        {row.itemName}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {row.bulkQuantity}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {row.bulkWeight}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {row.approxWeightPerPiece}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="center">
                        <Tooltip label="Edit">
                          <ActionIcon
                            color="blue"
                            variant="light"
                            size="sm"
                            onClick={() => {
                              // TODO: Implement edit functionality
                            }}
                            {...getActionLabel(
                              'Edit',
                              'item weight',
                              row.itemName
                            )}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            color="red"
                            variant="light"
                            size="sm"
                            onClick={() => {
                              // TODO: Implement delete functionality
                            }}
                            {...getActionLabel(
                              'Delete',
                              'item weight',
                              row.itemName
                            )}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </StandardDataTable>
            </StandardTableContainer>
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="checkout-links" pt="md">
          <Stack gap="md">
            <StandardTableControls
              searchPlaceholder="Search checkout links..."
              onSearch={setSearchQuery}
              onImport={handleImportCSV}
              onExport={handleExportCSV}
              onAddNew={() => {
                // TODO: Implement add new functionality
              }}
              isImporting={isImporting}
            />

            <StandardTableContainer
              summary={
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Showing {filteredData.length} of {data.length} checkout
                    links
                  </Text>
                </Group>
              }
            >
              <StandardDataTable
                headers={[
                  'WEIGHT',
                  'WIDTH',
                  'LENGTH',
                  'HEIGHT',
                  'CHECKOUT LINKS',
                  'PRODUCT PORTALS',
                  'PRODUCT NAMES',
                  'ACTION',
                ]}
                emptyState={
                  isLoading
                    ? 'Loading checkout links...'
                    : searchQuery
                      ? 'No checkout links match your search.'
                      : "No checkout links found. Click 'Import' to upload a CSV file or 'Add New' to get started."
                }
                colSpan={8}
              >
                {filteredData.map((row) => (
                  <Table.Tr key={row.id}>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {row.weight}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {row.width}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {row.length}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'center' }}>
                      <Text size="sm" c="#495057">
                        {row.height}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {row.checkoutLinks ? (
                        <Anchor
                          href={
                            row.checkoutLinks.startsWith('http')
                              ? row.checkoutLinks
                              : `https://${row.checkoutLinks}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          lineClamp={2}
                        >
                          {row.checkoutLinks}
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      {row.productPortals ? (
                        <Anchor
                          href={
                            row.productPortals.startsWith('http')
                              ? row.productPortals
                              : `https://${row.productPortals}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          lineClamp={2}
                        >
                          {row.productPortals}
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="#495057" lineClamp={2}>
                        {row.productNames || '-'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" justify="center">
                        <Tooltip label="Edit">
                          <ActionIcon
                            color="blue"
                            variant="light"
                            size="sm"
                            onClick={() => handleEdit(row)}
                            {...getActionLabel(
                              'Edit',
                              'checkout link',
                              row.productNames || 'Unknown'
                            )}
                          >
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Delete">
                          <ActionIcon
                            color="red"
                            variant="light"
                            size="sm"
                            onClick={() => handleDelete(row.id)}
                            {...getActionLabel(
                              'Delete',
                              'checkout link',
                              row.productNames || 'Unknown'
                            )}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </StandardDataTable>
            </StandardTableContainer>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Add Item Weight Modal */}
      <Modal
        opened={isItemWeightModalOpen}
        onClose={() => {
          setIsItemWeightModalOpen(false);
          itemWeightForm.reset();
        }}
        title="Add New Item Weight"
        size="md"
      >
        <form onSubmit={itemWeightForm.onSubmit(handleAddItemWeight)}>
          <Stack gap="md">
            <TextInput
              label="Item Name"
              placeholder="Enter item name"
              required
              disabled={isItemWeightSubmitting}
              {...itemWeightForm.getInputProps('itemName')}
            />

            <NumberInput
              label="Bulk Quantity"
              placeholder="Enter bulk quantity"
              required
              min={0}
              decimalScale={2}
              disabled={isItemWeightSubmitting}
              {...itemWeightForm.getInputProps('bulkQuantity')}
            />

            <NumberInput
              label="Bulk Weight"
              placeholder="Enter bulk weight"
              required
              min={0}
              decimalScale={2}
              disabled={isItemWeightSubmitting}
              {...itemWeightForm.getInputProps('bulkWeight')}
            />

            <Text size="sm" c="dimmed">
              Approximate weight per piece will be calculated automatically.
            </Text>

            <Group justify="flex-end" mt="md">
              <Button
                variant="subtle"
                type="button"
                onClick={() => {
                  setIsItemWeightModalOpen(false);
                  itemWeightForm.reset();
                }}
                disabled={isItemWeightSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isItemWeightSubmitting}>
                Add Item Weight
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Stack>
  );
}
