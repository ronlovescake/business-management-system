import type { PrismaClient, Transaction } from '@prisma/client';

export function buildTransactionUpdateMessage(params: {
  id: number;
  transaction: Transaction;
  changes: string[];
}): string {
  const { id, transaction, changes } = params;

  let message = `Updated transaction #${id}`;
  if (transaction.customers && transaction.productCode) {
    message += ` - ${transaction.customers} (${transaction.productCode})`;
  } else if (transaction.customers) {
    message += ` - ${transaction.customers}`;
  } else if (transaction.productCode) {
    message += ` - (${transaction.productCode})`;
  }

  if (changes.length > 0) {
    message += ` - Modified: ${changes.join(', ')}`;
  }

  return message;
}

export async function fetchExistingTransaction(
  delegate: PrismaClient['transaction'],
  id: number
) {
  return delegate.findUnique({
    where: { id },
    select: {
      orderDate: true,
      customers: true,
      productCode: true,
      quantity: true,
      unitPrice: true,
      discount: true,
      adjustment: true,
      lineTotal: true,
      orderStatus: true,
      notes: true,
      invoiceDate: true,
      packedDate: true,
      shipmentCode: true,
    },
  });
}
