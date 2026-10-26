import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { getCurrentDateISO, toISODate } from '@/utils/date';
import { isCancelledOrderStatus } from '@/lib/transactions/order-status';
import { hasAccountsReceivableShipment } from './transaction-recognition';
import { PAID_STATUSES } from './constants';
import {
  FinancialOperationError,
  runFinancialRequest,
  runFinancialTransaction,
} from './financial-transactions';

export const cancellationDecisionSchema = z
  .object({
    kind: z.enum(['CANCELLED', 'VOIDED']),
    mode: z.enum(['RETAIN_DEPOSIT', 'REFUND_ALL']),
    reason: z.string().trim().min(3).max(1000),
    originalDeposit: z
      .object({
        amount: z.number().finite().positive(),
        rate: z.union([z.literal(10), z.literal(20)]),
      })
      .optional(),
  })
  .strict();

export const cancellationPayoutSchema = z
  .object({
    cancellationId: z.string().uuid(),
    amount: z
      .number()
      .finite()
      .positive()
      .refine((amount) => new Prisma.Decimal(amount).decimalPlaces() <= 2),
    paymentDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((date) => toISODate(date) === date),
    method: z.enum(['Cash', 'GCash', 'Bank Transfer', 'Other']),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

type FinancialActor = { id: string; role: string };

export async function getOrderCancellationPreview(transactionId: number) {
  return runFinancialTransaction(async (client) => {
    const order = await client.transaction.findUnique({
      where: { id: transactionId },
      include: { cancellation: true, statusChanges: true },
    });
    if (!order || order.deletedAt) {
      throw new FinancialOperationError('Order not found.', 404);
    }
    const payments = await client.transactionPayment.findMany({
      where: { transactionId, deletedAt: null },
      select: { amount: true },
    });
    const refunds = await client.transactionRefund.findMany({
      where: { transactionId, deletedAt: null },
      select: { amount: true },
    });
    const collected = payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0)
    );
    const priorRefunds = refunds.reduce(
      (sum, refund) => sum.plus(refund.amount),
      new Prisma.Decimal(0)
    );
    return {
      transactionId,
      orderStatus: order.orderStatus,
      grossAmount: new Prisma.Decimal(order.quantity ?? 0)
        .times(order.unitPrice ?? 0)
        .toDecimalPlaces(2)
        .toNumber(),
      collectedAmount: collected.toNumber(),
      priorRefundAmount: priorRefunds.toNumber(),
      initialDepositAmount: order.initialDepositAmount?.toNumber() ?? null,
      initialDepositRate: order.initialDepositRate?.toNumber() ?? null,
      hasReceivableSale: hasAccountsReceivableShipment(order),
      reviewRequired: new Prisma.Decimal(order.adjustment ?? 0).greaterThan(
        collected
      ),
      closed:
        Boolean(order.cancellation) ||
        isCancelledOrderStatus(order.orderStatus),
    };
  });
}

export type OrderCancellationPreview = Awaited<
  ReturnType<typeof getOrderCancellationPreview>
>;

type CancellationAmountsInput = {
  kind: 'CANCELLED' | 'VOIDED';
  mode: 'RETAIN_DEPOSIT' | 'REFUND_ALL';
  grossAmount: number;
  collectedAmount: number;
  priorRefundAmount: number;
  initialDepositAmount: number | null;
  hasReceivableSale: boolean;
};

