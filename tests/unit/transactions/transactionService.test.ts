import { describe, it, expect } from 'vitest';
import { TransactionService } from '@/modules/clothing/operations/transactions/services/TransactionService';
import type {
  PriceTier,
  TransactionData,
} from '@/modules/clothing/operations/transactions/types/transaction.types';

const tiers: PriceTier[] = [
  {
    'Product Code': 'SKU-1',
    'Lower Limit': 1,
    'Upper Limit': 10,
    Prices: 250,
  },
  {
    'Product Code': 'SKU-1',
    'Lower Limit': 11,
    'Upper Limit': 100,
    Prices: 225,
  },
];

describe('TransactionService', () => {
  it('calculates unit price using tier price minus discount', () => {
    const unitPrice = TransactionService.calculateUnitPrice(
      'SKU-1',
      5,
      10,
      tiers
    );
    expect(unitPrice).toBe(240);
  });

  it('returns zero when quantity is outside every tier', () => {
    const unitPrice = TransactionService.calculateUnitPrice(
      'SKU-1',
      500,
      0,
      tiers
    );
    expect(unitPrice).toBe(0);
  });

  it('syncs transactions with shipment status map', () => {
    const transactions: TransactionData[] = [
      {
        id: 101,
        'Order Date': 'Jan 10, 2025',
        Customers: 'Acme',
        'Product Code': 'SKU-1',
        Quantity: 5,
        'Unit Price': 240,
        Discount: 10,
        Adjustment: 0,
        'Line Total': 1200,
        'Order Status': 'In Transit',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': 'SHIP-001',
      },
    ];

    const [updated, count] =
      TransactionService.syncTransactionsWithShipmentStatus(transactions, {
        'SKU-1': 'Delivered',
      });

    expect(count).toBe(1);
    expect(updated[0]['Order Status']).toBe('Warehouse');
  });
});
