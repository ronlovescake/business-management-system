import React from 'react';
import { MantineProvider } from '@mantine/core';
import { cleanup, render } from '@testing-library/react';
import { fireEvent, screen } from '@testing-library/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { InventoryValuationNotice } from '../InventoryValuationNotice';
import type { InventoryValuationSummary } from '@/lib/accounting/inventoryCogsShared';

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

afterEach(() => cleanup());

describe('InventoryValuationNotice', () => {
  it('keeps the warning visible without expanding the exception table', () => {
    render(
      <MantineProvider>
        <InventoryValuationNotice valuation={valuation} />
      </MantineProvider>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Profit Incomplete');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '50 units in 1 movement'
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Review cost details' })
    ).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands and collapses details while preserving permitted review actions', () => {
    render(
      <MantineProvider>
        <InventoryValuationNotice valuation={valuation} canConfirm />
      </MantineProvider>
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Review cost details' })
    );
    expect(screen.getByRole('table')).toHaveTextContent('PSO-101226');
    expect(screen.getByRole('table')).toHaveTextContent(
      'Current product cost used; snapshot missing'
    );
    expect(
      screen.getByRole('button', { name: 'Confirm zero cost' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide cost details' })
    ).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Hide cost details' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('does not show a warning for complete valuations', () => {
    render(
      <MantineProvider>
        <InventoryValuationNotice
          valuation={{
            ...valuation,
            complete: true,
            issues: [],
            affectedQuantity: 0,
          }}
        />
      </MantineProvider>
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
