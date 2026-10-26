import { Prisma, type Product } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { parseDate } from '@/lib/accounting/date-utils';
import {
  getPaymentAccountForMethod,
  getSupplierSettlementCreditAccount,
} from '@/lib/accounting/payment-accounts';
import { isFulfilledStatus } from '@/lib/inventory/statuses';
import { SupplierResolutionError } from './supplier-resolution-guards';

export {
  SupplierResolutionError,
  assertSupplierFundingWrite,
} from './supplier-resolution-guards';

export const SUPPLIER_CREDITS_ACCOUNT = 'Supplier Credits';

export function supplierMoney(value: unknown): Prisma.Decimal {
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(String(value ?? 0));
  } catch {
    throw new SupplierResolutionError(
      'Amounts must be finite and nonnegative.',
      400
    );
  }
  if (
    !amount.isFinite() ||
    amount.isNegative() ||
    amount.gt(Number.MAX_SAFE_INTEGER / 100)
  ) {
    throw new SupplierResolutionError(
      'Amounts must be finite and nonnegative.',
      400
    );
  }
  return amount.toDecimalPlaces(2);
}

function supplierKey(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!normalized || normalized.length > 200) {
    throw new SupplierResolutionError(
      'Provide a supplier reference of at most 200 characters.',
      400
    );
  }
  return normalized;
}

export async function supplierOperationsUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new SupplierResolutionError('Authentication required.', 401);
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw new SupplierResolutionError(
      'Only an administrator may resolve supplier nonfulfillment or apply credit.',
      403
    );
  }
  return user;
}

function accountingDate(value: string): Date {
  const date = parseDate(value);
  const today = new Date();
  today.setUTCHours(23, 59, 59, 999);
  if (
    !date ||
    date < getAccountingCutoverDate() ||
    date > today ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      date.toISOString().slice(0, 10) !== value)
  ) {
    throw new SupplierResolutionError(
      'Use a valid posting date on or after cutover and no later than today.',
      400
    );
  }
  return date;
}

async function activeProduct(tx: Prisma.TransactionClient, productId: number) {
  const product = await tx.product.findUnique({ where: { id: productId } });
  if (!product || product.deletedAt) {
    throw new SupplierResolutionError('Product not found.', 404);
  }
  if (product.supplierFulfillmentStatus !== 'ACTIVE') {
    throw new SupplierResolutionError(
      'This product has already been resolved as supplier nonfulfillment.'
    );
  }
  if (!Number.isFinite(product.quantity) || product.quantity <= 0) {
    throw new SupplierResolutionError(
      'A finite, positive product quantity is required for supplier resolution.',
      400
    );
  }
  return product;
}

async function assertUnreceived(
  tx: Prisma.TransactionClient,
  product: Product
) {
  const reclass = await tx.clothingInventoryReclassEntry.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { productId: product.id },
        { productId: null, productCode: product.productCode ?? '' },
      ],
    },
  });
  const physicalMovement = await tx.inventoryMovement.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { productId: product.id },
        { productId: null, productCode: product.productCode ?? '' },
      ],
      AND: [
        {
          OR: [
            {
              toBucket: {
                in: ['sold', 'assembly_wip', 'scrap', 'damaged_hold'],
              },
            },
            { fromBucket: 'sold' },
          ],
        },
      ],
    },
  });
  const transactions = await tx.transaction.findMany({
    where: {
      OR: [
        { productId: product.id },
        { productId: null, productCode: product.productCode ?? '' },
      ],
    },
    select: {
      orderStatus: true,
      shippedAt: true,
      packedDate: true,
      statusChanges: { select: { newStatus: true } },
    },
  });
  const fulfilled = transactions.some(
    (transaction) =>
      transaction.shippedAt ||
      transaction.packedDate ||
      isFulfilledStatus(transaction.orderStatus) ||
      transaction.statusChanges.some((change) =>
        isFulfilledStatus(change.newStatus)
      )
  );
  if (reclass || physicalMovement || fulfilled) {
    throw new SupplierResolutionError(
      'Received, reclassified, assembled, damaged, or sold goods require a separate accounting correction.'
    );
  }
}

async function productBuilds(tx: Prisma.TransactionClient, productId: number) {
  return tx.clothingInventoryTransitBuildEntry.findMany({
    where: {
      idempotencyKey: { startsWith: `PRODUCT_TRANSIT_BUILD:${productId}:` },
    },
    orderBy: { postingDate: 'asc' },
  });
}

