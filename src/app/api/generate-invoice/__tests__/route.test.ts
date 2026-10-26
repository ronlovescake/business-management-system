import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const renderer = vi.hoisted(() => {
  const page = {
    setContent: vi.fn(),
    setViewportSize: vi.fn(),
    screenshot: vi.fn(async () => new Uint8Array([80, 78, 71])),
    pdf: vi.fn(async () => new Uint8Array([80, 68, 70])),
  };
  const close = vi.fn();
  return {
    page,
    close,
    launch: vi.fn(async () => ({
      newContext: async () => ({ newPage: async () => page }),
      close,
    })),
  };
});
vi.mock('@/lib/playwright/chromium', () => ({
  getChromiumBrowserType: async () => ({
    launch: renderer.launch,
    executablePath: () => '/fixture/chromium',
  }),
  getChromiumExecutablePath: async () => '/fixture/chromium',
}));
vi.mock('@/constants/timeouts', () => ({ LOADING_SPINNER_DELAY: 0 }));
import { POST } from '../route';

describe('Reservation Deposit invoice generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-25T17:30:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['Reservation Deposit', '10%'],
    ['Reservation Deposit 20', '20%'],
    ['Reservation Fee', '10%'],
    ['Reservation Fee 20', '20%'],
  ])(
    'renders %s with the approved deadline and preserves legacy aliases',
    async (invoiceType, rate) => {
      const pending = POST(
        new NextRequest('http://127.0.0.1:65529/api/generate-invoice', {
          method: 'POST',
          body: JSON.stringify({
            invoiceType,
            transactions: [
              {
                Customers: 'Customer',
                'Product Code': 'SKU',
                Quantity: 1,
                'Unit Price': 1000,
                Adjustment: 0,
                'Line Total': 1000,
                'Order Status': 'In Transit',
              },
            ],
          }),
        })
      );
      await vi.runAllTimersAsync();
      const response = await pending;
      expect(response.status).toBe(200);
      const html = renderer.page.setContent.mock.calls[0][0] as string;
      expect(html).toContain(`Reservation Deposit (${rate})`);
      expect(html).toContain('DUE DATE: October 29, 2026 (11:59 PM Manila)');
      expect(html).not.toMatch(
        /reservation fee|24 hours|automatically be cancelled/i
      );
      expect(renderer.close).toHaveBeenCalledOnce();
    }
  );

  it('does not request another deposit from an order with existing collected money', async () => {
    const response = await POST(
      new NextRequest('http://127.0.0.1:65529/api/generate-invoice', {
        method: 'POST',
        body: JSON.stringify({
          invoiceType: 'Reservation Deposit',
          transactions: [{ Adjustment: 100 }],
        }),
      })
    );
    expect(response.status).toBe(400);
    expect(renderer.launch).not.toHaveBeenCalled();
    expect((await response.json()).message).toContain('Reservation Deposits');
  });
});
