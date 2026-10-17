import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars/dist/handlebars';
import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { TemplateDelegate } from 'handlebars';
import { authOptions } from '@/lib/auth/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  getChromiumBrowserType,
  getChromiumExecutablePath,
} from '@/lib/playwright/chromium';
import { buildInvestmentSchedule } from '@/lib/investors/schedule';
import { getCurrentDateISO } from '@/utils/date';

export const dynamic = 'force-dynamic';

const TEMPLATE_PATH = path.join(
  process.cwd(),
  'templates',
  'investor-payout-statement.hbs'
);
const LOGO_PATH = path.join(
  process.cwd(),
  'templates',
  'images',
  'payslip-logo.png'
);
let templateCache: TemplateDelegate | null = null;
let logoCache: string | null = null;

type StatementContext = {
  companyName: string;
  logoData: string;
  statementReference: string;
  payoutPeriod: string;
  investorName: string;
  agreementReference: string;
  effectiveDate: string;
  principal: number;
  monthlyRate: string;
  payoutMonth: string;
  agreementMonth: number;
  bankingDate: string;
  paidDate: string;
  amount: number;
  generatedAt: string;
};

function validMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function getTemplate() {
  if (!templateCache) {
    templateCache = Handlebars.compile(
      fs.readFileSync(TEMPLATE_PATH, 'utf8')
    ) as TemplateDelegate;
    Handlebars.registerHelper('currency', (value: number) =>
      new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 2,
      }).format(Number(value) || 0)
    );
  }
  return templateCache;
}

function getLogo() {
  if (logoCache === null) {
    logoCache = fs.existsSync(LOGO_PATH)
      ? fs.readFileSync(LOGO_PATH).toString('base64')
      : '';
  }
  return logoCache;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-PH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function sanitizeFilename(value: string) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '').replace(/\s+/g, '-');
}

function buildStatementContext(
  payment: {
    month: number;
    amount: Prisma.Decimal;
    paidDate: string;
    agreement: {
      reference: string;
      effectiveDate: string;
      principal: Prisma.Decimal;
      monthlyRateBps: number;
      investor: { name: string };
    };
  },
  dueDate: string,
  month: string
): StatementContext {
  const [year, monthNumber] = month.split('-').map(Number);
  const monthDate = new Date(Date.UTC(year, monthNumber - 1, 1));
  const payoutPeriod = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(monthDate);
  const generatedDate = new Date();
  return {
    companyName: 'Czarlie & Ron',
    logoData: getLogo(),
    statementReference: `INV-${payment.agreement.reference}-${String(payment.month).padStart(2, '0')}`,
    payoutPeriod,
    investorName: payment.agreement.investor.name,
    agreementReference: payment.agreement.reference,
    effectiveDate: formatDate(payment.agreement.effectiveDate),
    principal: payment.agreement.principal.toNumber(),
    monthlyRate: (payment.agreement.monthlyRateBps / 100).toFixed(2),
    payoutMonth: payoutPeriod,
    agreementMonth: payment.month,
    bankingDate: formatDate(dueDate),
    paidDate: formatDate(payment.paidDate),
    amount: payment.amount.toNumber(),
    generatedAt: `${formatDate(getCurrentDateISO())} · ${generatedDate.toLocaleTimeString(
      'en-PH',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila',
      }
    )}`,
  };
}

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }
  return null;
}

export async function POST(request: NextRequest) {
  const denied = await authorize();
  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => null)) as {
    month?: unknown;
  } | null;
  if (!validMonth(body?.month)) {
    return NextResponse.json(
      { error: 'Select a valid payout month' },
      { status: 400 }
    );
  }

  try {
    const [payments, closures] = await Promise.all([
      prisma.clothingInvestmentPayment.findMany({
        include: { agreement: { include: { investor: true } } },
        orderBy: [{ paidDate: 'asc' }, { id: 'asc' }],
      }),
      prisma.clothingInvestorBankClosure.findMany({
        where: { deletedAt: null },
        select: { date: true },
      }),
    ]);
    const statements: { context: StatementContext; filename: string }[] = [];
    for (const payment of payments) {
      const agreement = payment.agreement;
      const schedule = buildInvestmentSchedule(
        {
          effectiveDate: agreement.effectiveDate,
          principalCents: agreement.principal.mul(100).toNumber(),
          monthlyRateBps: agreement.monthlyRateBps,
        },
        closures.map((closure) => closure.date)
      );
      const payout = schedule.payouts.find(
        (item) => item.month === payment.month
      );
      if (
        payout?.status !== 'scheduled' ||
        !payout.dueDate?.startsWith(body.month)
      ) {
        continue;
      }
      statements.push({
        context: buildStatementContext(payment, payout.dueDate, body.month),
        filename: sanitizeFilename(
          `${agreement.reference}-month-${payment.month}.pdf`
        ),
      });
    }
    if (!statements.length) {
      return NextResponse.json(
        { error: `No paid payouts found for ${body.month}` },
        { status: 404 }
      );
    }

    const browserType = await getChromiumBrowserType();
    const browser = await browserType.launch({
      headless: true,
      executablePath: browserType.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    try {
      const page = await (await browser.newContext()).newPage();
      await page.emulateMedia({ media: 'screen' });
      const template = getTemplate();
      const files: { name: string; buffer: Buffer }[] = [];
      for (const statement of statements) {
        await page.setContent(template(statement.context), {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        files.push({
          name: statement.filename,
          buffer: Buffer.from(
            await page.pdf({
              format: 'A4',
              printBackground: true,
              margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            })
          ),
        });
      }
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      for (const file of files) {
        zip.file(file.name, file.buffer);
      }
      const archive = await zip.generateAsync({ type: 'nodebuffer' });
      return new NextResponse(archive, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="investor-payout-statements-${body.month}.zip"`,
          'Cache-Control': 'private, no-store',
        },
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2021'
    ) {
      return NextResponse.json(
        { error: 'Investor payment database setup is pending' },
        { status: 503 }
      );
    }
    const chromiumPath = await getChromiumExecutablePath().catch(
      () => 'unavailable'
    );
    logger.error('Investor payout statement generation failed', {
      chromiumPath,
      error,
    });
    return NextResponse.json(
      { error: 'Unable to generate payout statements' },
      { status: 500 }
    );
  }
}
