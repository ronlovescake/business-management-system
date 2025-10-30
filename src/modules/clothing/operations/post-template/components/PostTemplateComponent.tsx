/**
 * Post Template Component
 * Main component for managing social media post templates
 */

'use client';

import { useState, useEffect } from 'react';
import { Stack, TextInput, Box, ActionIcon } from '@mantine/core';
import { IconSearch, IconCopy } from '@tabler/icons-react';
import { Text, Paper } from '@mantine/core';
import { notifications } from '@mantine/notifications';

interface Product {
  id: string;
  ['Product Code']: string;
  Product?: string;
  ['Age Range']?: string;
  ['Shipment Status']?: string;
}

interface Price {
  id: number;
  ['Product Code']: string;
  ['Lower Limit']: number;
  ['Upper Limit']: number;
  Prices: number;
  ['Price Adjustment']: number;
}

export function PostTemplateComponent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [productsRes, pricesRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/prices'),
        ]);
        const [productsData, pricesData] = await Promise.all([
          productsRes.json(),
          pricesRes.json(),
        ]);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setPrices(Array.isArray(pricesData) ? pricesData : []);
      } catch {
        setProducts([]);
        setPrices([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = searchQuery.trim()
    ? products.filter((p) =>
        (p['Product Code'] || '')
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      )
    : [];

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product['Product Code'] || '');
  };

  // Find all matching prices for selected product (multiple price tiers)
  const matchingPrices = selectedProduct
    ? prices
        .filter((p) => p['Product Code'] === selectedProduct['Product Code'])
        .sort((a, b) => b['Lower Limit'] - a['Lower Limit']) // Sort by lower limit descending
    : [];

  // Determine "Arrives In" text based on Shipment Status
  const getArrivesInText = () => {
    if (!selectedProduct) {
      return '3-4 weeks from posting date';
    }

    const shipmentStatus = selectedProduct['Shipment Status'];
    const onhandStatuses = ['For Pickup', 'Sorting', 'Delivered'];

    if (shipmentStatus && onhandStatuses.includes(shipmentStatus)) {
      return 'ONHAND!!!';
    }

    return '3-4 weeks from posting date';
  };

  // Determine header text based on Shipment Status
  const getHeaderText = () => {
    if (!selectedProduct) {
      return 'OPEN FOR RESERVATION';
    }

    const shipmentStatus = selectedProduct['Shipment Status'];
    const onhandStatuses = ['For Pickup', 'Sorting', 'Delivered'];

    if (shipmentStatus && onhandStatuses.includes(shipmentStatus)) {
      return 'ONHAND!!!';
    }

    return 'OPEN FOR RESERVATION';
  };

  const handleCopyCanvas = async () => {
    if (!selectedProduct) {
      return;
    }

    // Build the text content to copy
    const priceLines = matchingPrices
      .map(
        (price) =>
          `₱${price.Prices.toFixed(2)} / pc [Minimum Order: ${price['Lower Limit']} pc]`
      )
      .join('\n');

    const arrivesInText = getArrivesInText();
    const headerText = getHeaderText();

    const canvasText = `${headerText}

${selectedProduct.Product || selectedProduct['Product Code']}

Age Range: ${selectedProduct['Age Range'] || 'N/A'}

${priceLines}

Arrives In: ${arrivesInText}

"Please be aware that the specified 'age range', such as 0-24 months, may not include all subcategories (0-3, 3-6, 6-9, 9-12, 12-18, and 18-24 months). It's common for one or more of these specific size ranges to be missing from the assortment.

Therefore, we refer to these as 'broken sizes.'

First-time buyers must provide the following details:
1. Shopee Delivery Name
2. Contact Number
3. Shipping Address
4. Email Address`;

    try {
      await navigator.clipboard.writeText(canvasText);
      notifications.show({
        title: 'Success',
        message: 'Canvas content copied to clipboard!',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to copy to clipboard',
        color: 'red',
      });
    }
  };

  return (
    <Stack gap="md">
      <TextInput
        placeholder="Search product codes..."
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(event) => {
          setSearchQuery(event.currentTarget.value);
          setSelectedProduct(null);
        }}
        size="md"
        styles={{
          input: {
            '&:focus': {
              borderColor: 'var(--mantine-color-blue-6)',
            },
          },
        }}
      />
      {isLoading ? (
        <Text size="sm" c="dimmed">
          Loading products...
        </Text>
      ) : filtered.length > 0 && !selectedProduct ? (
        <Paper withBorder p="sm">
          <Text size="sm" fw={500} mb="xs">
            Matches:
          </Text>
          <Stack gap={2}>
            {filtered.map((p) => (
              <Box
                key={p.id}
                onClick={() => handleSelectProduct(p)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f1f3f5';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Text size="sm" c="#495057">
                  {p['Product Code']}
                </Text>
              </Box>
            ))}
          </Stack>
        </Paper>
      ) : searchQuery.trim() && !selectedProduct ? (
        <Text size="sm" c="dimmed">
          No matches found.
        </Text>
      ) : null}

      {selectedProduct && (
        <>
          <Paper withBorder p="md" bg="#f8f9fa">
            <Text size="sm" fw={500} mb="xs">
              Selected Product:
            </Text>
            <Text size="md" fw={600} c="blue">
              {selectedProduct['Product Code']}
            </Text>
          </Paper>

          <Paper
            withBorder
            style={{
              backgroundColor: '#ffffff',
              minHeight: '500px',
              width: '100%',
              padding: '40px',
              position: 'relative',
            }}
          >
            {/* Copy Button */}
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={handleCopyCanvas}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
              }}
              title="Copy canvas content"
            >
              <IconCopy size={20} />
            </ActionIcon>

            <Stack gap="lg" align="center">
              <Text size="xl" fw={700} c="red" style={{ letterSpacing: '1px' }}>
                {getHeaderText()}
              </Text>

              <Stack gap="xs" align="center">
                <Text size="lg" fw={600} ta="center">
                  {selectedProduct.Product || selectedProduct['Product Code']}
                </Text>

                <Text size="md" c="dimmed" ta="center">
                  Age Range: {selectedProduct['Age Range'] || 'N/A'}
                </Text>

                {matchingPrices.length > 0 && (
                  <Stack gap="xs" mt="md" align="center">
                    {matchingPrices.map((price) => (
                      <Text key={price.id} size="lg" fw={600} ta="center">
                        ₱{price.Prices.toFixed(2)} / pc [Minimum Order:{' '}
                        {price['Lower Limit']} pc]
                      </Text>
                    ))}
                  </Stack>
                )}

                {/* Arrives In Section */}
                <Stack
                  gap="md"
                  mt="xl"
                  align="flex-start"
                  style={{ width: '100%' }}
                >
                  <Text size="md" fw={600}>
                    Arrives In: {getArrivesInText()}
                  </Text>

                  <Text size="sm" style={{ lineHeight: 1.6 }}>
                    &ldquo;Please be aware that the specified &lsquo;age
                    range&rsquo;, such as 0-24 months, may not include all
                    subcategories (0-3, 3-6, 6-9, 9-12, 12-18, and 18-24
                    months). It&rsquo;s common for one or more of these specific
                    size ranges to be missing from the assortment.
                  </Text>

                  <Text size="sm" style={{ lineHeight: 1.6 }}>
                    Therefore, we refer to these as &lsquo;broken sizes.&rsquo;
                  </Text>

                  <Text size="md" fw={600} mt="md">
                    First-time buyers must provide the following details:
                  </Text>

                  <Stack gap="xs" style={{ paddingLeft: '20px' }}>
                    <Text size="sm">1. Shopee Delivery Name</Text>
                    <Text size="sm">2. Contact Number</Text>
                    <Text size="sm">3. Shipping Address</Text>
                    <Text size="sm">4. Email Address</Text>
                  </Stack>
                </Stack>
              </Stack>
            </Stack>
          </Paper>
        </>
      )}
    </Stack>
  );
}
