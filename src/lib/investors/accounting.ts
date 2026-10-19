import type { Prisma } from '@prisma/client';
import { buildInvestmentSchedule, isCalendarDate } from './schedule';
import { getCurrentDateISO } from '@/utils/date';

export const INVESTOR_FUNDING = 'INVESTOR_FUNDING';
export const INVESTOR_RETURN = 'INVESTOR_RETURN';
export const INVESTOR_REPAYMENT = 'INVESTOR_REPAYMENT';

export class InvestorAccountingError extends Error {}

export function investorPostingLines(input: {
  kind: 'funding' | 'return' | 'repayment';
  agreementId: string;
  reference: string;
  sourceId: string;
  amount: Prisma.Decimal;
  date: string;
  cutover: Date;
}) {
  const date = new Date(`${input.date}T00:00:00Z`);
  if (
    !isCalendarDate(input.date) ||
    input.date > getCurrentDateISO() ||
    date < input.cutover
  ) {
    throw new InvestorAccountingError(
      `Posting date must be on or after ${input.cutover.toISOString().slice(0, 10)} and not in the future. Review older movements in opening balances.`
    );
  }
  if (!input.amount.isPositive() || input.amount.decimalPlaces() > 2) {
    throw new InvestorAccountingError(
      'Enter a positive amount with at most two decimals'
    );
  }
  const liability = `Loan Payable - Investor ${input.agreementId}`;
  const accounts = {
    funding: ['Cash', liability],
    return: ['Investor Return Expense', 'Cash'],
    repayment: [liability, 'Cash'],
  }[input.kind];
  const sourceType = {
    funding: INVESTOR_FUNDING,
    return: INVESTOR_RETURN,
    repayment: INVESTOR_REPAYMENT,
  }[input.kind];
  return accounts.map((account, index) => ({
    date,
    ref: `INV-${input.reference}`,
    account,
    debit: index === 0 ? input.amount.toNumber() : 0,
    credit: index === 1 ? input.amount.toNumber() : 0,
    description: `Investor ${input.kind}: ${input.reference}`,
    sourceType,
    sourceId: input.sourceId,
    sourceLineKey: index === 0 ? 'debit' : 'credit',
    systemGenerated: true,
  }));
}

export async function lockInvestorAgreement(
  transaction: Prisma.TransactionClient,
  agreementId: string
) {
  await transaction.$queryRaw`
    SELECT "id" FROM "public"."ClothingInvestmentAgreement"
    WHERE "id" = ${agreementId} FOR UPDATE
  `;
}

export async function postInvestorPrincipal(
  transaction: Prisma.TransactionClient,
  input: { agreementId: string; kind: 'funding' | 'repayment'; date: string },
  cutover: Date
) {
  await lockInvestorAgreement(transaction, input.agreementId);
  const agreement = await transaction.clothingInvestmentAgreement.findUnique({
    where: { id: input.agreementId },
  });
  if (!agreement) {
    throw new InvestorAccountingError('Investment agreement not found');
  }
  const postings = await transaction.clothingAccountingJournalLine.findMany({
    where: {
      sourceId: agreement.id,
      sourceType: { in: [INVESTOR_FUNDING, INVESTOR_REPAYMENT] },
    },
  });
  const funding = postings.find((line) => line.sourceType === INVESTOR_FUNDING);
  if (input.kind === 'funding' && funding) {
    throw new InvestorAccountingError('Funding has already been recorded');
  }
  if (input.kind === 'funding') {
    const firstPayment = await transaction.clothingInvestmentPayment.findFirst({
      where: { agreementId: agreement.id },
      orderBy: { paidDate: 'asc' },
    });
    if (firstPayment && input.date > firstPayment.paidDate) {
      throw new InvestorAccountingError(
        'Funding cannot be dated after an existing return; reconcile historical funding first'
      );
    }
  }
  if (input.kind === 'repayment') {
    if (!funding || funding.deletedAt) {
      throw new InvestorAccountingError(
        'Record or reconcile investor funding before repaying investment'
      );
    }
    if (postings.some((line) => line.sourceType === INVESTOR_REPAYMENT)) {
      throw new InvestorAccountingError('Investment has already been repaid');
    }
    const latestPayment = await transaction.clothingInvestmentPayment.findFirst(
      {
        where: { agreementId: agreement.id },
        orderBy: { paidDate: 'desc' },
      }
    );
    if (
      input.date < funding.date.toISOString().slice(0, 10) ||
      (latestPayment && input.date < latestPayment.paidDate)
    ) {
      throw new InvestorAccountingError(
        'Repayment cannot precede funding or a recorded return'
      );
    }
    const schedule = buildInvestmentSchedule({
      effectiveDate: agreement.effectiveDate,
      principalCents: agreement.principal.mul(100).toNumber(),
      monthlyRateBps: agreement.monthlyRateBps,
    });
    if (input.date < schedule.maturityDate) {
      throw new InvestorAccountingError(
        'Investment repayment is available at maturity; early termination requires separate review'
      );
    }
  }
  await transaction.clothingAccountingJournalLine.createMany({
    data: investorPostingLines({
      ...input,
      reference: agreement.reference,
      sourceId: agreement.id,
      amount: agreement.principal,
      cutover,
    }),
  });
  return { id: agreement.id };
}
