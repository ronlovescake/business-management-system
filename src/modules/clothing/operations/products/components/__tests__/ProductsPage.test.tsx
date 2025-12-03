import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  ProductsGrid: () => <div>products-grid</div>,
}));

vi.mock('../ShippingFeeCalculator', () => ({
  ShippingFeeCalculator: () => <div>shipping-calculator</div>,
}));

describe('ProductsPage', () => {
  beforeEach(() => {
    mockUseProductsData.mockReset();
  });

  it('renders skeleton while loading', () => {
    mockUseProductsData.mockReturnValue({ isLoading: true, statistics: {} });

    render(<ProductsPage />);

    expect(screen.getByTestId('table-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('stats-cards')).not.toBeInTheDocument();
  });

  it('renders stats and switches tabs between products and shipping calculator', () => {
    mockUseProductsData.mockReturnValue({
      isLoading: false,
      statistics: { total: 10 },
    });

    render(<ProductsPage />);

    expect(screen.getByText('stats-cards')).toBeInTheDocument();
    expect(screen.getByText('products-grid')).toBeInTheDocument();
    expect(screen.queryByText('shipping-calculator')).not.toBeInTheDocument();

    const shippingTab = screen.getByRole('tab', {
      name: /shipping fee calculator/i,
    });
    fireEvent.click(shippingTab);

    expect(screen.getByText('shipping-calculator')).toBeInTheDocument();
    expect(screen.queryByText('products-grid')).not.toBeInTheDocument();
  });
});
