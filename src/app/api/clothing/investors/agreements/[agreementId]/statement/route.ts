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
 * Contract-level return schedule (page 2 of the statement template only).
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
    const table = buildReturnSchedule({
      payouts: schedule.payouts,
      paidDates: new Map<number, string>(
        agreement.payments.map((record) => [record.month, record.paidDate])
      ),
      today,
    });
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
      returnColumns: table.columns,
      returnSummary: table.summary,
    };
    const [pdf] = await renderStatementPdfs([getStatementTemplate()(context)]);
    const filename = sanitizeFilename(`${agreement.reference}-returns.pdf`);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
