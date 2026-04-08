import { describe, expect, it } from 'vitest';

import {
  filterCheckoutLinks,
  filterInvoiceData,
  filterItemWeightData,
  filterCustomerOrders,
  filterLocalInvoiceData,
} from '@/modules/clothing/operations/checkout-links/hooks/checkoutLinksFilters';
import type {
  CheckoutLinkData,
  CustomerOrderData,
  InvoiceData,
  ItemWeightData,
} from '@/modules/clothing/operations/checkout-links/types';

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

const checkoutLinks: CheckoutLinkData[] = [
  {
    id: '1',
    weight: '2.5',
    width: '10',
    length: '20',
    height: '5',
    checkoutLinks: 'https://shopee.ph/checkout-abc',
    productPortals: 'Portal-A',
    productNames: 'Blue Shirt',
  },
  {
    id: '2',
    weight: '3.0',
    width: '15',
    length: '25',
    height: '8',
    checkoutLinks: 'https://shopee.ph/checkout-def',
    productPortals: 'Portal-B',
    productNames: 'Red Dress',
  },
];

const invoices: InvoiceData[] = [
  {
    id: '1',
    customerName: 'Alice Johnson',
    actualWeight: '2.50',
    finalWeight: '3.00',
    shopeeCheckoutLinks: 'https://shopee.ph/link-1',
    driveFiles: 'invoice-001.pdf',
    message: 'Hello Alice',
    chat: 'chat-1',
    tickbox: false,
  },
  {
    id: '2',
    customerName: 'Bob Smith',
    actualWeight: '4.00',
    finalWeight: '4.50',
    shopeeCheckoutLinks: 'https://shopee.ph/link-2',
    driveFiles: 'invoice-002.pdf',
    message: 'Hello Bob',
    chat: 'chat-2',
    tickbox: true,
  },
];

const itemWeights: ItemWeightData[] = [
  {
    id: '1',
    itemName: 'Cotton T-Shirt',
    productCode: 'CT-100',
    bulkQuantity: '50',
    bulkWeight: '12.5',
    approxWeightPerPiece: '0.25',
  },
  {
    id: '2',
    itemName: 'Denim Jeans',
    productCode: 'DJ-200',
    bulkQuantity: '30',
    bulkWeight: '24.0',
    approxWeightPerPiece: '0.80',
  },
];

const customerOrders: CustomerOrderData[] = [
  {
    id: '1',
    customerName: 'Charlie Brown',
    productCode: 'CT-100',
    quantity: 10,
    orderStatus: 'shipped',
    weightPerPiece: '0.25',
    actualWeight: '2.50',
  },
  {
    id: '2',
    customerName: 'Diana Prince',
    productCode: 'DJ-200',
    quantity: 5,
    orderStatus: 'pending',
    weightPerPiece: '0.80',
    actualWeight: '4.00',
  },
];

// ---------------------------------------------------------------------------
// filterCheckoutLinks
// ---------------------------------------------------------------------------

