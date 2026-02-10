import React, { type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProductsPage } from '../ProductsPage';

const mockUseProductsData = vi.fn();

vi.mock('../../hooks/useProductsData', () => ({
  useProductsData: () => mockUseProductsData(),
}));

vi.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="page-layout">{children}</div>
  ),
}));

vi.mock('@/components/ui/TableSkeleton', () => ({
  TableSkeleton: () => <div data-testid="table-skeleton">Loading</div>,
}));

vi.mock('../ProductStatsCards', () => ({
  ProductStatsCards: () => <div>stats-cards</div>,
}));

vi.mock('../ProductsGrid', () => ({
  __esModule: true,
  default: () => <div>products-grid</div>,
  ProductsGrid: () => <div>products-grid</div>,
}));

vi.mock('../ShippingFeeCalculator', () => ({
  __esModule: true,
  default: () => <div>shipping-calculator</div>,
  ShippingFeeCalculator: () => <div>shipping-calculator</div>,
}));

vi.mock('../BundlesTab', () => ({
  __esModule: true,
  default: () => <div>bundles-tab</div>,
  BundlesTab: () => <div>bundles-tab</div>,
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderProductsPage = () => {
  const queryClient = createTestQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <ProductsPage />
      </MantineProvider>
    </QueryClientProvider>
  );
};

describe('ProductsPage', () => {
  beforeEach(() => {
    mockUseProductsData.mockReset();
  });

  it('renders skeleton while loading', () => {
    mockUseProductsData.mockReturnValue({ isLoading: true, statistics: {} });

    renderProductsPage();

    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('stats-cards')).not.toBeInTheDocument();
  });

  it('renders stats and switches tabs between products and shipping calculator', async () => {
    mockUseProductsData.mockReturnValue({
      isLoading: false,
      statistics: { total: 10 },
    });

    renderProductsPage();

    // Wait for dynamic imports to resolve
    await waitFor(() => {
      expect(screen.getByText('products-grid')).toBeVisible();
    });

    expect(screen.getByText('stats-cards')).toBeInTheDocument();
    expect(screen.getByText('shipping-calculator')).not.toBeVisible();

    const shippingTab = screen.getByRole('tab', {
      name: /shipping fee calculator/i,
    });
    fireEvent.click(shippingTab);

    expect(screen.getByText('shipping-calculator')).toBeVisible();
    expect(screen.getByText('products-grid')).not.toBeVisible();
  });
});
