import React from 'react';
import { MantineProvider } from '@mantine/core';
import { cleanup, render } from '@testing-library/react';
import { screen } from '@testing-library/dom';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { InventoryValuationSummary } from '@/lib/accounting/inventoryCogsShared';
import { ProfitLossRoutePage } from '../ProfitLossRoutePage';
import { InventoryCostReview } from '@/modules/clothing/operations/inventory/components/InventoryCostReview';

const valuation: InventoryValuationSummary = {
  complete: false,
  affectedQuantity: 50,
  issues: [
    {
      movementId: 5270,
      productCode: 'PSO-101226',
      date: '2026-10-15',
      quantity: 50,
      direction: 'SALE',
      reason: 'LEGACY_PRODUCT_COST',
    },
  ],
};

const hookState = {
  activeTab: 'list' as string | null,
  valuation: valuation as InventoryValuationSummary | undefined,
};

vi.mock('@/app/clothing/accounting/profit-loss/hooks/useProfitLoss', () => ({
  PROFIT_LOSS_PERIOD_OPTIONS: ['This Month'],
  useProfitLoss: () => ({
    rows: [],
    refresh: vi.fn(),
    filteredRows: [],
    detailRows: [],
    filteredDetailRows: [],
    loadError: null,
    stats: {
      revenueTotal: 0,
      cogsTotal: 0,
      grossProfit: 0,
      expenseTotal: 0,
      netProfit: 0,
      period: 'This Month',
      valuation: hookState.valuation,
    },
    period: 'This Month',
    setPeriod: vi.fn(),
    searchQuery: '',
    setSearchQuery: vi.fn(),
    activeTab: hookState.activeTab,
    setActiveTab: vi.fn(),
    formatCurrency: (value: number) => String(value),
    handleExportCSV: vi.fn(),
    handleExportDetailsCSV: vi.fn(),
    handleDownloadTemplate: vi.fn(),
  }),
}));

vi.mock('@/components/layout/PageLayout', () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock(
  '@/app/clothing/accounting/profit-loss/components/ProfitLossStatsCards',
  () => ({ ProfitLossStatsCards: () => <div>Stats cards</div> })
);
vi.mock(
  '@/app/clothing/accounting/profit-loss/components/ProfitLossTable',
  () => ({ ProfitLossTable: () => <div>P&L table</div> })
);
vi.mock(
  '@/app/clothing/accounting/profit-loss/components/ProfitLossDetailsTable',
  () => ({ ProfitLossDetailsTable: () => <div>Details table</div> })
);
vi.mock(
  '@/app/clothing/accounting/profit-loss/components/ProfitLossBreakdownsPanel',
  () => ({ ProfitLossBreakdownsPanel: () => <div>Breakdowns</div> })
);
vi.mock('@/components/accounting/InventoryCostCorrections', () => ({
  InventoryCostCorrections: () => (
    <button type="button">Dated cost corrections</button>
  ),
}));

beforeAll(() => {
  vi.stubGlobal('React', React);
});
afterEach(() => {
  cleanup();
  hookState.valuation = valuation;
});
afterAll(() => {
  vi.unstubAllGlobals();
});

function renderPage(apiBasePath?: string) {
  return render(
    <MantineProvider>
      <ProfitLossRoutePage apiBasePath={apiBasePath} />
    </MantineProvider>
  );
}

function renderReview(apiBasePath?: string) {
  return render(
    <MantineProvider>
      <InventoryCostReview apiBasePath={apiBasePath} />
    </MantineProvider>
  );
}

describe('ProfitLossRoutePage cost review tab', () => {
  it('keeps the valuation warning out of the main P&L view', () => {
    hookState.activeTab = 'list';
    renderPage();

    expect(screen.getByText('P&L table')).toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /Cost Review/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Review inventory costs' })
    ).toHaveAttribute('href', '/clothing/operations/inventory?tab=cost-review');
    expect(screen.queryByText('Profit Incomplete')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dated cost corrections' })
    ).not.toBeInTheDocument();
  });

  it('shows the expanded valuation review inside the Cost Review tab', () => {
    hookState.activeTab = 'cost-review';
    renderReview();

    expect(screen.queryByText('P&L table')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Profit Incomplete');
    expect(screen.getByRole('table')).toHaveTextContent('PSO-101226');
    expect(
      screen.getByRole('button', { name: 'Confirm zero cost' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Dated cost corrections' })
    ).toBeInTheDocument();
  });

  it('preserves read-only review for general merchandise', () => {
    hookState.activeTab = 'cost-review';
    renderReview('/api/general-merchandise');

    expect(screen.getByRole('table')).toHaveTextContent('PSO-101226');
    expect(
      screen.queryByRole('button', { name: 'Confirm zero cost' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Dated cost corrections' })
    ).not.toBeInTheDocument();
  });

  it('shows completion only when valuation data confirms it', () => {
    hookState.activeTab = 'cost-review';
    hookState.valuation = { complete: true, issues: [], affectedQuantity: 0 };
    renderReview();

    expect(screen.getByRole('alert')).toHaveTextContent('Valuation complete');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('does not claim completion when valuation data is unavailable', () => {
    hookState.activeTab = 'cost-review';
    hookState.valuation = undefined;
    renderReview();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Valuation unavailable'
    );
    expect(screen.queryByText('Valuation complete')).not.toBeInTheDocument();
  });
});
