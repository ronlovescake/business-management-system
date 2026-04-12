import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import type { TemplateDelegate as HandlebarsTemplateDelegate } from 'handlebars';
import Handlebars from 'handlebars/dist/handlebars';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  getChromiumBrowserType,
  getChromiumExecutablePath,
} from '@/lib/playwright/chromium';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { sanitizers } from '@/lib/security/sanitize';

const COMPANY_NAME = 'Czarlie & Ron';
const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'payslip.hbs');
const LOGO_PATH = path.join(
  process.cwd(),
  'templates',
  'images',
  'payslip-logo.png'
);

let templateCache: HandlebarsTemplateDelegate | null = null;
let logoBase64Cache: string | null = null;
let helpersRegistered = false;

type GeneratePayslipRequest = {
  periodStart?: string;
  periodEnd?: string;
  payPeriodLabel?: string;
  payrollIds?: string[];
};

type PayslipContext = {
  companyName: string;
  logoData: string;
  generatedAt: string;
  employeeName: string;
  employeeId?: string | null;
  payPeriod: string;
  periodRange: string;
  bankGcash: string;
  statusLabel: string;
  statusClass: string;
  basicSalary: number;
  allowance: number;
  overtime: number;
  bonuses: number;
  thirteenthMonth: number;
  grossPay: number;
  sss: number;
  philHealth: number;
  pagIbig: number;
  tax: number;
  loans: number;
  cashAdvance: number;
  lwop: number;
  absentsLates: number;
  totalDeductions: number;
  netPay: number;
};

type GMPayrollPayslipClient = Pick<typeof prisma, 'generalMerchandisePayroll'>;

const gmClient: GMPayrollPayslipClient = prisma;

function ensureHelpersRegistered() {
  if (helpersRegistered) {
    return;
  }

  Handlebars.registerHelper(
    'currency',
    function currencyFormatter(value: number | null | undefined) {
      if (
        value === null ||
        value === undefined ||
        Number.isNaN(Number(value))
      ) {
        return '₱0.00';
      }

      return (
        '₱' +
        Number(value).toLocaleString('en-PH', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }
  );

  helpersRegistered = true;
}

function getTemplate(): HandlebarsTemplateDelegate {
  if (templateCache) {
    return templateCache;
  }

  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error('Payslip template not found.');
  }

  const source = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
  const compiled = Handlebars.compile(source) as HandlebarsTemplateDelegate;
  templateCache = compiled;
  return compiled;
}

function getLogoBase64(): string {
  if (logoBase64Cache) {
    return logoBase64Cache;
  }

  if (!fs.existsSync(LOGO_PATH)) {
    logger.warn('Payslip logo not found, proceeding without logo.');
    logoBase64Cache = '';
    return logoBase64Cache;
  }

  const buffer = fs.readFileSync(LOGO_PATH);
  logoBase64Cache = buffer.toString('base64');
  return logoBase64Cache;
}

const sanitizeFilename = (value: string): string => {
  const fallback = 'payslip';
  if (!value) {
    return `${fallback}.pdf`;
  }

  const sanitized = value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return `${sanitized.length > 0 ? sanitized : fallback}.pdf`;
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

function formatDateRange(start?: string | null, end?: string | null): string {
  const startFormatted = formatDate(start ?? undefined);
  const endFormatted = formatDate(end ?? undefined);

  if (startFormatted && endFormatted) {
    return `${startFormatted} - ${endFormatted}`;
  }

  return startFormatted || endFormatted || '';
}

async function buildPayslipContext(
  record: Awaited<
    ReturnType<typeof gmClient.generalMerchandisePayroll.findMany>
  >[number],
  periodStart?: string,
  periodEnd?: string
): Promise<PayslipContext> {
  const statusLabel = record.status.toUpperCase();
  const statusClass = record.status.toLowerCase();
  const generatedAtDate = new Date();

  return {
    companyName: COMPANY_NAME,
    logoData: getLogoBase64(),
    generatedAt: `${formatDate(generatedAtDate)} \u00B7 ${generatedAtDate.toLocaleTimeString(
      'en-US',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila',
      }
    )}`,
    employeeName: record.employeeName,
    employeeId: record.employeeId ?? null,
    payPeriod: record.payPeriod,
    periodRange: formatDateRange(
      periodStart ?? record.periodStart,
      periodEnd ?? record.periodEnd
    ),
    bankGcash: record.bankGcash?.trim() ? record.bankGcash : '—',
    statusLabel,
    statusClass,
    basicSalary: Number(record.basicSalary ?? 0),
    allowance: Number(record.allowance ?? 0),
    overtime: Number(record.overtime ?? 0),
    bonuses: Number(record.bonuses ?? 0),
    thirteenthMonth: Number(record.thirteenthMonth ?? 0),
    grossPay: Number(record.grossPay ?? 0),
    sss: Number(record.sss ?? 0),
    philHealth: Number(record.philHealth ?? 0),
    pagIbig: Number(record.pagIbig ?? 0),
    tax: Number(record.tax ?? 0),
    loans: Number(record.loans ?? 0),
    cashAdvance: Number(record.cashAdvance ?? 0),
    lwop: Number(record.lwop ?? 0),
    absentsLates: Number(record.absentsLates ?? 0),
    totalDeductions: Number(record.totalDeductions ?? 0),
    netPay: Number(record.netPay ?? 0),
  };
}

function validateRequestBody(body: GeneratePayslipRequest) {
  const periodStart = sanitizers.date(body.periodStart);
  const periodEnd = sanitizers.date(body.periodEnd);

  if (!periodStart || !periodEnd) {
    return {
      valid: false as const,
      response: ApiResponse.badRequest('Validation failed', {
        periodStart: 'periodStart is required and must be a valid date',
        periodEnd: 'periodEnd is required and must be a valid date',
      }),
    };
  }

  return {
    valid: true as const,
    data: {
      periodStart,
      periodEnd,
      payPeriodLabel:
        typeof body.payPeriodLabel === 'string'
          ? body.payPeriodLabel.trim()
          : undefined,
      payrollIds: (body.payrollIds ?? [])
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id)),
    },
  };
}

