import React from 'react';
import { render } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { screen } from '@testing-library/dom';
import { describe, expect, it } from 'vitest';
import { ProductStatsCards } from '../ProductStatsCards';
import type { ProductStatistics } from '../../types/product.types';

describe('ProductStatsCards', () => {
  it('shows filtered product costs, sales, profit and quantity metrics', () => {
    const statistics: ProductStatistics = {
      total: 3,
      totalValue: 12000,
      avgValue: 4000,
      totalProfit: 2500,
      grandTotal: 7000,
      cogs: 9500,
      forwardersFee: 1000,
      lalamove: 500,
      packagingCost: 250,
      totalQuantity: 42,
    };

    render(
      <MantineProvider>
        <ProductStatsCards statistics={statistics} />
      </MantineProvider>
    );

    for (const label of [
      'Total Products',
      'Grand Total',
      'Projected Sales',
      'Projected Profit',
      'COGS',
      "Forwarder's Fee",
      'Lalamove',
      'Packaging Cost',
      'Total Quantity',
      'Average Projected Sales',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    const cardsRow = screen.getByTestId('product-stat-cards-row');
    expect(cardsRow).toHaveStyle({ display: 'flex', flexWrap: 'nowrap' });
    expect(cardsRow.children).toHaveLength(10);
    expect(screen.getByText('₱12,000')).toBeInTheDocument();
    expect(screen.getByText('₱9,500')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(
      screen.queryByText(
        /COGS includes Grand Total, Forwarder's Fee, Lalamove and Packaging Cost/
      )
    ).not.toBeInTheDocument();
  });
});
