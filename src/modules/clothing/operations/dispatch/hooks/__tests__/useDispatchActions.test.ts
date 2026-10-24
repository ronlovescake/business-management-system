import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDispatchActions } from '../useDispatchActions';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  fire: vi.fn(),
  notify: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({
  apiClient: { get: mocks.get, patch: mocks.patch },
}));
vi.mock('@/lib/alerts', () => ({
  getSwal: async () => ({ fire: mocks.fire }),
}));
vi.mock('@mantine/notifications', () => ({ showNotification: mocks.notify }));

function mount(shipTime = '2026-10-25T11:00:00Z') {
  return renderHook(() =>
    useDispatchActions({
      effectiveRawData: [
        { 'Ship Time': shipTime, 'Username (Buyer)': 'buyer' },
      ],
      lookupCustomerName: () => 'A < B',
      updateOrderCompletion: vi.fn(),
    })
  );
}

describe('dispatch shipped-order boundaries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    mocks.fire.mockResolvedValue({ isConfirmed: true });
    mocks.get.mockResolvedValue([
      {
        id: 1,
        Customers: 'A < B',
        'Order Status': 'Checked Out',
        'Product Code': '<b>Item</b>',
        Quantity: 1,
      },
    ]);
    mocks.patch.mockResolvedValue({ success: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not mutate transactions for a future ship time', async () => {
    const { result } = mount('2026-10-26T12:00:00Z');
    await act(async () => result.current.handleUpdateShippedOrders());
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
    expect(mocks.fire).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No Recent Orders' })
    );
  });

  it('escapes customer and product text in the confirmation HTML', async () => {
    const { result } = mount();
    await act(async () => result.current.handleUpdateShippedOrders());
    const html = mocks.fire.mock.calls[0][0].html;
    expect(html).toContain('A &lt; B');
    expect(html).toContain('&lt;b&gt;Item&lt;/b&gt;');
    expect(html).not.toContain('<b>Item</b>');
  });

  it('does not report green success when every update fails', async () => {
    mocks.patch.mockRejectedValue(new Error('Update failed'));
    const { result } = mount();
    await act(async () => result.current.handleUpdateShippedOrders());
    expect(mocks.notify).toHaveBeenLastCalledWith(
      expect.objectContaining({ color: 'red' })
    );
  });
});
