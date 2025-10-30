/**
 * Post Template Component
 * Main component for managing social media post templates
 */

'use client';

import { useState, useEffect } from 'react';
import { Stack, TextInput, Box } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { Text, Paper } from '@mantine/core';

interface Product {
  id: string;
  ['Product Code']: string;
  Product?: string;
  ['Age Range']?: string;
}

export function PostTemplateComponent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      setIsLoading(true);
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchProducts();
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
            }}
          >
            <Stack gap="lg" align="center">
              <Text size="xl" fw={700} c="red" style={{ letterSpacing: '1px' }}>
                ONHAND!!!
              </Text>

              <Stack gap="xs" align="center">
                <Text size="lg" fw={600} ta="center">
                  {selectedProduct.Product || selectedProduct['Product Code']}
                </Text>

                <Text size="md" c="dimmed" ta="center">
                  Age Range: {selectedProduct['Age Range'] || 'N/A'}
                </Text>
              </Stack>
            </Stack>
          </Paper>
        </>
      )}
    </Stack>
  );
}