export function calculateCancellationAmounts(input: CancellationAmountsInput) {
  const money = (value: number) => {
    if (!Number.isFinite(value) || value < 0) {
      throw new FinancialOperationError(
        'The recorded money needs review before cancellation.'
      );
    }
    return new Prisma.Decimal(value).toDecimalPlaces(2);
  };
  const gross = money(input.grossAmount);
  const collected = money(input.collectedAmount);
  const priorRefund = money(input.priorRefundAmount);
  const deposit =
    input.initialDepositAmount === null
      ? null
      : money(input.initialDepositAmount);
  const remaining = collected.minus(priorRefund);

  if (remaining.isNegative()) {
    throw new FinancialOperationError(
      'Recorded refunds exceed collected money. Review the history first.'
    );
  }
  if (deposit?.greaterThan(collected)) {
    throw new FinancialOperationError(
      'The original deposit exceeds recorded collections. Review the history first.'
    );
  }
  if (input.kind === 'VOIDED' && input.mode !== 'REFUND_ALL') {
    throw new FinancialOperationError(
      'Supplier-failed orders cannot retain the customer deposit.',
      400
    );
  }
  if (input.mode === 'RETAIN_DEPOSIT' && deposit === null) {
    throw new FinancialOperationError(
      'An administrator must confirm the original deposit agreement first.'
    );
  }

  const retained =
    input.mode === 'RETAIN_DEPOSIT' ? deposit! : new Prisma.Decimal(0);
  if (retained.greaterThan(remaining)) {
    throw new FinancialOperationError(
      'Earlier refunds leave less than the original deposit. Review the decision.'
    );
  }
  const approved = remaining.minus(retained);
  const receivableCredit = input.hasReceivableSale
    ? Prisma.Decimal.max(gross.minus(collected), 0)
    : new Prisma.Decimal(0);

  return {
    grossAmount: gross.toNumber(),
    collectedAmount: collected.toNumber(),
    priorRefundAmount: priorRefund.toNumber(),
    initialDepositAmount: deposit?.toNumber() ?? null,
    retainedAmount: retained.toNumber(),
    approvedRefundAmount: approved.toNumber(),
    pendingAmount: approved.toNumber(),
    receivableCreditAmount: receivableCredit.toNumber(),
  };
}

export function buildCancellationJournalAmounts(params: {
  collectedAmount: number;
  priorRefundAmount: number;
  openDepositLiability: number;
  receivableCreditAmount: number;
  retainedAmount: number;
  approvedRefundAmount: number;
}) {
  const deposit = new Prisma.Decimal(params.openDepositLiability);
  const revenueReversal = new Prisma.Decimal(params.collectedAmount)
    .minus(params.priorRefundAmount)
    .minus(deposit)
    .plus(params.receivableCreditAmount);
  const balances = [
    { account: 'Customer Deposits', balance: deposit, key: 'deposit-release' },
    {
      account: 'Sales Returns',
      balance: revenueReversal,
      key: 'revenue-reversal',
    },
    {
      account: 'Accounts Receivable',
      balance: new Prisma.Decimal(params.receivableCreditAmount).negated(),
      key: 'debt-cancellation',
    },
    {
      account: 'Forfeited Deposits',
      balance: new Prisma.Decimal(params.retainedAmount).negated(),
      key: 'retained-deposit',
    },
    {
      account: 'Refunds Payable',
      balance: new Prisma.Decimal(params.approvedRefundAmount).negated(),
      key: 'refund-approval',
    },
  ];
  const total = balances.reduce(
    (sum, line) => sum.plus(line.balance),
    new Prisma.Decimal(0)
  );
  if (!total.isZero()) {
    throw new FinancialOperationError(
      'The cancellation posting does not balance. Review the decision.'
    );
  }
  return balances
    .filter((line) => !line.balance.isZero())
    .map((line) => ({
      account: line.account,
      debit: Prisma.Decimal.max(line.balance, 0).toNumber(),
      credit: Prisma.Decimal.max(line.balance.negated(), 0).toNumber(),
      sourceLineKey: line.key,
    }));
}

