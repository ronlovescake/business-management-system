import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { TransactionDTO } from '@/modules/transactions/api/dto';
import { mapToDTO } from '@/modules/transactions/api/dto';
import {
  EMPTY_SHIPMENT_MARKER,
  isEmptyRow,
  isTemplatePreparedRow,
  isValidRow,
  sanitizeTransactionRecord,
  sanitizeTransactionUpdateRecord,
} from '@/modules/transactions/api/sanitizers';
import {
  transactionDataSchema,
  transactionUpdateSchema,
} from '@/modules/transactions/api/schemas';
import {
  TransactionReferenceError,
  TransactionValidationError,
} from '@/modules/transactions/api/service';

interface PriceTier {
  productCode: string | null;
  lowerLimit: number;
  upperLimit: number;
  currentPrice: number;
}

interface TransactionImportSummary {
  count: number;
  withData: number;
  empty: number;
}

interface TransactionUpdateSummary {
  count: number;
}

interface TransactionUpdateResult {
  transaction: TransactionDTO;
}

const gmPrisma = prisma as unknown as {
  generalMerchandiseTransaction: {
    findMany: (args: unknown) => Promise<unknown[]>;
    createMany: (args: unknown) => Promise<{ count: number }>;
    update: (args: unknown) => Promise<unknown>;
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };
  generalMerchandiseCustomer: {
    findMany: (args: unknown) => Promise<Array<{ customerName: string }>>;
  };
  generalMerchandiseProduct: {
    findMany: (args: unknown) => Promise<Array<{ productCode: string | null }>>;
  };
  generalMerchandiseShipment: {
    findMany: (args: unknown) => Promise<Array<{ shipmentCode: string }>>;
  };
  generalMerchandisePrice: {
    findMany: (args: unknown) => Promise<PriceTier[]>;
  };
};

function getUnitPriceForQuantity(
  productCode: string,
  quantity: number,
  priceTiers: PriceTier[]
): number {
  if (!productCode || !quantity || quantity <= 0) {
    return 0;
  }

  const matchingTier = priceTiers.find((tier) => {
    if (!tier.productCode) {
      return false;
    }
    if (tier.productCode !== productCode) {
      return false;
    }
    const lowerLimit = tier.lowerLimit / 100;
    const upperLimit = tier.upperLimit / 100;
    return quantity >= lowerLimit && quantity <= upperLimit;
  });

  return matchingTier ? matchingTier.currentPrice : 0;
}

function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  adjustment: number
): number {
  return quantity * unitPrice - adjustment;
}

function buildCreateInput(
  row: {
    'Order Date': string;
    Customers: string;
    'Product Code': string;
    Quantity: number;
    'Unit Price': number;
    Discount: number;
    Adjustment: number;
    'Line Total': number;
    'Order Status': string | null;
    Notes: string | null;
    'Invoice Date': string | null;
    'Packed Date': string | null;
    'Shipment Code': string | null;
  },
  priceTiers: PriceTier[]
): Prisma.TransactionCreateManyInput {
  const quantity = row.Quantity;
  const discount = row.Discount;
  const adjustment = row.Adjustment;
  const productCode = row['Product Code'];

  let unitPrice = row['Unit Price'];
  if (unitPrice === 0 && quantity > 0 && productCode) {
    const tierPrice = getUnitPriceForQuantity(
      productCode,
      quantity,
      priceTiers
    );
    if (tierPrice > 0) {
      const tierPriceInPeso = tierPrice / 100;
      unitPrice = tierPriceInPeso - discount;
    }
  }

  let lineTotal = row['Line Total'];
  if (lineTotal === 0) {
    lineTotal = calculateLineTotal(quantity, unitPrice, adjustment);
  }

  return {
    orderDate: row['Order Date'],
    customers: row.Customers,
    productCode,
    quantity,
    unitPrice,
    discount,
    adjustment,
    lineTotal,
    orderStatus: row['Order Status'] || null,
    notes: row.Notes,
    invoiceDate: row['Invoice Date'],
    packedDate: row['Packed Date'],
    shipmentCode: row['Shipment Code'],
  } satisfies Prisma.TransactionCreateManyInput;
}

