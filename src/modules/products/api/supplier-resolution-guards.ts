import type { Prisma, Product } from '@prisma/client';

export class SupplierResolutionError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 = 409
  ) {
    super(message);
    this.name = 'SupplierResolutionError';
  }
}

export function assertSupplierFundingWrite(
  existing: Partial<Product>,
  next: (Prisma.ProductCreateInput & { paymentCardId?: string | null }) | null
) {
  if (
    existing.supplierFulfillmentStatus !== 'CREDIT_ISSUED' &&
    Number(existing.supplierCreditAppliedAmount ?? 0) === 0
  ) {
    return;
  }
  if (!next) {
    throw new SupplierResolutionError(
      'Supplier-credit products cannot be deleted. Preserve their funding history.'
    );
  }
  const fields = [
    'grandTotal',
    'quantity',
    'unitPrice',
    'exchangeRates',
    'alibabaShippingCost',
    'transactionFee',
    'postingDate',
    'orderDate',
    'supplierReference',
  ] as const;
  for (const field of fields) {
    if (
      field in next &&
      String(next[field as keyof Prisma.ProductCreateInput] ?? '') !==
        String(existing[field] ?? '')
    ) {
      throw new SupplierResolutionError(
        'Reverse the supplier-credit funding through an approved correction before changing its purchase basis.'
      );
    }
  }
  const fundingLocked =
    existing.supplierFulfillmentStatus === 'CREDIT_ISSUED' ||
    existing.payment?.trim().toLowerCase() === 'paid';
  const nextCardId =
    'paymentCardId' in next
      ? next.paymentCardId
      : next.paymentCard?.connect?.id;
  if (
    fundingLocked &&
    ((next.paymentMethod !== undefined &&
      next.paymentMethod !== existing.paymentMethod) ||
      (nextCardId !== undefined && nextCardId !== existing.paymentCardId))
  ) {
    throw new SupplierResolutionError(
      'The posted supplier payment method and card must be preserved.'
    );
  }
  if (
    fundingLocked &&
    next.payment !== undefined &&
    next.payment?.trim().toLowerCase() !==
      existing.payment?.trim().toLowerCase()
  ) {
    throw new SupplierResolutionError(
      'The original payment on a nonfulfilled purchase must be preserved.'
    );
  }
}
