import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { EMPTY_SHIPMENT_MARKER } from './sanitizers';

export class TransactionReferenceError extends Error {
  constructor(
    message: string,
    public details: {
      missing: {
        customers: string[];
        products: string[];
        shipments: string[];
      };
      counts: {
        customers: number;
        products: number;
        shipments: number;
      };
      suggestion: string;
    }
  ) {
    super(message);
  }
}

export class TransactionValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class TransactionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function validateReferences(
  rows: Prisma.TransactionCreateManyInput[]
) {
  const uniqueCustomers = Array.from(
    new Set(rows.map((t) => t.customers).filter((c): c is string => Boolean(c)))
  );
  const uniqueProducts = Array.from(
    new Set(
      rows.map((t) => t.productCode).filter((p): p is string => Boolean(p))
    )
  );
  const uniqueShipments = Array.from(
    new Set(
      rows
        .map((t) => t.shipmentCode)
        .filter((s): s is string => Boolean(s) && s !== EMPTY_SHIPMENT_MARKER)
    )
  );

  const existingCustomers = await prisma.customer.findMany({
    where: { customerName: { in: uniqueCustomers } },
    select: { customerName: true },
  });
  const existingCustomerNames = new Set(
    existingCustomers.map((customer) => customer.customerName)
  );
  const missingCustomers = uniqueCustomers.filter(
    (name) => !existingCustomerNames.has(name)
  );

  const existingProducts = await prisma.product.findMany({
    where: { productCode: { in: uniqueProducts } },
    select: { productCode: true },
  });

  const existingBundleSkus =
    uniqueProducts.length === 0
      ? []
      : await prisma.bundleBatch.findMany({
          where: {
            OR: uniqueProducts.map((code) => ({
              bundleSku: { equals: code, mode: 'insensitive' as const },
            })),
          },
          select: { bundleSku: true },
        });

  const existingSplitSkus =
    uniqueProducts.length === 0
      ? []
      : await prisma.splitBatchComponent.findMany({
          where: {
            OR: uniqueProducts.map((code) => ({
              componentSku: { equals: code, mode: 'insensitive' as const },
            })),
          },
          select: { componentSku: true },
        });

  const existingProductCodeSet = new Set<string>();
  existingProducts
    .map((product) => product.productCode)
    .filter((code): code is string => Boolean(code))
    .forEach((code) => existingProductCodeSet.add(code.toLowerCase()));

  existingBundleSkus
    .map((bundle) => bundle.bundleSku)
    .filter((code): code is string => Boolean(code))
    .forEach((code) => existingProductCodeSet.add(code.toLowerCase()));

  existingSplitSkus
    .map((component) => component.componentSku)
    .filter((code): code is string => Boolean(code))
    .forEach((code) => existingProductCodeSet.add(code.toLowerCase()));

  const missingProducts = uniqueProducts.filter(
    (code) => !existingProductCodeSet.has(code.toLowerCase())
  );

  let missingShipments: string[] = [];
  if (uniqueShipments.length > 0) {
    const existingShipments = await prisma.shipment.findMany({
      where: { shipmentCode: { in: uniqueShipments } },
      select: { shipmentCode: true },
    });
    const existingShipmentCodes = new Set(
      existingShipments.map((shipment) => shipment.shipmentCode)
    );
    missingShipments = uniqueShipments.filter(
      (code) => !existingShipmentCodes.has(code)
    );
  }

  if (
    missingCustomers.length > 0 ||
    missingProducts.length > 0 ||
    missingShipments.length > 0
  ) {
    throw new TransactionReferenceError('Reference integrity violation', {
      missing: {
        customers: missingCustomers.slice(0, 10),
        products: missingProducts.slice(0, 10),
        shipments: missingShipments.slice(0, 10),
      },
      counts: {
        customers: missingCustomers.length,
        products: missingProducts.length,
        shipments: missingShipments.length,
      },
      suggestion:
        'Import the missing entities first, then retry the transaction import.',
    });
  }
}
