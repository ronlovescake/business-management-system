import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductService } from '../ProductService';
import type { ProductData } from '../../types/product.types';
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const createProduct = (overrides: Partial<ProductData> = {}): ProductData => ({
  id: overrides.id,
  'Shipment Code': overrides['Shipment Code'] ?? '',
  'CV Number': overrides['CV Number'] ?? '',
  'No. Of Sacks': overrides['No. Of Sacks'] ?? 0,
  'Total CBM': overrides['Total CBM'] ?? 0,
  Weight: overrides.Weight ?? 0,
  'Shipment Status': overrides['Shipment Status'] ?? '',
  'Posting Date': overrides['Posting Date'] ?? '',
  'Order Date': overrides['Order Date'] ?? '',
  Payment: overrides.Payment ?? '',
  Product: overrides.Product ?? '',
  'Product Code': overrides['Product Code'] ?? '',
  'Age Range': overrides['Age Range'] ?? '',
  Unit: overrides.Unit ?? '',
  'Unit Price': overrides['Unit Price'] ?? 0,
  Quantity: overrides.Quantity ?? 0,
  'Alibaba Shipping Cost': overrides['Alibaba Shipping Cost'] ?? 0,
  'Exchange Rates': overrides['Exchange Rates'] ?? 0,
  PHP: overrides.PHP ?? 0,
  'Sub Total (PHP)': overrides['Sub Total (PHP)'] ?? 0,
  'Transaction Fee': overrides['Transaction Fee'] ?? 0,
  'Grand Total': overrides['Grand Total'] ?? 0,
  "Forwarder's Fee": overrides["Forwarder's Fee"] ?? 0,
  Lalamove: overrides.Lalamove ?? 0,
  'Packaging Cost': overrides['Packaging Cost'] ?? 0,
  'Suggested Price': overrides['Suggested Price'] ?? 0,
  'Landed Unit Cost': overrides['Landed Unit Cost'] ?? 0,
  'Actual Price': overrides['Actual Price'] ?? 0,
  COGS: overrides.COGS ?? 0,
  'Projected Sales': overrides['Projected Sales'] ?? 0,
  'Projected Profit': overrides['Projected Profit'] ?? 0,
  'Projected Profit (%)': overrides['Projected Profit (%)'] ?? 0,
  'Total Markup': overrides['Total Markup'] ?? 0,
  'Link To Post': overrides['Link To Post'] ?? '',
  'Bulk Quantity': overrides['Bulk Quantity'] ?? 0,
  'Bulk Weight': overrides['Bulk Weight'] ?? 0,
  'Weight Per Piece': overrides['Weight Per Piece'] ?? 0,
  createdAt: overrides.createdAt,
});

describe('ProductService.loadProducts sorting', () => {
  const mockedGet = vi.mocked(api.get);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prioritises products without shipment code by newest createdAt and places them before shipped products', async () => {
    const productResponse: ProductData[] = [
      createProduct({
        id: 1,
        'Shipment Code': 'SHIP-001',
        createdAt: '2025-01-01T00:00:00.000Z',
      }),
      createProduct({
        id: 2,
        'Shipment Code': '',
        createdAt: '2025-02-01T00:00:00.000Z',
        Product: 'Newest No Code',
      }),
      createProduct({
        id: 3,
        'Shipment Code': 'SHIP-010',
        createdAt: '2025-01-15T00:00:00.000Z',
      }),
      createProduct({
        id: 4,
        'Shipment Code': '',
        createdAt: '2025-01-10T00:00:00.000Z',
        Product: 'Older No Code',
      }),
      createProduct({
        id: 5,
        'Shipment Code': 'SHIP-002',
        createdAt: '2025-01-20T00:00:00.000Z',
      }),
    ];

    mockedGet.mockImplementation(async (url: string) => {
      if (url === '/api/products') {
        return productResponse;
      }
      if (url === '/api/shipments') {
        return [];
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const results = await ProductService.loadProducts();

    expect(results.map((product) => product.id)).toEqual([2, 4, 3, 5, 1]);
  });

  it('sorts shipped products by shipment code descending when shipment data fetch fails', async () => {
    const productResponse: ProductData[] = [
      createProduct({
        id: 1,
        'Shipment Code': 'SHIP-001',
        createdAt: '2025-01-01T00:00:00.000Z',
      }),
      createProduct({
        id: 2,
        'Shipment Code': 'SHIP-010',
        createdAt: '2025-01-02T00:00:00.000Z',
      }),
      createProduct({
        id: 3,
        'Shipment Code': 'SHIP-003',
        createdAt: '2025-01-03T00:00:00.000Z',
      }),
    ];

    mockedGet.mockResolvedValueOnce(productResponse);
    mockedGet.mockRejectedValueOnce(new Error('Shipments API down'));

    const results = await ProductService.loadProducts();

    expect(results.map((product) => product['Shipment Code'])).toEqual([
      'SHIP-010',
      'SHIP-003',
      'SHIP-001',
    ]);
  });
});
