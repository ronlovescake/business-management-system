import { Prisma } from '@prisma/client';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getChromiumExecutablePath } from '@/lib/playwright/chromium';
import { buildInvestmentSchedule } from '@/lib/investors/schedule';
import {
  COMPANY_NAME,
  buildReturnSchedule,
  formatDate,
  formatGeneratedAt,
  formatMonthYear,
  getStatementLogo,
  getStatementTemplate,
  renderStatementPdfs,
} from '@/lib/investors/statements';
import type { StatementPageContext } from '@/lib/investors/statements';
import { getCurrentDateISO } from '@/utils/date';

export const dynamic = 'force-dynamic';

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

/**
 * Contract-level statement: investment summary page plus the return schedule.
 * Not tied to a payout month, so no row is highlighted.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { agreementId: string } }
) {
  const denied = await authorize();
  if (denied) {
    return denied;
  }

  try {
    const [agreement, closures] = await Promise.all([
      prisma.clothingInvestmentAgreement.findUnique({
        where: { id: params.agreementId },
        include: {
          investor: true,
          payments: { select: { month: true, paidDate: true } },
        },
      }),
      prisma.clothingInvestorBankClosure.findMany({
        where: { deletedAt: null },
        select: { date: true },
      }),
    ]);
    if (!agreement) {
      return NextResponse.json(
        { error: 'Investment agreement not found' },
        { status: 404 }
      );
    }

    const schedule = buildInvestmentSchedule(
      {
        effectiveDate: agreement.effectiveDate,
        principalCents: agreement.principal.mul(100).toNumber(),
        monthlyRateBps: agreement.monthlyRateBps,
      },
      closures.map((closure) => closure.date)
    );
    const today = getCurrentDateISO();
    const paidDates = new Map<number, string>(
      agreement.payments.map((record) => [record.month, record.paidDate])
    );
    const table = buildReturnSchedule({
      payouts: schedule.payouts,
      paidDates,
      today,
    });
    const scheduled = schedule.payouts.filter(
      (payout) => payout.status === 'scheduled'
    );
    const next = scheduled.find((payout) => !paidDates.has(payout.month));
    const overdue = Boolean(next?.dueDate && next.dueDate < today);
    const hasPayouts = paidDates.size > 0;
    const context: StatementPageContext = {
      companyName: COMPANY_NAME,
      logoData: getStatementLogo(),
      statementReference: `INV-${agreement.reference}`,
      payoutPeriod: `${formatMonthYear(agreement.effectiveDate)} – ${formatMonthYear(schedule.maturityDate)}`,
      investorName: agreement.investor.name,
      agreementReference: agreement.reference,
      principal: agreement.principal.toNumber(),
      monthlyRate: (agreement.monthlyRateBps / 100).toFixed(2),
      generatedAt: formatGeneratedAt(today, new Date()),
      contractOnly: true,
      contract: {
        effectiveDate: formatDate(agreement.effectiveDate),
        firstPayoutDate: scheduled[0]?.dueDate
          ? formatDate(scheduled[0].dueDate)
          : '—',
        maturityDate: formatDate(schedule.maturityDate),
        repaymentDeadline: formatDate(schedule.principalRepaymentDeadline),
        monthlyReturn: schedule.monthlyReturnCents / 100,
        statusLabel: !next
          ? 'FULLY PAID'
          : overdue
            ? 'OVERDUE'
            : hasPayouts
              ? 'ACTIVE'
              : 'NO PAYOUTS YET',
        nextPayout: next
          ? {
              label: hasPayouts ? 'Next payout' : 'First payout',
              month: next.month,
              bankingDate: next.dueDate ? formatDate(next.dueDate) : '—',
              amount: next.amountCents / 100,
              overdue,
            }
          : null,
      },
      returnColumns: table.columns,
      returnSummary: table.summary,
    };
    const [pdf] = await renderStatementPdfs([getStatementTemplate()(context)]);
    const filename =
      `${agreement.investor.name}-${agreement.reference}-statement.pdf`.replace(
        /[<>:"/\\|?*\x00-\x1F]/g,
        ''
      );
    // Header values must be Latin-1; filename* carries the full UTF-8 name.
    const asciiFilename = filename.replace(/[^\x20-\x7E]/g, '_');

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
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
    logger.error('Investor agreement statement generation failed', {
      chromiumPath,
      error,
    });
    return NextResponse.json(
      { error: 'Unable to generate agreement statement' },
      { status: 500 }
    );
  }
}
