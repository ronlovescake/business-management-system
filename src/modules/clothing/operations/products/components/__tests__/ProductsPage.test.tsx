import React, { type ReactNode } from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/dom';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ProductsPage } from '../ProductsPage';
import { ProductsGridControls } from '../ProductsGridControls';
import type { ProductStatistics } from '../../types/product.types';

const auth = vi.hoisted(() => ({ useSession: vi.fn() }));
vi.mock('next-auth/react', () => auth);
beforeEach(() => {
  vi.stubGlobal('React', React);
  auth.useSession.mockReturnValue({ data: { user: { role: 'ADMIN' } } });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

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
  ProductStatsCards: ({ statistics }: { statistics: ProductStatistics }) => (
    <div data-testid="stats-cards">
      {statistics.total}:{statistics.totalValue}
    </div>
  ),
}));

vi.mock('../ProductsGrid', () => {
  const Grid = ({
    searchQuery,
    onStatisticsChange,
  }: {
    searchQuery?: string;
    onStatisticsChange?: (statistics: ProductStatistics) => void;
  }) => (
    <div>
      <div>products-grid</div>
      <div data-testid="grid-search">{searchQuery}</div>
      <button
        onClick={() =>
          onStatisticsChange?.({
            total: 1,
            totalValue: 600,
            avgValue: 600,
            totalProfit: 370,
            grandTotal: 200,
            cogs: 230,
            forwardersFee: 20,
            lalamove: 4,
            packagingCost: 6,
            totalQuantity: 20,
          })
        }
      >
        update filtered stats
      </button>
    </div>
  );
  return { __esModule: true, default: Grid, ProductsGrid: Grid };
});

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

vi.mock('../MixAndMatchTab', () => ({
  __esModule: true,
  default: () => <div>mix-and-match-tab</div>,
  MixAndMatchTab: () => <div>mix-and-match-tab</div>,
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
    expect(screen.queryByTestId('stats-cards')).not.toBeInTheDocument();
  });

  it('renders stats and switches tabs between products, mix & match, and shipping calculator', async () => {
    mockUseProductsData.mockReturnValue({
      isLoading: false,
      statistics: { total: 10 },
    });

    renderProductsPage();

    // Wait for dynamic imports to resolve
    await waitFor(() => {
      expect(screen.getByText('products-grid')).toBeVisible();
    });

    expect(screen.getByTestId('stats-cards')).toBeInTheDocument();
    expect(screen.getByText('shipping-calculator')).not.toBeVisible();

    const mixAndMatchTab = screen.getByRole('tab', {
      name: /mix & match/i,
    });
    fireEvent.click(mixAndMatchTab);

    expect(screen.getByText('mix-and-match-tab')).toBeVisible();
    expect(screen.getByText('products-grid')).not.toBeVisible();

    const shippingTab = screen.getByRole('tab', {
      name: /shipping fee calculator/i,
    });
    fireEvent.click(shippingTab);

    expect(screen.getByText('shipping-calculator')).toBeVisible();
    expect(screen.getByText('products-grid')).not.toBeVisible();
  });

  it('shares search and grid-filtered draft statistics with the top cards', async () => {
    const filteredStatistics: ProductStatistics = {
      total: 2,
      totalValue: 300,
      avgValue: 150,
      totalProfit: 80,
      grandTotal: 160,
      cogs: 220,
      forwardersFee: 10,
      lalamove: 20,
      packagingCost: 30,
      totalQuantity: 5,
    };
    const handleSearch = vi.fn();
    mockUseProductsData.mockReturnValue({
      isLoading: false,
      statistics: filteredStatistics,
      searchQuery: 'P-2',
      debouncedSearch: 'P-2',
      handleSearch,
    });

    renderProductsPage();

    await waitFor(() =>
      expect(screen.getByTestId('grid-search')).toHaveTextContent('P-2')
    );
    expect(screen.getByTestId('stats-cards')).toHaveTextContent('2:300');
    fireEvent.click(
      screen.getByRole('button', { name: 'update filtered stats' })
    );
    expect(screen.getByTestId('stats-cards')).toHaveTextContent('1:600');
  });
});

describe('product accounting controls', () => {
  it.each(['USER', 'ADMIN', 'SUPER_ADMIN'])(
    'shows financial actions only to authorized clothing role %s',
    (role) => {
      auth.useSession.mockReturnValue({ data: { user: { role } } });
      render(
        <MantineProvider>
          <ProductsGridControls
            searchQuery=""
            onSearchChange={vi.fn()}
            isEditMode={false}
            onToggleEditMode={vi.fn()}
            onAddProduct={vi.fn()}
            selectedShipmentCode="SHIP-1"
            selectedProductCode="P-1"
            onTransitBuildUp={vi.fn()}
            onTransitReclass={vi.fn()}
          />
        </MantineProvider>
      );
      expect(screen.getByRole('button', { name: 'Add Product' })).toBeVisible();
      const postingButton = screen.queryByRole('button', {
        name: 'Transit Build-Up',
      });
      if (role === 'USER') {
        expect(postingButton).toBeNull();
      } else {
        expect(postingButton).toBeVisible();
      }
    }
  );
});
