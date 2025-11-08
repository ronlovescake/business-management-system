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
} from '@mantine/core';
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

export function CheckoutLinksComponent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<CheckoutLinkData[]>([]);

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

  return (
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
              Showing {filteredData.length} of {data.length} checkout links
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
  );
}