async function createZipFromFiles(files: { name: string; buffer: Buffer }[]) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  for (const file of files) {
    zip.file(file.name, file.buffer);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}

function buildZipFilename(label?: string) {
  if (label && label.length > 0) {
    const sanitized = label
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();

    if (sanitized.length > 0) {
      return `payslips-${sanitized}.zip`;
    }
  }

  return `payslips-${new Date().toISOString().replace(/:/g, '-')}.zip`;
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  ensureHelpersRegistered();

  let body: GeneratePayslipRequest = {};
  try {
    body = (await request.json()) as GeneratePayslipRequest;
  } catch (error) {
    logger.warn('Failed to parse payslip request body', { error });
    return ApiResponse.badRequest('Invalid request body');
  }

  const validation = validateRequestBody(body);
  if (!validation.valid) {
    return validation.response;
  }

  const { periodStart, periodEnd, payrollIds, payPeriodLabel } =
    validation.data;

  const payrolls = await gmClient.generalMerchandisePayroll.findMany({
    where: {
      deletedAt: null,
      periodStart,
      periodEnd,
      ...(payrollIds.length
        ? {
            id: {
              in: payrollIds,
            },
          }
        : {}),
    },
    orderBy: {
      employeeName: 'asc',
    },
  });

  if (payrolls.length === 0) {
    return ApiResponse.error(
      'No payroll records found',
      HTTP_STATUS.NOT_FOUND,
      `No payroll records found for ${periodStart} to ${periodEnd}.`
    );
  }

  const template = getTemplate();
  const browserType = await getChromiumBrowserType();
  const browser = await browserType.launch({
    headless: true,
    executablePath: browserType.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.emulateMedia({ media: 'screen' });

    const files: { name: string; buffer: Buffer }[] = [];

    for (const record of payrolls) {
      const context = await buildPayslipContext(record, periodStart, periodEnd);
      const html = template(context);

      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      const pdfBuffer = Buffer.from(
        await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '0mm',
            right: '0mm',
            bottom: '0mm',
            left: '0mm',
          },
        })
      );

      const filename = sanitizeFilename(record.employeeName);
      files.push({ name: filename, buffer: pdfBuffer });
    }

    const zipBuffer = await createZipFromFiles(files);
    const zipFilename = buildZipFilename(payPeriodLabel);

    return new NextResponse(Buffer.from(zipBuffer), {
      status: HTTP_STATUS.OK,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
      },
    });
  } catch (error) {
    const chromiumPath = await getChromiumExecutablePath().catch(
      () => 'unavailable'
    );
    logger.error('Error generating payslips', {
      chromiumPath,
      error,
    });
    throw error;
  } finally {
    await browser.close();
  }
});