async function createAcquisition(
  tx: Prisma.TransactionClient,
  product: Product,
  creditAmount: Prisma.Decimal,
  postingDate: Date
) {
  if (!product.shipmentCode?.trim() || !product.productCode?.trim()) {
    throw new SupplierResolutionError(
      'A product code and shipment code are required before posting supplier funding.',
      400
    );
  }
  const gross = supplierMoney(product.grandTotal);
  const remaining = gross.minus(creditAmount);
  if (gross.lte(0) || remaining.lt(0)) {
    throw new SupplierResolutionError(
      'Credit cannot exceed the positive product Grand Total.',
      400
    );
  }
  const paid = product.payment?.trim().toLowerCase() === 'paid';
  if (!paid && product.payment?.trim().toLowerCase() !== 'unpaid') {
    throw new SupplierResolutionError(
      'Choose Paid or Unpaid for the product.',
      400
    );
  }
  const fundingAccount = paid
    ? getPaymentAccountForMethod(product.paymentMethod)
    : 'Supplier Payable';
  if (remaining.gt(0) && !fundingAccount) {
    throw new SupplierResolutionError(
      'Select a supported method for the remaining supplier payment.',
      400
    );
  }
  const mixed = await tx.clothingInventoryTransitBuildEntry.findFirst({
    where: {
      shipmentCode: product.shipmentCode,
      deletedAt: null,
      idempotencyKey: { not: { startsWith: 'PRODUCT_TRANSIT_BUILD:' } },
    },
  });
  if (mixed) {
    throw new SupplierResolutionError(
      'Resolve the shipment-origin build before posting product-origin funding.'
    );
  }
  const components = [
    { component: 'GRAND_TOTAL', amount: remaining, account: fundingAccount },
    {
      component: 'SUPPLIER_CREDIT',
      amount: creditAmount,
      account: SUPPLIER_CREDITS_ACCOUNT,
    },
  ].filter((component) => component.amount.gt(0));
  for (const component of components) {
    if (!component.account) {
      throw new SupplierResolutionError(
        'A funding account is required for every posted component.',
        400
      );
    }
    await tx.clothingInventoryTransitBuildEntry.create({
      data: {
        shipmentCode: product.shipmentCode,
        postingDate,
        amount: component.amount.toNumber(),
        debitAccount: 'Inventory in Transit',
        creditAccount: component.account,
        idempotencyKey: `PRODUCT_TRANSIT_BUILD:${product.id}:${component.component}`,
        notes: `Product #${product.id} | Code: ${product.productCode} | Supplier funding: ${component.component}`,
      },
    });
  }
}

export async function transferSupplierProduct(input: {
  productId: number;
  shipmentCode: string;
  reason: string;
  requestId: string;
}) {
  const user = await supplierOperationsUser();
  return prisma.$transaction(
    async (tx) => {
      const replay = await tx.clothingProductShipmentTransfer.findUnique({
        where: { requestId: input.requestId },
      });
      if (replay) {
        if (
          replay.productId !== input.productId ||
          replay.toShipmentCode.toLowerCase() !==
            input.shipmentCode.trim().toLowerCase() ||
          replay.reason !== input.reason.trim()
        ) {
          throw new SupplierResolutionError(
            'This request ID already belongs to a different transfer.'
          );
        }
        return replay;
      }
      const product = await activeProduct(tx, input.productId);
      await assertUnreceived(tx, product);
      if (
        !product.shipmentCode ||
        product.shipmentCode.trim().toLowerCase() ===
          input.shipmentCode.trim().toLowerCase()
      ) {
        throw new SupplierResolutionError(
          'Select a different shipment for the delayed goods.',
          400
        );
      }
      const shipments = await tx.shipment.findMany({
        where: {
          shipmentCode: {
            equals: input.shipmentCode.trim(),
            mode: 'insensitive',
          },
          deletedAt: null,
        },
      });
      if (shipments.length !== 1) {
        throw new SupplierResolutionError(
          'The destination shipment must identify exactly one active shipment.',
          400
        );
      }
      const destination = shipments[0];
      const destinationCode = destination.shipmentCode;
      if (!destinationCode) {
        throw new SupplierResolutionError(
          'The destination shipment must have a shipment code.',
          400
        );
      }
      const builds = await productBuilds(tx, product.id);
      if (builds.some((build) => build.deletedAt)) {
        throw new SupplierResolutionError(
          'Resolve deleted source entries before transferring this product.'
        );
      }
      const mixed = await tx.clothingInventoryTransitBuildEntry.findFirst({
        where: {
          shipmentCode: {
            in: [product.shipmentCode, destinationCode],
          },
          deletedAt: null,
          idempotencyKey: { not: { startsWith: 'PRODUCT_TRANSIT_BUILD:' } },
        },
      });
      if (mixed) {
        throw new SupplierResolutionError(
          'Shipment-origin accounting must be resolved before transferring one product.'
        );
      }
      await tx.clothingInventoryTransitBuildEntry.updateMany({
        where: { id: { in: builds.map((build) => build.id) }, deletedAt: null },
        data: { shipmentCode: destinationCode, shipmentId: null },
      });
      const audit = await tx.clothingProductShipmentTransfer.create({
        data: {
          productId: product.id,
          fromShipmentCode: product.shipmentCode,
          toShipmentCode: destinationCode,
          reason: input.reason.trim(),
          requestId: input.requestId,
          createdBy: user.id,
        },
      });
      await tx.product.update({
        where: { id: product.id },
        data: {
          shipmentCode: destination.shipmentCode,
          shipmentStatus: destination.shipmentStatus,
        },
      });
      return audit;
    },
    { isolationLevel: 'Serializable' }
  );
}