async function validateReferences(rows: Prisma.TransactionCreateManyInput[]) {
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

  const existingCustomers = await gmPrisma.generalMerchandiseCustomer.findMany({
    where: { customerName: { in: uniqueCustomers } },
    select: { customerName: true },
  } as unknown as Prisma.CustomerFindManyArgs);

  const existingCustomerNames = new Set(
    existingCustomers.map((c) => c.customerName)
  );
  const missingCustomers = uniqueCustomers.filter(
    (name) => !existingCustomerNames.has(name)
  );

  const existingProducts = await gmPrisma.generalMerchandiseProduct.findMany({
    where: { productCode: { in: uniqueProducts } },
    select: { productCode: true },
  } as unknown as Prisma.ProductFindManyArgs);

  const existingProductCodeSet = new Set<string>();
  existingProducts
    .map((p) => p.productCode)
    .filter((code): code is string => Boolean(code))
    .forEach((code) => existingProductCodeSet.add(code.toLowerCase()));

  const missingProducts = uniqueProducts.filter(
    (code) => !existingProductCodeSet.has(code.toLowerCase())
  );

  const existingShipments = await gmPrisma.generalMerchandiseShipment.findMany({
    where: { shipmentCode: { in: uniqueShipments } },
    select: { shipmentCode: true },
  } as unknown as Prisma.ShipmentFindManyArgs);

  const existingShipmentSet = new Set(
    existingShipments.map((s) => s.shipmentCode)
  );
  const missingShipments = uniqueShipments.filter(
    (code) => !existingShipmentSet.has(code)
  );

  if (
    missingCustomers.length > 0 ||
    missingProducts.length > 0 ||
    missingShipments.length > 0
  ) {
    throw new TransactionReferenceError('Reference validation failed', {
      missing: {
        customers: missingCustomers,
        products: missingProducts,
        shipments: missingShipments,
      },
      counts: {
        customers: missingCustomers.length,
        products: missingProducts.length,
        shipments: missingShipments.length,
      },
      suggestion:
        'Create the missing customers/products/shipments before importing transactions.',
    });
  }
}

export interface TransactionService {
  findActive: () => Promise<TransactionDTO[]>;
  importTransactions: (payload: unknown[]) => Promise<TransactionImportSummary>;
  bulkUpdateTransactions: (
    payload: unknown[]
  ) => Promise<TransactionUpdateSummary>;
  updateTransaction: (payload: unknown) => Promise<TransactionUpdateResult>;
  softDeleteAll: () => Promise<{ deleted: number; alreadyDeleted: number }>;
}