describe('filterCheckoutLinks', () => {
  it('returns all items when search query is empty', () => {
    expect(filterCheckoutLinks(checkoutLinks, '')).toEqual(checkoutLinks);
    expect(filterCheckoutLinks(checkoutLinks, '   ')).toEqual(checkoutLinks);
  });

  it('matches by weight', () => {
    expect(filterCheckoutLinks(checkoutLinks, '2.5')).toEqual([
      checkoutLinks[0],
    ]);
  });

  it('matches by productNames (case-insensitive)', () => {
    expect(filterCheckoutLinks(checkoutLinks, 'blue shirt')).toEqual([
      checkoutLinks[0],
    ]);
  });

  it('matches by checkoutLinks URL', () => {
    expect(filterCheckoutLinks(checkoutLinks, 'checkout-def')).toEqual([
      checkoutLinks[1],
    ]);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterCheckoutLinks(checkoutLinks, 'nonexistent')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterInvoiceData
// ---------------------------------------------------------------------------

describe('filterInvoiceData', () => {
  it('returns all items when search query is empty', () => {
    expect(filterInvoiceData(invoices, '')).toEqual(invoices);
  });

  it('matches by customerName', () => {
    expect(filterInvoiceData(invoices, 'alice')).toEqual([invoices[0]]);
  });

  it('matches by actualWeight', () => {
    expect(filterInvoiceData(invoices, '4.00')).toEqual([invoices[1]]);
  });

  it('matches by driveFiles', () => {
    expect(filterInvoiceData(invoices, 'invoice-001')).toEqual([invoices[0]]);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterInvoiceData(invoices, 'nobody')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterItemWeightData
// ---------------------------------------------------------------------------

describe('filterItemWeightData', () => {
  it('returns all items when search query is empty', () => {
    expect(filterItemWeightData(itemWeights, '')).toEqual(itemWeights);
  });

  it('matches by itemName', () => {
    expect(filterItemWeightData(itemWeights, 'cotton')).toEqual([
      itemWeights[0],
    ]);
  });

  it('matches by productCode', () => {
    expect(filterItemWeightData(itemWeights, 'DJ-200')).toEqual([
      itemWeights[1],
    ]);
  });

  it('matches by approxWeightPerPiece', () => {
    expect(filterItemWeightData(itemWeights, '0.80')).toEqual([
      itemWeights[1],
    ]);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterItemWeightData(itemWeights, 'xyz')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterCustomerOrders
// ---------------------------------------------------------------------------

describe('filterCustomerOrders', () => {
  it('returns all items when search query is empty', () => {
    expect(filterCustomerOrders(customerOrders, '')).toEqual(customerOrders);
  });

  it('matches by customerName', () => {
    expect(filterCustomerOrders(customerOrders, 'diana')).toEqual([
      customerOrders[1],
    ]);
  });

  it('matches by productCode', () => {
    expect(filterCustomerOrders(customerOrders, 'CT-100')).toEqual([
      customerOrders[0],
    ]);
  });

  it('matches by orderStatus', () => {
    expect(filterCustomerOrders(customerOrders, 'pending')).toEqual([
      customerOrders[1],
    ]);
  });

  it('matches by quantity (stringified)', () => {
    expect(filterCustomerOrders(customerOrders, '10')).toEqual([
      customerOrders[0],
    ]);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterCustomerOrders(customerOrders, 'absent')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// filterLocalInvoiceData
// ---------------------------------------------------------------------------

describe('filterLocalInvoiceData', () => {
  const localInvoices: InvoiceData[] = [
    {
      id: '1',
      customerName: 'Alice',
      actualWeight: '1.0',
      finalWeight: '1.5',
      shopeeCheckoutLinks: '',
      driveFiles: '2026-01-01',
      message: '',
      chat: '',
      tickbox: false,
      localInvoiceDates: ['2026-01-01', '2026-01-02'],
    },
    {
      id: '2',
      customerName: 'Bob',
      actualWeight: '2.0',
      finalWeight: '2.5',
      shopeeCheckoutLinks: '',
      driveFiles: '2026-01-03',
      message: '',
      chat: '',
      tickbox: false,
      localInvoiceDates: ['2026-01-03'],
    },
  ];

  it('returns all items when query and selectedDate are empty/null', () => {
    expect(filterLocalInvoiceData(localInvoices, '', null)).toEqual(
      localInvoices
    );
  });

  it('filters by selectedDate', () => {
    const result = filterLocalInvoiceData(localInvoices, '', '2026-01-03');
    expect(result).toEqual([localInvoices[1]]);
  });

  it('filters by search query', () => {
    const result = filterLocalInvoiceData(localInvoices, 'alice', null);
    expect(result).toEqual([localInvoices[0]]);
  });

  it('combines search query and selectedDate', () => {
    const result = filterLocalInvoiceData(localInvoices, 'alice', '2026-01-01');
    expect(result).toEqual([localInvoices[0]]);
  });

  it('returns empty when selectedDate does not match', () => {
    const result = filterLocalInvoiceData(
      localInvoices,
      'alice',
      '2099-01-01'
    );
    expect(result).toEqual([]);
  });

  it('supports legacy localInvoiceDate field', () => {
    const legacy: InvoiceData[] = [
      {
        id: '3',
        customerName: 'Carol',
        actualWeight: '1.0',
        finalWeight: '1.5',
        shopeeCheckoutLinks: '',
        driveFiles: '2026-02-01',
        message: '',
        chat: '',
        tickbox: false,
        localInvoiceDate: '2026-02-01',
      },
    ];
    const result = filterLocalInvoiceData(legacy, '', '2026-02-01');
    expect(result).toEqual(legacy);
  });
});
