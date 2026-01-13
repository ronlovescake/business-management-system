import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import type { TemplateDelegate as HandlebarsTemplateDelegate } from 'handlebars';
import Handlebars from 'handlebars';
import { chromium } from 'playwright';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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
  record: Awaited<ReturnType<typeof prisma.truckingPayroll.findMany>>[number],
  periodStart?: string,
  periodEnd?: string
): Promise<PayslipContext> {
  const statusLabel = record.status.toUpperCase();
  const statusClass = record.status.toLowerCase();
  const generatedAtDate = new Date();

  return {
    companyName: COMPANY_NAME,
    logoData: getLogoBase64(),
    generatedAt: `${formatDate(generatedAtDate)} ${generatedAtDate.toLocaleTimeString(
      'en-PH',
      {
        hour: '2-digit',
        minute: '2-digit',
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

export async function POST(request: NextRequest) {
  ensureHelpersRegistered();

  let body: GeneratePayslipRequest = {};
  try {
    body = (await request.json()) as GeneratePayslipRequest;
  } catch (error) {
    logger.warn('Failed to parse payslip request body, using defaults.', error);
  }

  const { periodStart, periodEnd, payrollIds } = body;

  if (!periodStart || !periodEnd) {
    return NextResponse.json(
      {
        success: false,
        error: 'periodStart and periodEnd are required to generate payslips.',
        code: 'missing_period',
      },
      { status: 400 }
    );
  }

  try {
    const payrolls = await prisma.truckingPayroll.findMany({
      where: {
        deletedAt: null,
        periodStart,
        periodEnd,
        ...(payrollIds && payrollIds.length > 0
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
      return NextResponse.json(
        {
          success: false,
          error: `No payroll records found for ${periodStart} to ${periodEnd}.`,
          code: 'no_records',
        },
        { status: 404 }
      );
    }

    const template = getTemplate();

    const generationTimestamp = new Date().toISOString().replace(/:/g, '-');

    const browser = await chromium.launch({
      headless: true,
      executablePath: chromium.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
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

      const pdfArray = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm',
        },
      });

      const pdfBuffer = Buffer.from(pdfArray);

      const filename = sanitizeFilename(record.employeeName);
      files.push({ name: filename, buffer: pdfBuffer });
    }

    await browser.close();

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const file of files) {
      zip.file(file.name, file.buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    const sanitizedLabel =
      typeof body.payPeriodLabel === 'string' &&
      body.payPeriodLabel.trim().length > 0
        ? body.payPeriodLabel
            .replace(/[^a-zA-Z0-9]+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .toLowerCase()
        : null;

    const zipFilename = `${sanitizedLabel ? `payslips-${sanitizedLabel}` : `payslips-${generationTimestamp}`}.zip`;

    return new NextResponse(Buffer.from(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
      },
    });
  } catch (error) {
    logger.error('Error generating payslips:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate payslips.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