export async function approveOrderCancellation(
  requestId: string,
  transactionId: number,
  details: z.infer<typeof cancellationDecisionSchema>,
  actor: FinancialActor
) {
  const decision = cancellationDecisionSchema.parse(details);
  return runFinancialRequest(
    requestId,
    'ORDER_CANCELLATION',
    { transactionId, decision, actorId: actor.id },
    async (client) => {
      const order = await client.transaction.findUnique({
        where: { id: transactionId },
        include: { statusChanges: true, cancellation: true },
      });
      if (!order || order.deletedAt) {
        throw new FinancialOperationError('Order not found.', 404);
      }
      if (order.cancellation || isCancelledOrderStatus(order.orderStatus)) {
        throw new FinancialOperationError(
          'This order is already closed. Its existing money history cannot be replaced.'
        );
      }

      const payments = await client.transactionPayment.findMany({
        where: { transactionId, deletedAt: null },
        select: { amount: true, paymentDate: true, isReservation: true },
      });
      const refunds = await client.transactionRefund.findMany({
        where: { transactionId, deletedAt: null },
        select: { amount: true, refundDate: true },
      });
      const collected = payments.reduce(
        (sum, payment) => sum.plus(payment.amount),
        new Prisma.Decimal(0)
      );
      const priorRefunds = refunds.reduce(
        (sum, refund) => sum.plus(refund.amount),
        new Prisma.Decimal(0)
      );
      if (new Prisma.Decimal(order.adjustment ?? 0).greaterThan(collected)) {
        throw new FinancialOperationError(
          'The legacy paid amount is not explained by payment history. An administrator must review it first.'
        );
      }
      const hasReceivableSale = hasAccountsReceivableShipment(order);
      const isAdmin = actor.role === 'ADMIN' || actor.role === 'SUPER_ADMIN';
      if (
        !isAdmin &&
        (collected.greaterThan(0) ||
          hasReceivableSale ||
          decision.originalDeposit)
      ) {
        throw new FinancialOperationError(
          'Only an administrator can decide the money on this order.',
          403
        );
      }

      const decisionDate = getCurrentDateISO();
      const activityDates = [
        ...payments.map((payment) => payment.paymentDate),
        ...refunds.map((refund) => refund.refundDate),
      ];
      if (
        activityDates.some(
          (date) => !toISODate(date) || toISODate(date) > decisionDate
        )
      ) {
        throw new FinancialOperationError(
          'Payment dates need review before this order can be closed.'
        );
      }

      const confirmedDeposit =
        order.initialDepositAmount?.toNumber() ??
        decision.originalDeposit?.amount ??
        null;
      if (
        order.initialDepositAmount &&
        decision.originalDeposit &&
        !order.initialDepositAmount.equals(decision.originalDeposit.amount)
      ) {
        throw new FinancialOperationError(
          'The confirmed original deposit cannot be replaced by this decision.'
        );
      }
      const amounts = calculateCancellationAmounts({
        ...decision,
        grossAmount: new Prisma.Decimal(order.quantity ?? 0)
          .times(order.unitPrice ?? 0)
          .toDecimalPlaces(2)
          .toNumber(),
        collectedAmount: collected.toNumber(),
        priorRefundAmount: priorRefunds.toNumber(),
        initialDepositAmount: confirmedDeposit,
        hasReceivableSale,
      });
      await client.clothingOrderCancellation.create({
        data: {
          id: requestId,
          transactionId,
          kind: decision.kind,
          reason: decision.reason,
          decisionDate,
          previousStatus: order.orderStatus,
          createdBy: actor.id,
          ...amounts,
        },
      });
      const depositWasRecognized =
        hasReceivableSale ||
        PAID_STATUSES.some(
          (status) =>
            status.toLowerCase() === order.orderStatus?.trim().toLowerCase()
        );
      const openDepositLiability = depositWasRecognized
        ? 0
        : payments
            .filter((payment) => payment.isReservation)
            .reduce(
              (sum, payment) => sum.plus(payment.amount),
              new Prisma.Decimal(0)
            )
            .toNumber();
      await client.clothingAccountingJournalLine.createMany({
        data: buildCancellationJournalAmounts({
          ...amounts,
          openDepositLiability,
        }).map((line) => ({
          ...line,
          date: new Date(),
          ref: `TX-${transactionId}`,
          description: decision.reason,
          sourceType: 'CUSTOMER_CANCELLATION',
          sourceId: requestId,
          systemGenerated: true,
        })),
      });
      const nextStatus = decision.kind === 'VOIDED' ? 'Voided' : 'Cancelled';
      await client.transaction.update({
        where: { id: transactionId },
        data: {
          orderStatus: nextStatus,
          lineTotal: 0,
          ...(!order.initialDepositAmount && decision.originalDeposit
            ? {
                initialDepositAmount: decision.originalDeposit.amount,
                initialDepositRate: decision.originalDeposit.rate,
                depositConfirmedAt: new Date(),
                depositConfirmedBy: actor.id,
              }
            : {}),
        },
      });
      await client.transactionStatusChange.create({
        data: {
          transactionId,
          previousStatus: order.orderStatus,
          newStatus: nextStatus,
        },
      });

      const existingSale = await client.inventoryMovement.findFirst({
        where: {
          sourceTransactionId: transactionId,
          movementType: 'sale',
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!existingSale) {
        await client.inventoryMovement.updateMany({
          where: {
            sourceTransactionId: transactionId,
            movementType: 'reserve',
            deletedAt: null,
          },
          data: { deletedAt: new Date() },
        });
      }
      return {
        id: requestId,
        transactionId,
        kind: decision.kind,
        decisionDate,
        reason: decision.reason,
        ...amounts,
      };
    }
  );
}

export async function payApprovedCancellationRefund(
  requestId: string,
  customerId: number,
  details: z.infer<typeof cancellationPayoutSchema>,
  actor: FinancialActor
) {
  const payout = cancellationPayoutSchema.parse(details);
  return runFinancialRequest(
    requestId,
    'CANCELLATION_PAYOUT',
    { customerId, payout, actorId: actor.id },
    async (client) => {
      const cancellation = await client.clothingOrderCancellation.findUnique({
        where: { id: payout.cancellationId },
        include: { transaction: { select: { id: true, customerId: true } } },
      });
      if (!cancellation || cancellation.transaction.customerId !== customerId) {
        throw new FinancialOperationError(
          'Approved refund not found for this customer.',
          404
        );
      }
      if (
        payout.paymentDate < cancellation.decisionDate ||
        payout.paymentDate > getCurrentDateISO()
      ) {
        throw new FinancialOperationError(
          'Use the actual payout date, on or after approval and not in the future.',
          400
        );
      }
      const amount = new Prisma.Decimal(payout.amount);
      const updated = await client.clothingOrderCancellation.updateMany({
        where: { id: cancellation.id, pendingAmount: { gte: amount } },
        data: { pendingAmount: { decrement: amount } },
      });
      if (updated.count !== 1) {
        throw new FinancialOperationError(
          'This payment exceeds the refund still owed. Refresh the customer history.'
        );
      }

      const refund = await client.transactionRefund.create({
        data: {
          transactionId: cancellation.transactionId,
          refundDate: payout.paymentDate,
          amount: payout.amount,
          reason: cancellation.reason,
          notes: payout.notes ?? null,
        },
        select: { id: true },
      });
      await client.clothingRefundPayout.create({
        data: {
          id: requestId,
          cancellationId: cancellation.id,
          refundId: refund.id,
          amount,
          paymentDate: payout.paymentDate,
          method: payout.method,
          createdBy: actor.id,
        },
      });
      return {
        id: requestId,
        refundId: refund.id,
        cancellationId: cancellation.id,
        transactionId: cancellation.transactionId,
        amount: payout.amount,
        paymentDate: payout.paymentDate,
        method: payout.method,
        pendingAmount: cancellation.pendingAmount.minus(amount).toNumber(),
      };
    }
  );
}