export const generalMerchandiseTransactionService: TransactionService = {
  async findActive() {
    const transactions = (await gmPrisma.generalMerchandiseTransaction.findMany(
      {
        where: { deletedAt: null },
        orderBy: { id: 'asc' },
      } as unknown as Prisma.TransactionFindManyArgs
    )) as Array<Parameters<typeof mapToDTO>[0]>;

    return transactions.map((transaction) => mapToDTO(transaction));
  },

  async importTransactions(payload) {
    if (!Array.isArray(payload)) {
      throw new TransactionValidationError('Invalid data format');
    }

    const normalized = payload.map((entry, index) => ({
      index,
      record: sanitizeTransactionRecord(entry),
    }));

    const priceTiers = await gmPrisma.generalMerchandisePrice.findMany({
      select: {
        productCode: true,
        lowerLimit: true,
        upperLimit: true,
        currentPrice: true,
      },
    } as unknown as Prisma.PriceFindManyArgs);

    const emptyRows = normalized.filter(({ record }) => isEmptyRow(record));
    const validRows = normalized.filter(({ record }) => isValidRow(record));

    const preparedRows: Prisma.TransactionCreateManyInput[] = [];
    let skippedTemplateRows = 0;

    validRows.forEach(({ record, index }) => {
      const validation = transactionDataSchema.safeParse(record);
      if (!validation.success) {
        logger.warn(
          `GM Transaction #${index + 1} skipped - validation failed`,
          {
            row: index + 1,
            issues: validation.error.issues,
          }
        );
        return;
      }

      if (isTemplatePreparedRow(validation.data)) {
        skippedTemplateRows += 1;
        return;
      }

      preparedRows.push(buildCreateInput(validation.data, priceTiers));
    });

    const skippedEmptyRows = emptyRows.length;
    if (preparedRows.length === 0) {
      throw new TransactionValidationError(
        'No valid transactions to import. Please review the CSV file.'
      );
    }

    await validateReferences(preparedRows);

    const result = await gmPrisma.generalMerchandiseTransaction.createMany({
      data: preparedRows,
    });

    return {
      count: result.count,
      withData: preparedRows.length - skippedTemplateRows,
      empty: skippedEmptyRows,
    };
  },

  async bulkUpdateTransactions(payload) {
    if (!Array.isArray(payload)) {
      throw new TransactionValidationError('Invalid data format');
    }

    let updatedCount = 0;

    for (const entry of payload) {
      const updateRecord = sanitizeTransactionUpdateRecord(entry);
      const validation = transactionUpdateSchema.safeParse(updateRecord);
      if (!validation.success) {
        continue;
      }

      await gmPrisma.generalMerchandiseTransaction.update({
        where: { id: updateRecord.id },
        data: {
          orderDate: updateRecord.values['Order Date'],
          customers: updateRecord.values.Customers,
          productCode: updateRecord.values['Product Code'],
          quantity: updateRecord.values.Quantity,
          unitPrice: updateRecord.values['Unit Price'],
          discount: updateRecord.values.Discount,
          adjustment: updateRecord.values.Adjustment,
          lineTotal: updateRecord.values['Line Total'],
          orderStatus: updateRecord.values['Order Status'] ?? null,
          notes: updateRecord.values.Notes,
          invoiceDate: updateRecord.values['Invoice Date'],
          packedDate: updateRecord.values['Packed Date'],
          shipmentCode: updateRecord.values['Shipment Code'],
        },
      } as unknown as Prisma.TransactionUpdateArgs);
      updatedCount += 1;
    }

    return { count: updatedCount };
  },

  async updateTransaction(payload) {
    const updateRecord = sanitizeTransactionUpdateRecord(payload);
    const validation = transactionUpdateSchema.safeParse(updateRecord);
    if (!validation.success) {
      throw new TransactionValidationError('Invalid transaction payload');
    }

    const updated = (await gmPrisma.generalMerchandiseTransaction.update({
      where: { id: updateRecord.id },
      data: {
        orderDate: updateRecord.values['Order Date'],
        customers: updateRecord.values.Customers,
        productCode: updateRecord.values['Product Code'],
        quantity: updateRecord.values.Quantity,
        unitPrice: updateRecord.values['Unit Price'],
        discount: updateRecord.values.Discount,
        adjustment: updateRecord.values.Adjustment,
        lineTotal: updateRecord.values['Line Total'],
        orderStatus: updateRecord.values['Order Status'] ?? null,
        notes: updateRecord.values.Notes,
        invoiceDate: updateRecord.values['Invoice Date'],
        packedDate: updateRecord.values['Packed Date'],
        shipmentCode: updateRecord.values['Shipment Code'],
      },
    } as unknown as Prisma.TransactionUpdateArgs)) as Parameters<
      typeof mapToDTO
    >[0];

    return { transaction: mapToDTO(updated) };
  },

  async softDeleteAll() {
    const alreadyDeleted =
      await gmPrisma.generalMerchandiseTransaction.updateMany({
        where: { deletedAt: { not: null } },
        data: { deletedAt: new Date() },
      });

    const result = await gmPrisma.generalMerchandiseTransaction.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return {
      deleted: result.count,
      alreadyDeleted: alreadyDeleted.count,
    };
  },
};
