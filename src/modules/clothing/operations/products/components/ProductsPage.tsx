'use client';

/**
 * Products Page Component
 * Main orchestration component for Products module with tab navigation
 */

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader, Center, Stack, Tabs } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { useProductsData } from '../hooks/useProductsData';
import { ProductStatsCards } from './ProductStatsCards';

const TabLoader = () => (
  <Center py="xl">
    <Loader size="md" />
  </Center>
);

const ProductsGrid = dynamic(
  () => import('./ProductsGrid').then((mod) => ({ default: mod.ProductsGrid })),
  { ssr: false, loading: TabLoader }
);

const ShippingFeeCalculator = dynamic(
  () =>
    import('./ShippingFeeCalculator').then((mod) => ({
      default: mod.ShippingFeeCalculator,
    })),
  { ssr: false, loading: TabLoader }
);

const BundlesTab = dynamic(
  () => import('./BundlesTab').then((mod) => ({ default: mod.BundlesTab })),
  { ssr: false, loading: TabLoader }
);

const MixAndMatchTab = dynamic(
  () =>
    import('./MixAndMatchTab').then((mod) => ({
      default: mod.MixAndMatchTab,
    })),
  { ssr: false, loading: TabLoader }
);

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
              <Tabs.Tab value="mix-and-match">Mix & Match</Tabs.Tab>
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

            <Tabs.Panel value="mix-and-match" pt="md">
              <MixAndMatchTab apiBasePath={apiBasePath} />
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
