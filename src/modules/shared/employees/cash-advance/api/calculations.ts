export function calculateCashAdvanceMonthlyPayment(
  amount: number,
  termsMonths: number | null | undefined
): number | undefined {
  if (!termsMonths || termsMonths <= 0) {
    return undefined;
  }

  const payment = amount / termsMonths;
  if (!Number.isFinite(payment) || payment <= 0) {
    return undefined;
  }

  return Number(payment.toFixed(2));
}

export function calculateCashAdvanceRemainingBalance(
  amount: number,
  settledAmount: number
): number {
  return Number(Math.max(amount - settledAmount, 0).toFixed(2));
}
