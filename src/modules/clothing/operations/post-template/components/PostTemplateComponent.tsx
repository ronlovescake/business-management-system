/**
 * Post Template Component
 * Main component for managing social media post templates
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Stack, Select, ActionIcon } from '@mantine/core';
import { IconCopy } from '@tabler/icons-react';
import { Text, Paper } from '@mantine/core';
import { showNotification } from '@mantine/notifications';

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

const normalizeProductCode = (code: Product['Product Code']) => {
  if (typeof code !== 'string') {
    return null;
  }

  const trimmed = code.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function PostTemplateComponent() {
  const [selectedProductCode, setSelectedProductCode] = useState<string | null>(
    null
  );
  const [products, setProducts] = useState<Product[]>([]);
  const [prices, setPrices] = useState<Price[]>([]);

  const productOptions = useMemo(
    () =>
      // Ensure Mantine Select receives only normalized string values
      Array.from(
        new Set(
          products
            .map((product) => normalizeProductCode(product['Product Code']))
            .filter((code): code is string => Boolean(code))
        )
      ).map((code) => ({
        value: code,
        label: code,
      })),
    [products]
  );

  useEffect(() => {
    async function fetchData() {
      try {
        const [productsRes, pricesRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/prices'),
        ]);
        const [productsData, pricesData] = await Promise.all([
          productsRes.json(),
          pricesRes.json(),
        ]);
        const validProducts = Array.isArray(productsData) ? productsData : [];
        const validPrices = Array.isArray(pricesData) ? pricesData : [];

        setProducts(validProducts);
        setPrices(validPrices);
      } catch {
        setProducts([]);
        setPrices([]);
      }
    }
    fetchData();
  }, []);

  // Find selected product based on product code
  const selectedProduct =
    products.find(
      (product) =>
        normalizeProductCode(product['Product Code']) === selectedProductCode
    ) || null;

  // Find all matching prices for selected product (multiple price tiers)
  const matchingPrices = selectedProduct
    ? prices
        .filter(
          (price) =>
            normalizeProductCode(price['Product Code']) === selectedProductCode
        )
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

${selectedProduct['Product Code']}

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
      showNotification({
        title: 'Success',
        message: 'Canvas content copied to clipboard!',
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Error',
        message: 'Failed to copy to clipboard',
        color: 'red',
      });
    }
  };

  return (
    <Stack gap="md">
      <Select
        placeholder="Select a product..."
        data={productOptions}
        value={selectedProductCode}
        onChange={(value) => setSelectedProductCode(value)}
        searchable
        clearable
        size="md"
        limit={1000}
        maxDropdownHeight={400}
        styles={{
          input: {
            '&:focus': {
              borderColor: 'var(--mantine-color-blue-6)',
            },
          },
        }}
        nothingFoundMessage="No products found"
      />

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
                  {selectedProduct['Product Code']}
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
