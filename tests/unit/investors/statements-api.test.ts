import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => {
  const page = {
    emulateMedia: vi.fn(),
    setContent: vi.fn(),
    pdf: vi.fn(),
  };
  const context = { newPage: vi.fn() };
  const browser = {
    newContext: vi.fn(),
    close: vi.fn(),
  };
  const browserType = {
    launch: vi.fn(),
    executablePath: vi.fn(),
  };
  return {
    session: vi.fn(),
    payments: { findMany: vi.fn() },
    closures: { findMany: vi.fn() },
    page,
    context,
    browser,
    browserType,
  };
});

vi.mock('next-auth', () => ({ getServerSession: mocks.session }));
vi.mock('@/lib/auth/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));
vi.mock('@/lib/db', () => ({
  prisma: {
    clothingInvestmentPayment: mocks.payments,
    clothingInvestorBankClosure: mocks.closures,
  },
}));
vi.mock('@/lib/playwright/chromium', () => ({
  getChromiumBrowserType: () => mocks.browserType,
  getChromiumExecutablePath: vi.fn(),
}));

import { POST } from '@/app/api/clothing/investors/generate-statements/route';

const request = (body: unknown) =>
  new NextRequest(
    'http://localhost/api/clothing/investors/generate-statements',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

function payment(month: number) {
  return {
    id: `payment-${month}`,
    month,
    amount: new Prisma.Decimal('50.00'),
    paidDate: '2025-04-28',
    agreement: {
      reference: 'CR-001',
      effectiveDate: '2025-01-25',
      principal: new Prisma.Decimal('1000.00'),
      monthlyRateBps: 500,
      investor: { name: 'Test Investor' },
    },
  };
}

describe('investor payout statement API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ user: { role: 'ADMIN' } });
    mocks.payments.findMany.mockResolvedValue([]);
    mocks.closures.findMany.mockResolvedValue([]);
    mocks.browserType.executablePath.mockReturnValue('/chromium');
    mocks.browserType.launch.mockResolvedValue(mocks.browser);
    mocks.browser.newContext.mockResolvedValue(mocks.context);
    mocks.context.newPage.mockResolvedValue(mocks.page);
    mocks.page.emulateMedia.mockResolvedValue(undefined);
    mocks.page.setContent.mockResolvedValue(undefined);
    mocks.page.pdf.mockResolvedValue(Buffer.from('investor-pdf'));
    mocks.browser.close.mockResolvedValue(undefined);
  });

  it('requires an admin and a valid payout month before reading records', async () => {
    mocks.session.mockResolvedValue({ user: { role: 'USER' } });
    expect((await POST(request({ month: '2025-04' }))).status).toBe(403);
    mocks.session.mockResolvedValue({ user: { role: 'ADMIN' } });
    expect((await POST(request({ month: '2025-13' }))).status).toBe(400);
    expect(mocks.payments.findMany).not.toHaveBeenCalled();
  });

  it('returns not found when the month has no recorded paid payouts', async () => {
    const response = await POST(request({ month: '2025-04' }));
    expect(response.status).toBe(404);
    expect(mocks.browserType.launch).not.toHaveBeenCalled();
  });

  it('zips statements only for recorded payments due in the selected month', async () => {
    mocks.payments.findMany.mockResolvedValue([payment(3), payment(4)]);
    const response = await POST(request({ month: '2025-04' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.payments.findMany).toHaveBeenCalledWith({
      include: { agreement: { include: { investor: true } } },
      orderBy: [{ paidDate: 'asc' }, { id: 'asc' }],
    });
    const html = mocks.page.setContent.mock.calls[0][0] as string;
    expect(html).toContain('Test Investor');
    expect(html).toContain('PAYOUT STATEMENT');
    expect(html).toContain('not a bank transfer receipt');
    const JSZip = (await import('jszip')).default;
    const archive = await JSZip.loadAsync(
      Buffer.from(await response.arrayBuffer())
    );
    expect(Object.keys(archive.files)).toEqual(['CR-001-month-3.pdf']);
    expect(await archive.file('CR-001-month-3.pdf')?.async('string')).toBe(
      'investor-pdf'
    );
  });
});
