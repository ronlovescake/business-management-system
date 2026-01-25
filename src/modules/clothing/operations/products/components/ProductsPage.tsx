'use client';

/**
 * Products Page Component
 * Main orchestration component for Products module with tab navigation
 */

import React, { useState } from 'react';
import { Stack, Tabs } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { useProductsData } from '../hooks/useProductsData';
import { ProductsGrid } from './ProductsGrid';
import { ShippingFeeCalculator } from './ShippingFeeCalculator';
import { ProductStatsCards } from './ProductStatsCards';
import { BundlesTab } from './BundlesTab';

interface ProductsPageProps {
  apiBasePath?: string;
}

export function ProductsPage({ apiBasePath }: ProductsPageProps) {
  const [activeTab, setActiveTab] = useState<string | null>('products');
  const { isLoading, statistics } = useProductsData(apiBasePath);

  return (
    <PageLayout fluid withPadding>
      {isLoading ? (
        <TableSkeleton rows={12} columns={10} />
      ) : (
        <Stack gap="md">
          {/* Stats cards */}
          <ProductStatsCards statistics={statistics} />

          <Tabs value={activeTab} onChange={setActiveTab}>
            <Tabs.List>
              <Tabs.Tab value="products">Products</Tabs.Tab>
              <Tabs.Tab value="bundles">Bundles</Tabs.Tab>
              <Tabs.Tab value="shipping-calculator">
                Shipping Fee Calculator
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="products" pt="md">
              <ProductsGrid apiBasePath={apiBasePath} />
            </Tabs.Panel>

            <Tabs.Panel value="bundles" pt="md">
              <BundlesTab apiBasePath={apiBasePath} />
            </Tabs.Panel>

            <Tabs.Panel value="shipping-calculator" pt="md">
              <ShippingFeeCalculator apiBasePath={apiBasePath} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      )}
    </PageLayout>
  );
}
