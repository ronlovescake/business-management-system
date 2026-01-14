export type TransactionAmountInputs = {
  quantity?: number | null;
  unitPrice?: number | null;
  discount?: number | null;
  adjustment?: number | null;
  lineTotal?: number | null;
};

export type TransactionAccountingAmountInputs = TransactionAmountInputs & {
  orderStatus?: string | null;
};

export type NormalizedTransactionAmounts = {
  grossSale: number;
  paymentReceived: number;
  balanceDue: number;
};

function toFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number') {
    return null;
  }
  return Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Normalizes transaction money fields for accounting.
 *
 * Current business semantics (per ops workflow):
 * - `adjustment` is treated as payment received (cash basis)
 * - `lineTotal` is treated as remaining balance (computed as qty * unitPrice - adjustment)
 * - `unitPrice` already reflects any discount applied at entry time
 */
export function normalizeTransactionAmounts(
  tx: TransactionAmountInputs
): NormalizedTransactionAmounts {
  const quantity = toFiniteNumber(tx.quantity) ?? 0;
  const unitPrice = toFiniteNumber(tx.unitPrice) ?? 0;

  const grossSale = Number.isFinite(quantity * unitPrice)
    ? quantity * unitPrice
    : 0;

  const explicitPayment = toFiniteNumber(tx.adjustment);
  const explicitBalance = toFiniteNumber(tx.lineTotal);

  // If lineTotal is the remaining balance, we can safely derive payment received.
  const derivedPayment =
    explicitBalance !== null && grossSale > 0
      ? clamp(grossSale - explicitBalance, 0, grossSale)
      : null;

  const paymentReceived = explicitPayment ?? derivedPayment ?? 0;

  const derivedBalance = grossSale - paymentReceived;
  const balanceDue =
    explicitBalance ?? (Number.isFinite(derivedBalance) ? derivedBalance : 0);

  return {
    grossSale,
    paymentReceived,
    balanceDue,
  };
}

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? '').trim();
}

function isPaidForAccounting(status: string | null | undefined): boolean {
  const normalized = normalizeStatus(status);
  return (
    normalized === 'Checked Out' ||
    normalized === 'Shipped' ||
    normalized === 'Ready For Dispatch'
  );
}

function isPendingPaymentForAccounting(
  status: string | null | undefined
): boolean {
  return normalizeStatus(status) === 'Pending Payment';
}

/**
 * Accounting-specific normalization.
 *
 * Current ops semantics:
 * - Paid statuses should represent fully paid orders; use `grossSale` as cash.
 * - Pending Payment represents reservation/deposit flows; use `adjustment` (cash received) and derive balance.
 *
 * This intentionally reduces reliance on a manually-entered Adjustment value *when an order is marked paid*.
 */
export function normalizeTransactionAmountsForAccounting(
  tx: TransactionAccountingAmountInputs
): NormalizedTransactionAmounts {
  const quantity = toFiniteNumber(tx.quantity) ?? 0;
  const unitPrice = toFiniteNumber(tx.unitPrice) ?? 0;
  const grossSale = Number.isFinite(quantity * unitPrice)
    ? quantity * unitPrice
    : 0;

  if (isPaidForAccounting(tx.orderStatus)) {
    const paid = Math.max(grossSale, 0);
    return { grossSale: paid, paymentReceived: paid, balanceDue: 0 };
  }

  // Pending Payment: treat Adjustment as cash received and compute the remaining balance.
  if (isPendingPaymentForAccounting(tx.orderStatus)) {
    const adjustment = toFiniteNumber(tx.adjustment) ?? 0;
    const paymentReceived = clamp(adjustment, 0, Math.max(grossSale, 0));
    const balanceDue = Math.max(grossSale - paymentReceived, 0);
    return { grossSale, paymentReceived, balanceDue };
  }

  // Default behavior for other statuses.
  return normalizeTransactionAmounts(tx);
}
