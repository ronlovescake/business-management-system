export function getPaymentAccountForMethod(
  paymentMethod: string | null | undefined
): string | null {
  switch ((paymentMethod ?? '').trim().toUpperCase()) {
    case 'CASH':
      return 'Cash';
    case 'BANK':
    case 'BANK TRANSFER':
      return 'Bank';
    case 'GCASH':
      return 'GCash';
    case 'CHECK':
      return 'Bank';
    case 'CARD':
      return 'Credit Card Payable';
    default:
      return null;
  }
}

export function getSupplierSettlementCreditAccount(
  paymentMethod: string | null | undefined
): string | null {
  return getPaymentAccountForMethod(paymentMethod);
}

export function getExpenseCreditAccount(expense: {
  status: string;
  paymentMethod?: string | null;
}): string {
  if (expense.status.trim().toLowerCase() === 'approved') {
    return 'Accounts Payable';
  }

  return getPaymentAccountForMethod(expense.paymentMethod) ?? 'Cash';
}
