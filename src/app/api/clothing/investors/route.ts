import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth/auth';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { buildInvestmentSchedule } from '@/lib/investors/schedule';
import { closureInput, investorMutation } from '@/lib/investors/validation';
import { getCurrentDateISO } from '@/utils/date';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import {
  INVESTOR_FUNDING,
  INVESTOR_RETURN,
  INVESTOR_REPAYMENT,
  InvestorAccountingError,
  investorPostingLines,
  lockInvestorAgreement,
  postInvestorPrincipal,
} from '@/lib/investors/accounting';

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

function failure(error: unknown) {
  if (error instanceof InvestorAccountingError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'That agreement reference or payout payment already exists' },
        { status: 409 }
      );
    }
    if (error.code === 'P2025' || error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Investor or record not found' },
        { status: 404 }
      );
    }
    if (error.code === 'P2021') {
      return NextResponse.json(
        {
          error:
            'Investor database setup is pending. Apply the clothing investor migrations.',
        },
        { status: 503 }
      );
    }
  }
  logger.error('Investor request failed', { error });
  return NextResponse.json(
    { error: 'Unable to process investor records' },
    { status: 500 }
  );
}

export async function GET() {
  const denied = await authorize();
  if (denied) {
    return denied;
  }
  try {
    const [investors, closures, postings = []] = await prisma.$transaction([
      prisma.clothingInvestor.findMany({
        orderBy: { name: 'asc' },
        include: {
          agreements: {
            orderBy: { effectiveDate: 'desc' },
            include: { payments: true },
          },
        },
      }),
      prisma.clothingInvestorBankClosure.findMany({
        where: { deletedAt: null },
        orderBy: { date: 'asc' },
      }),
      prisma.clothingAccountingJournalLine.findMany({
        where: {
          deletedAt: null,
          sourceType: {
            in: [INVESTOR_FUNDING, INVESTOR_RETURN, INVESTOR_REPAYMENT],
          },
          sourceLineKey: 'debit',
        },
        select: { sourceType: true, sourceId: true, date: true },
      }),
    ]);
    return NextResponse.json(
      {
        investors: investors.map((investor) => ({
          ...investor,
          agreements: investor.agreements.map((agreement) => {
            const schedule = buildInvestmentSchedule(
              {
                effectiveDate: agreement.effectiveDate,
                principalCents: agreement.principal.mul(100).toNumber(),
                monthlyRateBps: agreement.monthlyRateBps,
              },
              closures.map((closure) => closure.date)
            );
            const paymentsByMonth = new Map(
              agreement.payments.map((payment) => [payment.month, payment])
            );
            return {
              ...agreement,
              principal: agreement.principal.toFixed(2),
              accounting: {
                fundedDate:
                  postings
                    .find(
                      (line) =>
                        line.sourceType === INVESTOR_FUNDING &&
                        line.sourceId === agreement.id
                    )
                    ?.date.toISOString()
                    .slice(0, 10) ?? null,
                repaidDate:
                  postings
                    .find(
                      (line) =>
                        line.sourceType === INVESTOR_REPAYMENT &&
                        line.sourceId === agreement.id
                    )
                    ?.date.toISOString()
                    .slice(0, 10) ?? null,
                unpostedPayments: agreement.payments.filter(
                  (payment) =>
                    !postings.some(
                      (line) =>
                        line.sourceType === INVESTOR_RETURN &&
                        line.sourceId === payment.id
                    )
                ).length,
              },
              schedule: {
                ...schedule,
                payouts: schedule.payouts.map((payout) => {
                  const payment = paymentsByMonth.get(payout.month);
                  return {
                    ...payout,
                    payment: payment
                      ? {
                          amount: payment.amount.toFixed(2),
                          paidDate: payment.paidDate,
                        }
                      : null,
                  };
                }),
              },
            };
          }),
        })),
        closures,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    return failure(error);
  }
}

async function mutate(request: NextRequest, editing: boolean) {
  const denied = await authorize();
  if (denied) {
    return denied;
  }
  const result = investorMutation.safeParse(
    await request.json().catch(() => null)
  );
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message || 'Invalid input' },
      { status: 400 }
    );
  }
  const payload = result.data;
  if (['payment', 'funding', 'repayment'].includes(payload.kind) && editing) {
    return NextResponse.json(
      { error: 'Payout payments can only be recorded once' },
      { status: 400 }
    );
  }
  if (
    payload.kind !== 'closure' &&
    payload.kind !== 'payment' &&
    payload.kind !== 'funding' &&
    payload.kind !== 'repayment' &&
    editing !== Boolean(payload.id)
  ) {
    return NextResponse.json(
      { error: 'Record ID does not match request method' },
      { status: 400 }
    );
  }
  try {
    if (payload.kind === 'funding' || payload.kind === 'repayment') {
      const cutover = await getRuntimeAccountingCutoverDate();
      const record = await prisma.$transaction((transaction) =>
        postInvestorPrincipal(
          transaction,
          { ...payload.data, kind: payload.kind },
          cutover
        )
      );
      return NextResponse.json(record, { status: 201 });
    }
    if (payload.kind === 'payment') {
      const cutover = await getRuntimeAccountingCutoverDate();
      return await prisma.$transaction(async (transaction) => {
        await lockInvestorAgreement(transaction, payload.data.agreementId);
        const agreement =
          await transaction.clothingInvestmentAgreement.findUnique({
            where: { id: payload.data.agreementId },
          });
        if (!agreement) {
          return NextResponse.json(
            { error: 'Investment agreement not found' },
            { status: 404 }
          );
        }
        const closures = await transaction.clothingInvestorBankClosure.findMany(
          {
            where: { deletedAt: null },
            select: { date: true },
          }
        );
        const schedule = buildInvestmentSchedule(
          {
            effectiveDate: agreement.effectiveDate,
            principalCents: agreement.principal.mul(100).toNumber(),
            monthlyRateBps: agreement.monthlyRateBps,
          },
          closures.map((closure) => closure.date)
        );
        const payout = schedule.payouts.find(
          (item) => item.month === payload.data.month
        );
        if (!payout || payout.status !== 'scheduled' || !payout.dueDate) {
          return NextResponse.json(
            { error: 'This agreement month has no payable return' },
            { status: 400 }
          );
        }
        if (
          new Prisma.Decimal(payload.data.amount).mul(100).toNumber() !==
          payout.amountCents
        ) {
          return NextResponse.json(
            {
              error:
                'Payment amount must match the projected return; partial payouts are not supported',
            },
            { status: 400 }
          );
        }
        const today = getCurrentDateISO();
        if (payout.dueDate > today) {
          return NextResponse.json(
            { error: 'A payout cannot be recorded before its banking date' },
            { status: 400 }
          );
        }
        if (
          payload.data.paidDate > today ||
          payload.data.paidDate < agreement.effectiveDate
        ) {
          return NextResponse.json(
            {
              error:
                'Enter a payment date within the agreement and not in the future',
            },
            { status: 400 }
          );
        }
        const principalPostings =
          await transaction.clothingAccountingJournalLine.findMany({
            where: {
              sourceId: agreement.id,
              sourceType: { in: [INVESTOR_FUNDING, INVESTOR_REPAYMENT] },
              deletedAt: null,
            },
          });
        const funding = principalPostings.find(
          (line) => line.sourceType === INVESTOR_FUNDING
        );
        const repayment = principalPostings.find(
          (line) => line.sourceType === INVESTOR_REPAYMENT
        );
        if (
          funding &&
          payload.data.paidDate < funding.date.toISOString().slice(0, 10)
        ) {
          throw new InvestorAccountingError(
            'Return payment cannot precede recorded funding'
          );
        }
        if (
          repayment &&
          payload.data.paidDate < repayment.date.toISOString().slice(0, 10)
        ) {
          throw new InvestorAccountingError(
            'Historical returns before principal repayment require review'
          );
        }
        const lines = investorPostingLines({
          kind: 'return',
          agreementId: agreement.id,
          reference: agreement.reference,
          sourceId: '',
          amount: new Prisma.Decimal(payload.data.amount),
          date: payload.data.paidDate,
          cutover,
        });
        const payment = await transaction.clothingInvestmentPayment.create({
          data: payload.data,
        });
        await transaction.clothingAccountingJournalLine.createMany({
          data: lines.map((line) => ({ ...line, sourceId: payment.id })),
        });
        return NextResponse.json({ id: payment.id }, { status: 201 });
      });
    }
    if (payload.kind === 'investor') {
      const record = payload.id
        ? await prisma.clothingInvestor.update({
            where: { id: payload.id },
            data: payload.data,
          })
        : await prisma.clothingInvestor.create({ data: payload.data });
      return NextResponse.json(
        { id: record.id },
        { status: editing ? 200 : 201 }
      );
    }
    if (payload.kind === 'agreement') {
      return await prisma.$transaction(async (transaction) => {
        if (payload.id) {
          await lockInvestorAgreement(transaction, payload.id);
          const existing =
            await transaction.clothingInvestmentAgreement.findUnique({
              where: { id: payload.id },
              include: { _count: { select: { payments: true } } },
            });
          if (!existing) {
            return NextResponse.json(
              { error: 'Investor or record not found' },
              { status: 404 }
            );
          }
          const termsChanged =
            existing.effectiveDate !== payload.data.effectiveDate ||
            !existing.principal.equals(payload.data.principal) ||
            existing.monthlyRateBps !== payload.data.monthlyRateBps ||
            existing.investorId !== payload.data.investorId ||
            existing.reference !== payload.data.reference;
          const postingCount =
            await transaction.clothingAccountingJournalLine.count({
              where: {
                sourceId: payload.id,
                sourceType: { in: [INVESTOR_FUNDING, INVESTOR_REPAYMENT] },
              },
            });
          if (
            (existing._count.payments > 0 || postingCount > 0) &&
            termsChanged
          ) {
            return NextResponse.json(
              {
                error:
                  'Agreement terms cannot change after funding or a payout is recorded',
              },
              { status: 409 }
            );
          }
        }
        const record = payload.id
          ? await transaction.clothingInvestmentAgreement.update({
              where: { id: payload.id },
              data: payload.data,
            })
          : await transaction.clothingInvestmentAgreement.create({
              data: payload.data,
            });
        return NextResponse.json(
          { id: record.id },
          { status: editing ? 200 : 201 }
        );
      });
    }
    const record = await prisma.clothingInvestorBankClosure.upsert({
      where: { date: payload.data.date },
      create: payload.data,
      update: { name: payload.data.name, deletedAt: null },
    });
    return NextResponse.json({ id: record.id });
  } catch (error) {
    return failure(error);
  }
}

export const POST = (request: NextRequest) => mutate(request, false);
export const PUT = (request: NextRequest) => mutate(request, true);

export async function DELETE(request: NextRequest) {
  const denied = await authorize();
  if (denied) {
    return denied;
  }
  const result = closureInput
    .pick({ date: true })
    .safeParse(await request.json().catch(() => null));
  if (!result.success) {
    return NextResponse.json(
      { error: 'Invalid bank closure date' },
      { status: 400 }
    );
  }
  try {
    await prisma.clothingInvestorBankClosure.update({
      where: { date: result.data.date },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
