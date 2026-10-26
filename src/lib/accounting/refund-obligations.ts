import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { dayjs, getCurrentDateISO, toISODate } from '@/utils/date';
import { FinancialOperationError } from './financial-transactions';

export async function getRefundObligations(
  asOf = getCurrentDateISO(),
  from?: string
) {
  if (
    toISODate(asOf) !== asOf ||
    asOf > getCurrentDateISO() ||
    (from && (toISODate(from) !== from || from > asOf))
  ) {
    throw new FinancialOperationError(
      'Use valid refund dates through today.',
      400
    );
  }
  const decisions = await prisma.clothingOrderCancellation.findMany({
    where: { decisionDate: { lte: asOf } },
    include: {
      transaction: {
        select: {
          id: true,
          customerId: true,
          customers: true,
          productCode: true,
        },
      },
      payouts: {
        where: { paymentDate: { lte: asOf } },
        orderBy: [{ paymentDate: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: [{ decisionDate: 'asc' }, { createdAt: 'asc' }],
  });

  let pendingTotal = new Prisma.Decimal(0);
  let paidApprovedRefundTotal = new Prisma.Decimal(0);
  let retainedDepositTotal = new Prisma.Decimal(0);
  const paidRefundTrends = new Map<string, Prisma.Decimal>();
  const history = decisions.map((decision) => {
    const paid = decision.payouts.reduce(
      (sum, payout) => sum.plus(payout.amount),
      new Prisma.Decimal(0)
    );
    const pending = decision.approvedRefundAmount.minus(paid);
    if (pending.isNegative()) {
      throw new FinancialOperationError(
        'A refund history exceeds its approval. Administrator review required.'
      );
    }
    decision.payouts.forEach((payout) => {
      if (!from || payout.paymentDate >= from) {
        paidApprovedRefundTotal = paidApprovedRefundTotal.plus(payout.amount);
        const month = payout.paymentDate.slice(0, 7);
        paidRefundTrends.set(
          month,
          (paidRefundTrends.get(month) ?? new Prisma.Decimal(0)).plus(
            payout.amount
          )
        );
      }
    });
    if (!from || decision.decisionDate >= from) {
      retainedDepositTotal = retainedDepositTotal.plus(decision.retainedAmount);
    }
    pendingTotal = pendingTotal.plus(pending);
    return {
      id: decision.id,
      transactionId: decision.transactionId,
      customerId: decision.transaction.customerId,
      customerName: decision.transaction.customers ?? 'Unknown customer',
      productCode: decision.transaction.productCode,
      kind: decision.kind,
      decisionDate: decision.decisionDate,
      reason: decision.reason,
      createdBy: decision.createdBy,
      approvedAmount: decision.approvedRefundAmount.toNumber(),
      paidAmount: paid.toNumber(),
      pendingAmount: pending.toNumber(),
      ageDays: dayjs(asOf)
        .startOf('day')
        .diff(dayjs(decision.decisionDate).startOf('day'), 'day'),
      payouts: decision.payouts.map((payout) => ({
        id: payout.id,
        refundId: payout.refundId,
        amount: payout.amount.toNumber(),
        paymentDate: payout.paymentDate,
        method: payout.method,
        createdBy: payout.createdBy,
      })),
    };
  });
  const items = history.filter((decision) => decision.pendingAmount > 0);

  return {
    scope: 'clothing' as const,
    asOf,
    from: from ?? null,
    pendingAmount: pendingTotal.toNumber(),
    transactionCount: items.length,
    oldestAgeDays: items.reduce(
      (oldest, item) => Math.max(oldest, item.ageDays),
      0
    ),
    paidApprovedRefundAmount: paidApprovedRefundTotal.toNumber(),
    retainedDepositAmount: retainedDepositTotal.toNumber(),
    paidRefundTrends: Array.from(paidRefundTrends, ([month, amount]) => ({
      month,
      amount: amount.toNumber(),
    })).sort((left, right) => left.month.localeCompare(right.month)),
    items,
    history,
  };
}

export type RefundObligations = Awaited<
  ReturnType<typeof getRefundObligations>
>;
