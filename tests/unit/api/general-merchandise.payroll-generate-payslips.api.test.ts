import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { mockLogger } from '@/core/testing/test-helpers';

import type { POST as GeneratePayslipsPOST } from '@/app/api/general-merchandise/payroll/generate-payslips/route';

type GeneratePayslipsPostHandler = typeof GeneratePayslipsPOST;

const {
  mockPrisma,
  mockLaunch,
  mockBrowser,
  mockExecutablePath,
  mockJsZip,
  mockZipInstance,
  mockExistsSync,
  mockReadFileSync,
  mockRegisterHelper,
  mockCompile,
} = vi.hoisted(() => {
  const mockPage = {
    emulateMedia: vi.fn().mockResolvedValue(undefined),
    setContent: vi.fn().mockResolvedValue(undefined),
    pdf: vi.fn().mockResolvedValue(Buffer.from('pdf-buffer')),
  };

  const mockBrowserContext = {
    newPage: vi.fn().mockResolvedValue(mockPage),
  };

  const mockBrowser = {
    newContext: vi.fn().mockResolvedValue(mockBrowserContext),
    close: vi.fn().mockResolvedValue(undefined),
  };

  const mockLaunch = vi.fn().mockResolvedValue(mockBrowser);
  const mockExecutablePath = vi.fn().mockReturnValue('/usr/bin/chromium');

  const mockZipInstance = {
    file: vi.fn(),
    generateAsync: vi.fn().mockResolvedValue(Buffer.from('zip-content')),
  };

  const mockJsZip = vi.fn(() => mockZipInstance);

  const mockPrisma = {
    generalMerchandisePayroll: {
      findMany: vi.fn(),
    },
  };

  const mockExistsSync = vi.fn();
  const mockReadFileSync = vi.fn();
  const mockRegisterHelper = vi.fn();
  const mockTemplate = vi.fn().mockReturnValue('<html>payslip</html>');
  const mockCompile = vi.fn().mockReturnValue(mockTemplate);

  return {
    mockPrisma,
    mockLaunch,
    mockBrowser,
    mockExecutablePath,
    mockJsZip,
    mockZipInstance,
    mockExistsSync,
    mockReadFileSync,
    mockRegisterHelper,
    mockCompile,
    mockTemplate,
  };
});

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('playwright', () => ({
  __esModule: true,
  chromium: { launch: mockLaunch, executablePath: mockExecutablePath },
}));
vi.mock('jszip', () => ({ __esModule: true, default: mockJsZip }));
vi.mock('fs', () => ({
  __esModule: true,
  default: { existsSync: mockExistsSync, readFileSync: mockReadFileSync },
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
}));
vi.mock('handlebars/dist/handlebars', () => ({
  __esModule: true,
  default: { registerHelper: mockRegisterHelper, compile: mockCompile },
}));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

let POST: GeneratePayslipsPostHandler;

const createRequest = (body: unknown): NextRequest =>
  new NextRequest(
    'https://test.local/api/general-merchandise/payroll/generate-payslips',
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );

describe('General merchandise payroll generate payslips API', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockExistsSync.mockImplementation(
      (filePath: string) =>
        filePath.endsWith('payslip.hbs') ||
        filePath.endsWith('payslip-logo.png')
    );
    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.endsWith('payslip.hbs')) {
        return '<div>{{employeeName}}</div>';
      }
      if (filePath.endsWith('payslip-logo.png')) {
        return Buffer.from('logo-bytes');
      }
      throw new Error('Unexpected file path');
    });

    ({ POST } = await import(
      '@/app/api/general-merchandise/payroll/generate-payslips/route'
    ));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates a GM payslip zip for the requested period', async () => {
    mockPrisma.generalMerchandisePayroll.findMany.mockResolvedValue([
      {
        id: 'gm-payroll-1',
        employeeName: 'Gamma Worker',
        employeeId: 'GM-001',
        payPeriod: '2026-03-01 to 2026-03-15',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-15',
        status: 'pending',
        bankGcash: '1234567890',
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

    vi.useFakeTimers();
    const responsePromise = POST(
      createRequest({ periodStart: '2026-03-01', periodEnd: '2026-03-15' })
    );
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(mockZipInstance.file).toHaveBeenCalledWith(
      'Gamma Worker.pdf',
      expect.any(Buffer)
    );
    expect(mockBrowser.close).toHaveBeenCalled();
  });
});
