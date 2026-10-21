import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  customerColumns,
  defaultCustomerColumnIds,
  useCustomersGrid,
} from '@/modules/clothing/operations/customers/hooks/useCustomersGrid';
import type { CustomerData } from '@/modules/clothing/operations/customers/types/customer.types';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/store', () => ({
  useBusinessStore: () => ({ selectedBusiness: 'clothing' }),
}));

const customer: CustomerData = {
  id: 42,
  Date: '2026-10-21',
  'Customer Name': 'Maya Cruz',
  'Phone Number': '09171234567',
  'Email Address': 'maya@example.com',
  Address: 'Baguio City',
  Facebook: 'https://facebook.com/maya',
  'Business Name': 'Maya Clothing',
  'Tax Number': '123-456',
  'Business Address': 'Session Road',
  'Business Contact Number': '0741234567',
  'Customer Status': 'Active',
};

afterEach(() => vi.clearAllMocks());

describe('Customers directory grid', () => {
  it('preserves the full spreadsheet layout for callers outside the directory view', () => {
    const { result } = renderHook(() =>
      useCustomersGrid({
        filteredCustomers: [customer],
        directoryView: false,
      })
    );
    expect(result.current.columns).toHaveLength(11);
    expect(result.current.columns[0].id).toBe('date');
    expect(result.current.columns[1]).toMatchObject({
      id: 'customerName',
      width: 500,
    });
    expect(result.current.getData([0, 0])).toMatchObject({
      data: '2026-10-21',
    });
    expect(result.current.getData([5, 0])).toMatchObject({
      data: 'maya@example.com',
    });
  });

  it('shows the five essential columns with customer name first', () => {
    const { result } = renderHook(() =>
      useCustomersGrid({ filteredCustomers: [customer] })
    );
    expect(result.current.columns.map((column) => column.id)).toEqual(
      defaultCustomerColumnIds
    );
    expect(result.current.getData([0, 0])).toMatchObject({
      data: 'Maya Cruz',
      cursor: 'pointer',
      readonly: true,
    });
    expect(result.current.getData([4, 0])).toMatchObject({
      data: 'Active',
      displayData: 'Active',
    });
  });

  it('keeps fields aligned when hiding and restoring columns', () => {
    const { result, rerender } = renderHook(
      ({ visibleColumnIds }) =>
        useCustomersGrid({ filteredCustomers: [customer], visibleColumnIds }),
      { initialProps: { visibleColumnIds: ['emailAddress', 'taxNumber'] } }
    );
    expect(result.current.columns.map((column) => column.id)).toEqual([
      'customerName',
      'emailAddress',
      'taxNumber',
    ]);
    expect(result.current.getData([1, 0])).toMatchObject({
      data: 'maya@example.com',
    });
    expect(result.current.getData([2, 0])).toMatchObject({ data: '123-456' });

    rerender({
      visibleColumnIds: customerColumns.map((column) => column.id ?? ''),
    });
    expect(result.current.columns).toHaveLength(11);
    expect(result.current.getData([5, 0])).toMatchObject({
      data: '2026-10-21',
    });
    expect(result.current.getData([10, 0])).toMatchObject({
      data: '0741234567',
    });
  });

  it('opens the correct customer on double-click but not a contact cell', () => {
    const { result } = renderHook(() =>
      useCustomersGrid({
        filteredCustomers: [customer],
        visibleColumnIds: ['emailAddress'],
      })
    );
    act(() => {
      result.current.handleCellClick([1, 0]);
      result.current.handleCellClick([1, 0]);
    });
    expect(push).not.toHaveBeenCalled();
    act(() => {
      result.current.handleCellClick([0, 0]);
      result.current.handleCellClick([0, 0]);
    });
    expect(push).toHaveBeenCalledWith('/clothing/operations/customers/42');
  });

  it('returns empty read-only cells for out-of-range coordinates', () => {
    const { result } = renderHook(() =>
      useCustomersGrid({ filteredCustomers: [customer] })
    );
    for (const cell of [
      [0, -1],
      [0, 1],
      [30, 0],
    ] as const) {
      expect(result.current.getData(cell)).toMatchObject({
        data: '',
        readonly: true,
        allowOverlay: false,
      });
    }
  });
});
