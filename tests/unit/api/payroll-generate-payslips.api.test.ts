import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

type GeneratePayslipsPostHandler =
  typeof import('@/app/api/payroll/generate-payslips/route').POST;

const {
  mockPrisma,
  mockLaunch,
  mockBrowser,
  mockJsZip,
  mockZipInstance,
  mockExistsSync,
  mockReadFileSync,
  mockRegisterHelper,
  mockCompile,
  mockTemplate,
  mockLogger,
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

  const mockLaunch = vi.fn().mockResolvedValue(mockBrowser);

  const mockZipInstance = {
    file: vi.fn(),
    generateAsync: vi.fn().mockResolvedValue(Buffer.from('zip-content')),
  };

  const mockJsZip = vi.fn(() => mockZipInstance);

  const mockPrisma = {
    payroll: {
      findMany: vi.fn(),
    },
  };

  const mockExistsSync = vi.fn();
  const mockReadFileSync = vi.fn();

  const mockRegisterHelper = vi.fn();
  const mockTemplate = vi.fn().mockReturnValue('<html>payslip</html>');
  const mockCompile = vi.fn().mockReturnValue(mockTemplate);

  const mockLogger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  return {
    mockPrisma,
    mockLaunch,
    mockBrowser,
    mockJsZip,
    mockZipInstance,
    mockExistsSync,
    mockReadFileSync,
    mockRegisterHelper,
    mockCompile,
    mockTemplate,
    mockLogger,
  };
});

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('playwright', () => ({
  __esModule: true,
  chromium: { launch: mockLaunch },
}));

vi.mock('jszip', () => ({
  __esModule: true,
  default: mockJsZip,
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

vi.mock('handlebars/dist/handlebars.js', () => ({
  __esModule: true,
  default: {
    registerHelper: mockRegisterHelper,
    compile: mockCompile,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

let POST: GeneratePayslipsPostHandler;

const createRequest = (body: unknown): NextRequest =>
  new NextRequest('https://test.local/api/payroll/generate-payslips', {
    method: 'POST',
    body: JSON.stringify(body),
  });

describe('Payroll Generate Payslips API', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    mockExistsSync.mockImplementation((filePath: string) => {
      if (filePath.endsWith('payslip.hbs')) {
        return true;
      }

      if (filePath.endsWith('payslip-logo.png')) {
        return true;
      }
      return false;
    });

    mockReadFileSync.mockImplementation((filePath: string) => {
      if (filePath.endsWith('payslip.hbs')) {
        return '<div>{{employeeName}}</div>';
      }

      if (filePath.endsWith('payslip-logo.png')) {
        return Buffer.from('logo-bytes');
      }

      throw new Error('Unexpected file path');
    });

    mockCompile.mockReturnValue(mockTemplate);
    mockTemplate.mockImplementation(() => '<html>payslip</html>');

    ({ POST } = await import('@/app/api/payroll/generate-payslips/route'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates a payslip zip for the requested period', async () => {
    mockPrisma.payroll.findMany.mockResolvedValue([
      {
        id: 'payroll-1',
        employeeName: 'John Doe',
        employeeId: 'EMP-001',
        payPeriod: '2025-10-01 to 2025-10-15',
        periodStart: '2025-10-01',
        periodEnd: '2025-10-15',
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

    const request = createRequest({
      periodStart: '2025-10-01',
      periodEnd: '2025-10-15',
      payPeriodLabel: 'October 1-15 Payroll',
    });

    const responsePromise = POST(request);
    await vi.runAllTimersAsync();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/zip');
    expect(response.headers.get('Content-Disposition')).toContain(
      'payslips-october-1-15-payroll.zip'
    );

    const payloadBuffer = Buffer.from(await response.arrayBuffer());
    expect(payloadBuffer.toString()).toBe('zip-content');

    expect(mockPrisma.payroll.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          periodStart: '2025-10-01',
          periodEnd: '2025-10-15',
        }),
      })
    );

    expect(mockJsZip).toHaveBeenCalled();
    expect(mockZipInstance.file).toHaveBeenCalledWith(
      'John Doe.pdf',
      expect.any(Buffer)
    );
    expect(mockBrowser.close).toHaveBeenCalled();
  });

  it('returns validation error when period is missing', async () => {
    const request = createRequest({
      periodStart: '',
      payrollIds: ['payroll-1'],
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.validationErrors?.periodStart).toBeDefined();
    expect(payload.validationErrors?.periodEnd).toBeDefined();
    expect(mockPrisma.payroll.findMany).not.toHaveBeenCalled();
  });

  it('returns not found when payroll records do not exist', async () => {
    mockPrisma.payroll.findMany.mockResolvedValue([]);

    const request = createRequest({
      periodStart: '2025-10-01',
      periodEnd: '2025-10-15',
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe('No payroll records found');
    expect(payload.details).toContain('No payroll records found for');
    expect(mockLaunch).not.toHaveBeenCalled();
  });
});
