import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getChromiumExecutablePath } from '@/lib/playwright/chromium';
import { buildInvestmentSchedule } from '@/lib/investors/schedule';
import type { ScheduledReturn } from '@/lib/investors/schedule';
import {
  COMPANY_NAME,
  buildReturnSchedule,
  formatDate,
  formatGeneratedAt,
  formatMonthYear,
  getStatementLogo,
  getStatementTemplate,
  renderStatementPdfs,
  sanitizeFilename,
} from '@/lib/investors/statements';
import type { StatementPageContext } from '@/lib/investors/statements';
import { getCurrentDateISO } from '@/utils/date';

export const dynamic = 'force-dynamic';

type StatementContext = StatementPageContext & {
  effectiveDate: string;
  payoutMonth: string;
  agreementMonth: number;
  bankingDate: string;
  paidDate: string;
  amount: number;
};

function validMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
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
      payments: { month: number; paidDate: string }[];
    };
  },
  dueDate: string,
  month: string,
  payouts: ScheduledReturn[]
): StatementContext {
  const payoutPeriod = formatMonthYear(month);
  const now = new Date();
  const today = getCurrentDateISO();
  const schedule = buildReturnSchedule({
    payouts,
    paidDates: new Map<number, string>(
      payment.agreement.payments.map((record) => [
        record.month,
        record.paidDate,
      ])
    ),
    today,
    currentMonth: payment.month,
  });
  return {
    companyName: COMPANY_NAME,
    logoData: getStatementLogo(),
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
    returnColumns: schedule.columns,
    returnSummary: schedule.summary,
    generatedAt: formatGeneratedAt(today, now),
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
        include: {
          agreement: {
            include: {
              investor: true,
              payments: { select: { month: true, paidDate: true } },
            },
          },
        },
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
        context: buildStatementContext(
          payment,
          payout.dueDate,
          body.month,
          schedule.payouts
        ),
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

    const template = getStatementTemplate();
    const buffers = await renderStatementPdfs(
      statements.map((statement) => template(statement.context))
    );
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    statements.forEach((statement, index) => {
      zip.file(statement.filename, buffers[index]);
    });
    const archive = await zip.generateAsync({ type: 'nodebuffer' });
    return new NextResponse(archive, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="investor-payout-statements-${body.month}.zip"`,
        'Cache-Control': 'private, no-store',
      },
    });
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