export async function issueSupplierCredit(input: {
  productId: number;
  supplierReference: string;
  reference: string;
  postingDate: string;
  requestId: string;
}) {
  const user = await supplierOperationsUser();
  const supplier = supplierKey(input.supplierReference);
  const date = accountingDate(input.postingDate);
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.clothingSupplierCredit.findUnique({
        where: { sourceProductId: input.productId },
      });
      if (existing) {
        if (
          existing.supplierReference !== supplier ||
          existing.reference !== input.reference.trim() ||
          existing.postingDate.getTime() !== date.getTime()
        ) {
          throw new SupplierResolutionError(
            'A credit with different details already exists for this product.'
          );
        }
        return existing;
      }
      const product = await activeProduct(tx, input.productId);
      await assertUnreceived(tx, product);
      if (
        !product.productCode?.trim() ||
        !product.shipmentCode?.trim() ||
        product.quantity <= 0
      ) {
        throw new SupplierResolutionError(
          'A positive product quantity, product code, and shipment code are required.',
          400
        );
      }
      if (
        product.supplierReference &&
        supplierKey(product.supplierReference) !== supplier
      ) {
        throw new SupplierResolutionError(
          'The supplier does not match the original product.',
          400
        );
      }
      const amount = supplierMoney(product.grandTotal);
      if (amount.lte(0)) {
        throw new SupplierResolutionError(
          'The missing product must have a positive Grand Total.',
          400
        );
      }
      const mixed = await tx.clothingInventoryTransitBuildEntry.findFirst({
        where: {
          shipmentCode: product.shipmentCode,
          deletedAt: null,
          idempotencyKey: { not: { startsWith: 'PRODUCT_TRANSIT_BUILD:' } },
        },
      });
      if (mixed) {
        throw new SupplierResolutionError(
          'Resolve shipment-origin funding before issuing a product supplier credit.'
        );
      }
      let builds = await productBuilds(tx, product.id);
      if (
        builds.some(
          (build) =>
            build.deletedAt ||
            build.debitAccount !== 'Inventory in Transit' ||
            build.postingDate > date
        )
      ) {
        throw new SupplierResolutionError(
          'Resolve deleted, incompatible, or later-dated source entries before issuing credit.'
        );
      }
      if (!builds.length) {
        if (product.payment?.trim().toLowerCase() !== 'paid') {
          throw new SupplierResolutionError(
            'An unpaid purchase needs a payable cancellation, not a funded supplier-credit asset.'
          );
        }
        const purchaseDate = accountingDate(
          product.postingDate || product.orderDate || ''
        );
        if (purchaseDate > date) {
          throw new SupplierResolutionError(
            'Credit date cannot precede the original purchase posting.',
            400
          );
        }
        await createAcquisition(
          tx,
          product,
          new Prisma.Decimal(0),
          purchaseDate
        );
        builds = await productBuilds(tx, product.id);
      }
      const sourceAmount = builds.reduce(
        (sum, build) => sum.plus(supplierMoney(build.amount)),
        new Prisma.Decimal(0)
      );
      if (!sourceAmount.equals(amount)) {
        throw new SupplierResolutionError(
          'Posted source cost differs from the product Grand Total. Reconcile that difference first.'
        );
      }
      const payable = builds
        .filter((build) =>
          ['Supplier Payable', 'Accounts Payable'].includes(build.creditAccount)
        )
        .reduce(
          (sum, build) => sum.plus(supplierMoney(build.amount)),
          new Prisma.Decimal(0)
        );
      if (payable.gt(0)) {
        const settlements = await tx.clothingAccountingJournalLine.findMany({
          where: {
            sourceType: 'PRODUCT',
            sourceId: String(product.id),
            sourceLineKey: {
              in: ['SUPPLIER_SETTLEMENT:debit', 'SUPPLIER_SETTLEMENT:credit'],
            },
            deletedAt: null,
          },
        });
        const debit = settlements.find(
          (line) => line.sourceLineKey === 'SUPPLIER_SETTLEMENT:debit'
        );
        const credit = settlements.find(
          (line) => line.sourceLineKey === 'SUPPLIER_SETTLEMENT:credit'
        );
        if (
          !debit ||
          !credit ||
          !['Supplier Payable', 'Accounts Payable'].includes(debit.account) ||
          !supplierMoney(debit.debit).equals(payable) ||
          Number(debit.credit) !== 0 ||
          !supplierMoney(credit.credit).equals(payable) ||
          Number(credit.debit) !== 0 ||
          credit.account !==
            getSupplierSettlementCreditAccount(product.paymentMethod) ||
          debit.date > date ||
          credit.date > date
        ) {
          throw new SupplierResolutionError(
            'Settle or cancel the outstanding supplier payable on or before the credit date before issuing funded supplier credit.'
          );
        }
      }
      const credit = await tx.clothingSupplierCredit.create({
        data: {
          sourceProductId: product.id,
          supplierReference: supplier,
          reference: input.reference.trim(),
          amount,
          availableAmount: amount,
          quantity: product.quantity,
          sourceShipmentCode: product.shipmentCode,
          postingDate: date,
          requestId: input.requestId,
          createdBy: user.id,
        },
      });
      await tx.clothingAccountingJournalLine.createMany({
        data: [
          {
            account: SUPPLIER_CREDITS_ACCOUNT,
            debit: amount.toNumber(),
            credit: 0,
            sourceLineKey: 'SUPPLIER_CREDIT:ISSUE:debit',
          },
          {
            account: 'Inventory in Transit',
            debit: 0,
            credit: amount.toNumber(),
            sourceLineKey: 'SUPPLIER_CREDIT:ISSUE:credit',
          },
        ].map((line) => ({
          ...line,
          date,
          ref: `SUPPLIER-CREDIT:${product.id}`,
          sourceType: 'PRODUCT',
          sourceId: String(product.id),
          systemGenerated: true,
          description: `Supplier nonfulfillment | ${product.productCode} | ${input.reference.trim()}`,
        })),
      });
      const shortages = await tx.inventoryMovement.findMany({
        where: {
          deletedAt: null,
          OR: [
            { productId: product.id },
            { productId: null, productCode: product.productCode },
          ],
          AND: [
            {
              OR: [
                { fromBucket: 'sellable', toBucket: 'supplier_short' },
                { fromBucket: 'supplier_short', toBucket: 'sellable' },
              ],
            },
          ],
        },
      });
      const shortQuantity = shortages
        .filter(
          (movement) => !/^(additionals|transfer)/i.test(movement.notes ?? '')
        )
        .reduce(
          (sum, movement) =>
            sum +
            (movement.toBucket === 'supplier_short'
              ? movement.quantity
              : -movement.quantity),
          0
        );
      if (
        !Number.isFinite(shortQuantity) ||
        shortQuantity > product.quantity ||
        shortQuantity < 0
      ) {
        throw new SupplierResolutionError(
          'Reconcile the existing Supplier Short quantity first.'
        );
      }
      const protectedShortages = shortages.filter(
        (movement) => !/^(additionals|transfer)/i.test(movement.notes ?? '')
      );
      if (protectedShortages.length > 0) {
        await tx.inventoryMovement.updateMany({
          where: {
            id: { in: protectedShortages.map((movement) => movement.id) },
          },
          data: {
            movementSource: 'supplier_nonfulfillment',
            movementType: 'supplier_credit',
            supplierShortResolution: 'CREDIT_RECEIVED',
            supplierCreditReference: credit.reference,
            supplierCreditAmount: amount.toNumber(),
          },
        });
      }
      if (shortQuantity < product.quantity) {
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            productCode: product.productCode,
            quantity: product.quantity - shortQuantity,
            fromBucket: 'sellable',
            toBucket: 'supplier_short',
            movementSource: 'supplier_nonfulfillment',
            movementType: 'supplier_credit',
            postingDate: input.postingDate,
            notes: `Supplier nonfulfillment | ${credit.id}`,
            supplierShortResolution: 'CREDIT_RECEIVED',
            supplierCreditReference: credit.reference,
            supplierCreditAmount: amount.toNumber(),
          },
        });
      }
      await tx.product.update({
        where: { id: product.id },
        data: {
          supplierReference: supplier,
          supplierFulfillmentStatus: 'CREDIT_ISSUED',
        },
      });
      return credit;
    },
    { isolationLevel: 'Serializable' }
  );
}

