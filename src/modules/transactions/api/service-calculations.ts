import { Prisma, type Transaction } from '@prisma/client';
import { PAID_STATUSES } from '@/lib/accounting/constants';
import {
  isCancelledOrderStatus,
  isClothingAccountsReceivableStatus,
} from '@/lib/transactions/order-status';
import type { TransactionUpdateRecord } from './sanitizers';

export type ExistingTransactionForPaidStatusCheck = Pick<
  Transaction,
  'lineTotal' | 'quantity' | 'unitPrice' | 'discount' | 'adjustment'
>;

export function normalizeStatus(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function isPaidStatus(value: string | null | undefined): boolean {
  const normalized = normalizeStatus(value);
  return PAID_STATUSES.some((status) => normalizeStatus(status) === normalized);
}

export function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function computeRemainingBalance(params: {
  lineTotal: unknown;
  quantity: unknown;
  unitPrice: unknown;
  discount: unknown;
  adjustment: unknown;
}): number {
  const lineTotal =
    params.lineTotal === null ||
    params.lineTotal === undefined ||
    (typeof params.lineTotal === 'string' && params.lineTotal.trim() === '')
      ? Number.NaN
      : toFiniteNumber(params.lineTotal, Number.NaN);
  if (Number.isFinite(lineTotal)) {
    return lineTotal;
  }

  const quantity = toFiniteNumber(params.quantity, 0);
  const unitPrice = toFiniteNumber(params.unitPrice, 0);
  const adjustment = toFiniteNumber(params.adjustment, 0);

  return quantity * unitPrice - adjustment;
}

export function computeLineTotalForUpdate(params: {
  existing: ExistingTransactionForPaidStatusCheck;
  updateValues: TransactionUpdateRecord['values'];
}): number {
  const quantity = toFiniteNumber(
    params.updateValues.Quantity ?? params.existing.quantity,
    0
  );
  const unitPrice = toFiniteNumber(
    params.updateValues['Unit Price'] ?? params.existing.unitPrice,
    0
  );
  const adjustment = toFiniteNumber(
    params.updateValues.Adjustment ?? params.existing.adjustment,
    0
  );

  return quantity * unitPrice - adjustment;
}

export function computeOriginalDepositAgreement(params: {
  quantity: number;
  unitPrice: number;
  incomingAmount: number;
  recordedPayments: number;
  isReservation: boolean;
  originalDepositRate?: 10 | 20;
  initialDepositAmount?: Prisma.Decimal | null;
}):
  | {
      initialDepositAmount?: Prisma.Decimal;
      initialDepositRate?: Prisma.Decimal;
    }
  | { validationError: string } {
  if (!params.isReservation) {
    return params.originalDepositRate === undefined
      ? {}
      : {
          validationError:
            'Only an original Reservation Deposit can set deposit terms.',
        };
  }
  if (
    params.initialDepositAmount !== undefined &&
    params.initialDepositAmount !== null
  ) {
    return {
      validationError:
        'The original deposit is already recorded. Record later payments as installments.',
    };
  }
  if (params.recordedPayments > 0) {
    return {
      validationError:
        'An administrator must confirm historical deposit terms separately. Record this payment as an installment.',
    };
  }
  if (params.originalDepositRate !== 10 && params.originalDepositRate !== 20) {
    return {
      validationError:
        'Choose the agreed original Reservation Deposit of 10% or 20%.',
    };
  }
  const amount = new Prisma.Decimal(params.quantity)
    .mul(params.unitPrice)
    .mul(params.originalDepositRate)
    .div(100)
    .toDecimalPlaces(2);
  if (
    !amount.gt(0) ||
    !amount.eq(new Prisma.Decimal(params.incomingAmount).toDecimalPlaces(2))
  ) {
    return {
      validationError:
        'The original deposit must equal the agreed percentage of the order total. Record other collections as installments.',
    };
  }
  return {
    initialDepositAmount: amount,
    initialDepositRate: new Prisma.Decimal(params.originalDepositRate),
  };
}

export function computeCollectionBalance(params: {
  transactionId: number;
  quantity: number;
  unitPrice: number;
  adjustment?: number | null;
  orderStatus?: string | null;
  recordedPayments: number;
  incomingAmount: number;
  isReservation: boolean;
}):
  | { adjustment: number; lineTotal: number; orderStatus: string | null }
  | { validationError: string } {
  const values = [
    params.quantity,
    params.unitPrice,
    params.adjustment ?? 0,
    params.recordedPayments,
    params.incomingAmount,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0)) {
    return {
      validationError: 'Payment history or order amounts require review.',
    };
  }
  if (isCancelledOrderStatus(params.orderStatus)) {
    return {
      validationError: 'Canceled or voided orders cannot receive new payments.',
    };
  }
  if (
    params.isReservation &&
    isClothingAccountsReceivableStatus(params.orderStatus)
  ) {
    return {
      validationError:
        'Accounts Receivable collections cannot be recorded as reservation deposits.',
    };
  }

  const gross = new Prisma.Decimal(params.quantity)
    .mul(params.unitPrice)
    .toDecimalPlaces(2);
  const recorded = new Prisma.Decimal(params.recordedPayments).toDecimalPlaces(
    2
  );
  const legacyPaid = new Prisma.Decimal(params.adjustment ?? 0).toDecimalPlaces(
    2
  );
  if (legacyPaid.gt(recorded)) {
    return {
      validationError: `Transaction ${params.transactionId} has a legacy paid amount not explained by payment history. Review it before collecting more money.`,
    };
  }
  const incoming = new Prisma.Decimal(params.incomingAmount).toDecimalPlaces(2);
  if (!incoming.gt(0)) {
    return {
      validationError: 'Provide a positive payment amount after rounding.',
    };
  }
  const paid = recorded.add(incoming);
  if (paid.gt(gross)) {
    return {
      validationError: `Payment exceeds the remaining balance for transaction ${params.transactionId}.`,
    };
  }
  const balance = gross.sub(paid);
  return {
    adjustment: paid.toNumber(),
    lineTotal: balance.toNumber(),
    orderStatus:
      isClothingAccountsReceivableStatus(params.orderStatus) && balance.isZero()
        ? 'Shipped'
        : (params.orderStatus ?? null),
  };
}
