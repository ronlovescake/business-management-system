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
    agreements: { findUnique: vi.fn() },
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
vi.mock('@/utils/date', () => ({ getCurrentDateISO: () => '2026-10-17' }));
vi.mock('@/lib/db', () => ({
  prisma: {
    clothingInvestmentAgreement: mocks.agreements,
    clothingInvestorBankClosure: mocks.closures,
  },
}));
vi.mock('@/lib/playwright/chromium', () => ({
  getChromiumBrowserType: () => mocks.browserType,
  getChromiumExecutablePath: vi.fn(),
}));

import { GET } from '@/app/api/clothing/investors/agreements/[agreementId]/statement/route';

const params = { agreementId: 'agreement-1' };
const request = () =>
  new NextRequest(
    'http://localhost/api/clothing/investors/agreements/agreement-1/statement'
  );

function agreement() {
  return {
    id: 'agreement-1',
    reference: 'CR-001',
    effectiveDate: '2025-01-25',
    principal: new Prisma.Decimal('1000.00'),
    monthlyRateBps: 500,
    investor: { name: 'Test Investor' },
    payments: [
      { month: 3, paidDate: '2025-04-28' },
      { month: 4, paidDate: '2025-05-26' },
    ],
  };
}

describe('investor agreement statement API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.session.mockResolvedValue({ user: { role: 'ADMIN' } });
    mocks.agreements.findUnique.mockResolvedValue(agreement());
    mocks.closures.findMany.mockResolvedValue([]);
    mocks.browserType.executablePath.mockReturnValue('/chromium');
    mocks.browserType.launch.mockResolvedValue(mocks.browser);
    mocks.browser.newContext.mockResolvedValue(mocks.context);
    mocks.context.newPage.mockResolvedValue(mocks.page);
    mocks.page.emulateMedia.mockResolvedValue(undefined);
    mocks.page.setContent.mockResolvedValue(undefined);
    mocks.page.pdf.mockResolvedValue(Buffer.from('agreement-pdf'));
    mocks.browser.close.mockResolvedValue(undefined);
  });

  it('rejects unauthenticated and non-admin users before reading records', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await GET(request(), { params })).status).toBe(401);
    mocks.session.mockResolvedValue({ user: { role: 'USER' } });
    expect((await GET(request(), { params })).status).toBe(403);
    expect(mocks.agreements.findUnique).not.toHaveBeenCalled();
  });

  it('returns not found when the agreement does not exist', async () => {
    mocks.agreements.findUnique.mockResolvedValue(null);
    const response = await GET(request(), { params });
    expect(response.status).toBe(404);
    expect(mocks.browserType.launch).not.toHaveBeenCalled();
  });

  it('renders the investment summary and return schedule as a PDF attachment', async () => {
    const response = await GET(request(), { params });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toBe(
      `attachment; filename="Test Investor-CR-001-statement.pdf"; filename*=UTF-8''${encodeURIComponent('Test Investor-CR-001-statement.pdf')}`
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(mocks.agreements.findUnique).toHaveBeenCalledWith({
      where: { id: 'agreement-1' },
      include: {
        investor: true,
        payments: { select: { month: true, paidDate: true } },
      },
    });
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
      'agreement-pdf'
    );

    expect(mocks.page.setContent).toHaveBeenCalledTimes(1);
    const html = mocks.page.setContent.mock.calls[0][0] as string;
    expect(html).toContain('INVESTMENT STATEMENT');
    expect(html).toContain('Investment amount');
    expect(html).toContain('Next payout · Agreement month 5 of 36');
    expect(html).toContain('OVERDUE');
    expect(html).toContain('Maturity date');
    expect(html).toContain('January 25, 2028');
    expect(html).toContain('February 24, 2028');
    expect(html).toContain('Contract totals');
    expect(html).toContain('RETURN SCHEDULE');
    expect(html).toContain('Projected returns');
    expect(html).toContain('Test Investor');
    expect(html).toContain('INV-CR-001');
    expect(html).toContain('January 2025 – January 2028');
    expect(html).not.toContain('PAYOUT STATEMENT');
    expect(html).not.toContain('Amount paid');
    expect(html).not.toContain('Highlighted row');
    expect(html.match(/<tr class="[^"]*"><td class="num">/g)).toHaveLength(36);
    expect(html.match(/<table class="rs-table">/g)).toHaveLength(2);
    expect(html.match(/class="pill paid"/g)).toHaveLength(2);
    expect(html).not.toContain('class="current"');
    expect(html).toContain('2 of 32</strong> payable months paid');
    expect(mocks.page.pdf).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'A4', preferCSSPageSize: true })
    );
  });

  it('shows the first payout for a contract with no payouts yet', async () => {
    mocks.agreements.findUnique.mockResolvedValue({
      ...agreement(),
      effectiveDate: '2026-10-01',
      payments: [],
    });
    await GET(request(), { params });
    const html = mocks.page.setContent.mock.calls[0][0] as string;
    expect(html).toContain('NO PAYOUTS YET');
    expect(html).toContain('First payout · Agreement month 3 of 36');
    expect(html).toContain('Due January 01, 2027');
    expect(html).not.toContain('Next payout');
  });

  it('reports a fully paid contract when every payable month is recorded', async () => {
    mocks.agreements.findUnique.mockResolvedValue({
      ...agreement(),
      payments: Array.from({ length: 36 }, (_, index) => ({
        month: index + 1,
        paidDate: '2025-04-28',
      })),
    });
    await GET(request(), { params });
    const html = mocks.page.setContent.mock.calls[0][0] as string;
    expect(html).toContain('FULLY PAID');
    expect(html).toContain('All returns paid');
    expect(html).not.toContain('Next payout');
  });
});