export async function applySupplierCreditInTransaction(
  tx: Prisma.TransactionClient,
  input: {
    productId: number;
    creditId: string;
    amount: number;
    supplierReference: string;
    postingDate: string;
    requestId: string;
    userId: string;
  }
) {
  const amount = supplierMoney(input.amount);
  const date = accountingDate(input.postingDate);
  if (amount.lte(0) || !amount.equals(input.amount)) {
    throw new SupplierResolutionError(
      'Apply a positive credit amount with at most two decimal places.',
      400
    );
  }
  const supplier = supplierKey(input.supplierReference);
  const credit = await tx.clothingSupplierCredit.findUnique({
    where: { id: input.creditId },
  });
  if (
    !credit ||
    credit.currency !== 'PHP' ||
    credit.supplierReference !== supplier
  ) {
    throw new SupplierResolutionError(
      'Select an available PHP credit from the same supplier.',
      400
    );
  }
  const replay = await tx.clothingSupplierCreditApplication.findUnique({
    where: { targetProductId: input.productId },
  });
  if (replay) {
    if (
      replay.creditId !== input.creditId ||
      !replay.amount.equals(amount) ||
      replay.postingDate.getTime() !== date.getTime()
    ) {
      throw new SupplierResolutionError(
        'A different supplier-credit application already exists for this product.'
      );
    }
    return replay;
  }
  const product = await activeProduct(tx, input.productId);
  if (
    product.supplierReference &&
    supplierKey(product.supplierReference) !== supplier
  ) {
    throw new SupplierResolutionError(
      'Select an available PHP credit from the same supplier.',
      400
    );
  }
  if (
    credit.sourceProductId === product.id ||
    date < credit.postingDate ||
    amount.gt(supplierMoney(product.grandTotal))
  ) {
    throw new SupplierResolutionError(
      'Credit must fund a different purchase, within its cost, on or after the credit date.',
      400
    );
  }
  const purchaseDate = accountingDate(
    product.postingDate || product.orderDate || ''
  );
  if (date < purchaseDate) {
    throw new SupplierResolutionError(
      'Application date cannot precede the purchase posting date.',
      400
    );
  }
  const builds = await productBuilds(tx, product.id);
  if (builds.length) {
    throw new SupplierResolutionError(
      "Apply supplier credit before posting this product's transit build. Existing funding must not be silently replaced."
    );
  }
  await assertUnreceived(tx, product);
  const reserved = await tx.clothingSupplierCredit.updateMany({
    where: { id: credit.id, availableAmount: { gte: amount } },
    data: { availableAmount: { decrement: amount } },
  });
  if (reserved.count !== 1) {
    throw new SupplierResolutionError(
      'Insufficient available supplier credit. Refresh the balance and try again.'
    );
  }
  await createAcquisition(tx, product, amount, date);
  const application = await tx.clothingSupplierCreditApplication.create({
    data: {
      targetProductId: product.id,
      creditId: credit.id,
      amount,
      postingDate: date,
      requestId: input.requestId,
      createdBy: input.userId,
    },
  });
  await tx.product.update({
    where: { id: product.id },
    data: { supplierReference: supplier, supplierCreditAppliedAmount: amount },
  });
  return application;
}

export async function applySupplierCredit(
  input: Omit<Parameters<typeof applySupplierCreditInTransaction>[1], 'userId'>
) {
  const user = await supplierOperationsUser();
  return prisma.$transaction(
    (tx) => applySupplierCreditInTransaction(tx, { ...input, userId: user.id }),
    { isolationLevel: 'Serializable' }
  );
}
