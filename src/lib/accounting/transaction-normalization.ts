export type TransactionAmountInputs = {
  quantity?: number | null;
  unitPrice?: number | null;
  discount?: number | null;
  adjustment?: number | null;
  lineTotal?: number | null;
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
