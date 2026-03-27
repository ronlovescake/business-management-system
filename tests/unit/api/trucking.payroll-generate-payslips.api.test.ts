import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockPrisma,
  mockBrowserType,
  mockZipFactory,
  mockZipInstance,
  mockExistsSync,
  mockReadFileSync,
  mockRegisterHelper,
  mockCompile,
  mockTemplate,
} = vi.hoisted(() => {
  const mockPage = {
    emulateMedia: vi.fn().mockResolvedValue(undefined),
    setContent: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(Buffer.from('pdf-buffer')),
  };

  const mockBrowser = {
    newPage: vi.fn().mockResolvedValue(mockPage),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockBrowserType = {
    executablePath: vi.fn(() => '/usr/bin/chromium'),
    launch: vi.fn().mockResolvedValue(mockBrowser),
  };

  const mockZipInstance = {
    file: vi.fn(),
    generateAsync: vi.fn().mockResolvedValue(Buffer.from('zip-content')),
  };

  const mockZipFactory = vi.fn(() => mockZipInstance);

  return {
    mockPrisma: {
      truckingPayroll: {
        findMany: vi.fn(),
      },
    },
    mockBrowserType,
    mockZipFactory,
    mockZipInstance,
    mockExistsSync: vi.fn(),
    mockReadFileSync: vi.fn(),
    mockRegisterHelper: vi.fn(),
    mockCompile: vi.fn(),
    mockTemplate: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/playwright/chromium', () => ({
  getChromiumBrowserType: vi.fn(async () => mockBrowserType),
  getChromiumExecutablePath: vi.fn(async () => '/usr/bin/chromium'),
}));

vi.mock('jszip', () => ({
  __esModule: true,
  default: mockZipFactory,
}));

vi.mock('fs', () => ({
  __esModule: true,
  default: {
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
  },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));

vi.mock('handlebars/dist/handlebars', () => ({
  __esModule: true,
  default: {
    registerHelper: mockRegisterHelper,
    compile: mockCompile,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { POST } from '@/app/api/trucking/payroll/generate-payslips/route';

describe('Trucking payroll generate-payslips API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockImplementation((filePath: string) => {
      return (
        filePath.endsWith('payslip.hbs') ||
        filePath.endsWith('payslip-logo.png')
      );
    });
    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.endsWith('payslip.hbs')) {
        return '<div>{{employeeName}}</div>';
      }

      return Buffer.from('logo-bytes');
    });
    mockCompile.mockReturnValue(mockTemplate);
    mockTemplate.mockReturnValue('<html>payslip</html>');
  });

  it('requires the period inputs', async () => {
    const response = await POST(
      new NextRequest(
        'http://localhost/api/trucking/payroll/generate-payslips',
        {
          method: 'POST',
          body: JSON.stringify({ periodStart: '' }),
        }
      )
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('periodStart and periodEnd are required');
  });

  it('generates a trucking payslip zip for a period', async () => {
    mockPrisma.truckingPayroll.findMany.mockResolvedValue([
      {
        id: 'truck-pay-1',
        employeeName: 'Driver One',
        employeeId: 'DRV-1',
        payPeriod: '2026-03-01 to 2026-03-15',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-15',
        status: 'pending',
        bankGcash: '09171234567',
        basicSalary: 10000,
        allowance: 500,
        overtime: 0,
        bonuses: 0,
        thirteenthMonth: 0,
        grossPay: 10500,
        sss: 500,
        philHealth: 200,
        pagIbig: 100,
        tax: 300,
        loans: 0,
        cashAdvance: 0,
        lwop: 0,
        absentsLates: 0,
        totalDeductions: 1100,
        netPay: 9400,
      },
    ]);

    const response = await POST(
      new NextRequest(
        'http://localhost/api/trucking/payroll/generate-payslips',
        {
          method: 'POST',
          body: JSON.stringify({
            periodStart: '2026-03-01',
            periodEnd: '2026-03-15',
            payPeriodLabel: 'March 1-15 Payroll',
          }),
        }
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(mockZipInstance.file).toHaveBeenCalledWith(
      'Driver One.pdf',
      expect.any(Buffer)
    );
  });
});
