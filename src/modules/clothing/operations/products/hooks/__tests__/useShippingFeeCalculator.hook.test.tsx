import { act, renderHook, waitFor } from '@testing-library/react';
import type { HotTableClass } from '@handsontable/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { useShippingFeeCalculator } from '../useShippingFeeCalculator';

const mockUseProductsData = vi.fn();
const mockUseShipmentsData = vi.fn();

vi.mock('../useProductsData', () => ({
  useProductsData: () => mockUseProductsData(),
}));

vi.mock('../../../shipments/hooks/useShipmentsData', () => ({
  useShipmentsData: () => mockUseShipmentsData(),
}));

vi.mock('@mantine/notifications', () => ({
  showNotification: vi.fn(),
}));

describe('useShippingFeeCalculator hook', () => {
  const fetchMock = vi.fn();

  const shipmentsFixture = [
    {
      'Shipment Status': 'Processing',
      'Shipment Code': 'SHIP-001',
    },
  ];

  const productsFixture = [
    {
      'Shipment Code': 'SHIP-001',
      'Product Code': 'PROD-1',
      Quantity: 10,
    },
    {
      'Shipment Code': 'SHIP-001',
      'Product Code': 'PROD-2',
      Quantity: 5,
    },
  ];

  beforeEach(() => {
    mockUseProductsData.mockReturnValue({
      products: productsFixture,
    });
    mockUseShipmentsData.mockReturnValue({
      shipments: shipmentsFixture,
    });

    fetchMock.mockImplementation(
      async (_url: RequestInfo, options?: RequestInit) => {
        if (options?.method === 'POST') {
          return {
            ok: true,
            json: async () => ({}),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            data: {
              shipmentCode: 'SHIP-001',
              actualAlibabaShipping: 600,
              actualForwardersFee: 300,
              actualLalamove: 150,
              multipliers: {
                ' PROD-1 ': '2.5',
                '': 'should-be-discarded',
              },
            },
          }),
        } as Response;
      }
    );

    vi.stubGlobal('fetch', fetchMock);
    window.localStorage.clear();
    // ensure deterministic height for the grid calculation logic
    Object.defineProperty(window, 'innerHeight', {
      value: 1000,
      writable: true,
    });
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('loads persisted shipping state and normalizes multipliers', async () => {
    const { result } = renderHook(() => useShippingFeeCalculator());

    await act(async () => {
      result.current.handleShipmentCodeChange('SHIP-001');
    });

    await waitFor(() => {
      expect(result.current.data[0]?.multiplier).toBe(2.5);
    });

    expect(result.current.actualAlibabaShipping).toBe(600);
    expect(result.current.actualForwardersFee).toBe(300);
    expect(result.current.actualLalamove).toBe(150);
    expect(
      window.localStorage.getItem('shippingFeeCalculator:selectedShipmentCode')
    ).toBe('SHIP-001');

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe(
      '/api/clothing/operations/products/shipping-fee-calculator?shipmentCode=SHIP-001'
    );
  });

  it('saves edited multipliers via handleAfterChange', async () => {
    const { result } = renderHook(() => useShippingFeeCalculator());

    await act(async () => {
      result.current.handleShipmentCodeChange('SHIP-001');
    });

    await waitFor(() => {
      expect(result.current.selectedShipmentCode).toBe('SHIP-001');
    });

    act(() => {
      const hotTableRef = result.current.hotTableRef as {
        current: HotTableClass | null;
      };
      hotTableRef.current = {
        hotInstance: {
          getData: () => [
            ['PROD-1', 10, 2],
            ['PROD-2', 5, 1],
          ],
        },
      } as never;
    });

    fetchMock.mockClear();

    await act(async () => {
      result.current.handleAfterChange(
        [[0, 'multiplier', 1, 2] as never],
        'edit'
      );
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const postCall = fetchMock.mock.calls.find(
      ([, options]) => options?.method === 'POST'
    );
    expect(postCall).toBeDefined();
    const [, postOptions] = postCall as [RequestInfo, RequestInit];
    expect(postOptions?.body).toContain('"PROD-1":2');
    expect(postOptions?.body).toContain('"PROD-2":1');
  });
});
