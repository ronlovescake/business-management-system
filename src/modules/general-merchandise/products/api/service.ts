import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { parseDate } from '@/lib/accounting/date-utils';
import { mapFromDTO, mapToDTO } from '@/modules/products/api/dto';
import type { ProductDTO } from '@/modules/products/api/dto';

export interface ProductService {
  findActive: () => Promise<ProductDTO[]>;
  createSingle: (payload: ProductDTO) => Promise<ProductDTO>;
  bulkImport: (
    payload: ProductDTO[]
  ) => Promise<{ created: number; updated: number; restored: number }>;
  bulkUpdate: (payload: ProductDTO[]) => Promise<{
    created: number;
    updated: number;
    restored: number;
    notifications: number;
  }>;
  postManualTransitBuildUpByShipmentCode: (params: {
    shipmentCode: string;
  }) => Promise<{ created: number; skipped: number; products: number }>;
  softDeleteAll: () => Promise<{ deleted: number; alreadyDeleted: number }>;
}

const gmPrisma = prisma as {
  generalMerchandiseProduct: typeof prisma.generalMerchandiseProduct;
};

const ACCOUNTING_CUTOVER_DATE = getAccountingCutoverDate();

const INVENTORY_IN_TRANSIT_ACCOUNT = 'Inventory in Transit';
const LANDED_COST_CLEARING_ACCOUNT = 'Landed Cost Clearing';
const CASH_ACCOUNT = 'Cash';
const SUPPLIER_PAYABLE_ACCOUNT = 'Supplier Payable';
const FORWARDER_PAYABLE_ACCOUNT = 'Forwarder Payable';
const COURIER_PAYABLE_ACCOUNT = 'Courier Payable';

function normalizeToUtcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function isOnOrAfterAccountingCutover(date: Date): boolean {
  return date >= ACCOUNTING_CUTOVER_DATE;
}

function isPaid(payment?: string | null): boolean {
  return (payment ?? '').trim().toLowerCase() === 'paid';
}

function normalizeDateOrNull(raw: unknown): Date | null {
  const parsed = parseDate(typeof raw === 'string' ? raw : null);
  if (!parsed) {
    return null;
  }
  return normalizeToUtcMidnight(parsed);
}

function resolvePostingDateFromProduct(params: {
  postingDate: string | null;
  orderDate: string | null;
}): Date | null {
  return (
    normalizeDateOrNull(params.postingDate) ??
    normalizeDateOrNull(params.orderDate)
  );
}

function buildProductTransitBuildIdempotencyKey(productId: number): string {
  return `PRODUCT_TRANSIT_BUILD:${productId}`;
}

async function postSupplierSettlementForProduct(params: {
  productId: number;
  productCode: string | null;
  shipmentCode: string | null;
}): Promise<void> {
  const { productId, productCode, shipmentCode } = params;

  const today = normalizeToUtcMidnight(new Date());
  if (!isOnOrAfterAccountingCutover(today)) {
    return;
  }

  const transitBuildRows =
    await prisma.generalMerchandiseInventoryTransitBuildEntry
      .findMany({
        where: {
          deletedAt: null,
          idempotencyKey: {
            startsWith: buildProductTransitBuildIdempotencyKey(productId),
          },
          creditAccount: SUPPLIER_PAYABLE_ACCOUNT,
        },
        select: { amount: true },
      })
      .catch(() => []);

  if (transitBuildRows.length === 0) {
    logger.info(
      'GM: skip supplier settlement: missing transit build-up entry',
      {
        productId,
        productCode,
        shipmentCode,
      }
    );
    return;
  }

  const amount = transitBuildRows.reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const ref = productCode
    ? `GM_PRODUCT:${productCode}`
    : `GM_PRODUCT:${productId}`;
  const descriptionParts = [
    'Supplier payment settlement',
    productCode ? `Product ${productCode}` : `Product #${productId}`,
    shipmentCode ? `Shipment ${shipmentCode}` : null,
  ].filter(Boolean);
  const description = descriptionParts.join(' | ');

  await prisma.$transaction(async (tx) => {
    await tx.generalMerchandiseAccountingJournalLine.upsert({
      where: {
        sourceType_sourceId_sourceLineKey: {
          sourceType: 'PRODUCT',
          sourceId: String(productId),
          sourceLineKey: 'SUPPLIER_SETTLEMENT:debit',
        },
      },
      create: {
        date: today,
        ref,
        account: SUPPLIER_PAYABLE_ACCOUNT,
        debit: amount,
        credit: 0,
        description,
        sourceType: 'PRODUCT',
        sourceId: String(productId),
        sourceLineKey: 'SUPPLIER_SETTLEMENT:debit',
        systemGenerated: true,
      },
      update: {
        date: today,
        ref,
        account: SUPPLIER_PAYABLE_ACCOUNT,
        debit: amount,
        credit: 0,
        description,
        systemGenerated: true,
      },
    });

    await tx.generalMerchandiseAccountingJournalLine.upsert({
      where: {
        sourceType_sourceId_sourceLineKey: {
          sourceType: 'PRODUCT',
          sourceId: String(productId),
          sourceLineKey: 'SUPPLIER_SETTLEMENT:credit',
        },
      },
      create: {
        date: today,
        ref,
        account: CASH_ACCOUNT,
        debit: 0,
        credit: amount,
        description,
        sourceType: 'PRODUCT',
        sourceId: String(productId),
        sourceLineKey: 'SUPPLIER_SETTLEMENT:credit',
        systemGenerated: true,
      },
      update: {
        date: today,
        ref,
        account: CASH_ACCOUNT,
        debit: 0,
        credit: amount,
        description,
        systemGenerated: true,
      },
    });
  });
}

export async function postGmSupplierSettlementForProductPaymentChange(params: {
  productId: number;
  prevPayment: string | null | undefined;
  nextPayment: string | null | undefined;
  productCode: string | null;
  shipmentCode: string | null;
}): Promise<void> {
  const { productId, prevPayment, nextPayment, productCode, shipmentCode } =
    params;

  if (isPaid(nextPayment) && !isPaid(prevPayment)) {
    await postSupplierSettlementForProduct({
      productId,
      productCode,
      shipmentCode,
    });
  }
}

function buildUpdateData(dto: ProductDTO): Prisma.ProductUpdateInput {
  const base = mapFromDTO(dto);
  return { ...base, deletedAt: null };
}

export const generalMerchandiseProductService: ProductService = {
  async findActive() {
    const products = await gmPrisma.generalMerchandiseProduct.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
    return products.map(mapToDTO);
  },

  async createSingle(payload) {
    const created = await gmPrisma.generalMerchandiseProduct.create({
      data: mapFromDTO(payload),
    });
    return mapToDTO(created);
  },

  async bulkImport(payload) {
    const settlements: Array<{
      productId: number;
      productCode: string | null;
      shipmentCode: string | null;
    }> = [];

    const result = await prisma.$transaction(async (tx) => {
      let created = 0;
      let updated = 0;
      let restored = 0;

      for (const dto of payload) {
        const productCode = dto['Product Code']?.trim();
        const data = mapFromDTO(dto);
        const updateData = buildUpdateData(dto);

        if (dto.id) {
          const existing = await (
            tx as typeof gmPrisma
          ).generalMerchandiseProduct.findUnique({
            where: { id: dto.id },
          });

          await (tx as typeof gmPrisma).generalMerchandiseProduct.upsert({
            where: { id: dto.id },
            create: data,
            update: updateData,
          });

          if (existing) {
            const prevPayment = (existing as { payment?: string | null })
              .payment;
            const nextPayment = dto.Payment;
            if (isPaid(nextPayment) && !isPaid(prevPayment)) {
              settlements.push({
                productId: existing.id,
                productCode: existing.productCode,
                shipmentCode: existing.shipmentCode,
              });
            }
          }

          updated += 1;
          continue;
        }

        if (productCode) {
          const existing = await (
            tx as typeof gmPrisma
          ).generalMerchandiseProduct.findFirst({
            where: { productCode },
          });

          if (existing) {
            const prevPayment = (existing as { payment?: string | null })
              .payment;
            await (tx as typeof gmPrisma).generalMerchandiseProduct.update({
              where: { id: existing.id },
              data: updateData,
            });

            const nextPayment = dto.Payment;
            if (isPaid(nextPayment) && !isPaid(prevPayment)) {
              settlements.push({
                productId: existing.id,
                productCode: existing.productCode,
                shipmentCode: existing.shipmentCode,
              });
            }

            if (existing.deletedAt) {
              restored += 1;
            } else {
              updated += 1;
            }
            continue;
          }
        }

        await (tx as typeof gmPrisma).generalMerchandiseProduct.create({
          data,
        });
        created += 1;
      }

      return { created, updated, restored };
    });

    await Promise.all(
      settlements.map(({ productId, productCode, shipmentCode }) =>
        postSupplierSettlementForProduct({
          productId,
          productCode,
          shipmentCode,
        })
      )
    );

    return result;
  },

  async postManualTransitBuildUpByShipmentCode(params) {
    const shipmentCode = (params.shipmentCode ?? '').toString().trim();
    if (!shipmentCode) {
      return { created: 0, skipped: 0, products: 0 };
    }

    const products = await gmPrisma.generalMerchandiseProduct.findMany({
      where: {
        deletedAt: null,
        shipmentCode: {
          equals: shipmentCode,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        productCode: true,
        product: true,
        payment: true,
        postingDate: true,
        orderDate: true,
        grandTotal: true,
        forwardersFee: true,
        lalamove: true,
      },
      orderBy: { id: 'asc' },
    });

    const existingBuildKeys =
      await prisma.generalMerchandiseInventoryTransitBuildEntry
        .findMany({
          where: {
            deletedAt: null,
            shipmentCode: {
              equals: shipmentCode,
              mode: 'insensitive',
            },
            idempotencyKey: {
              startsWith: 'PRODUCT_TRANSIT_BUILD:',
            },
          },
          select: { idempotencyKey: true },
        })
        .catch(() => []);

    const alreadyPostedProductIds = new Set<number>();
    for (const row of existingBuildKeys) {
      const parts = (row.idempotencyKey ?? '').split(':');
      const productId = Number(parts[1] ?? NaN);
      if (Number.isFinite(productId)) {
        alreadyPostedProductIds.add(productId);
      }
    }

    const entries: Prisma.GeneralMerchandiseInventoryTransitBuildEntryCreateManyInput[] =
      [];

    const toAmount = (value: unknown) => Number(value ?? 0);
    const addEntry = (params: {
      productId: number;
      productCode: string | null;
      productName: string | null;
      payment: string;
      postingDate: Date;
      debitAccount: string;
      creditAccount: string;
      componentKey: 'GRAND_TOTAL' | 'FORWARDER_FEE' | 'LALAMOVE';
      componentLabel: string;
      amount: number;
    }) => {
      if (!Number.isFinite(params.amount) || params.amount <= 0) {
        return;
      }

      const notesParts = [
        `GM Product #${params.productId}`,
        params.productCode ? `Code: ${params.productCode}` : null,
        params.productName ? `Name: ${params.productName}` : null,
        `Component: ${params.componentLabel}`,
        `Payment: ${params.payment}`,
      ].filter(Boolean);

      const baseKey = buildProductTransitBuildIdempotencyKey(params.productId);

      entries.push({
        postingDate: params.postingDate,
        shipmentId: null,
        shipmentCode,
        amount: params.amount,
        debitAccount: params.debitAccount,
        creditAccount: params.creditAccount,
        idempotencyKey: `${baseKey}:${params.componentKey}`,
        notes: notesParts.join(' | '),
      });
    };

    let skippedProducts = 0;
    for (const product of products) {
      if (alreadyPostedProductIds.has(product.id)) {
        skippedProducts += 1;
        continue;
      }

      const payment = (product.payment ?? '').toString().trim();
      if (!payment) {
        continue;
      }

      const postingDate = resolvePostingDateFromProduct({
        postingDate: product.postingDate,
        orderDate: product.orderDate,
      });
      if (!postingDate) {
        continue;
      }

      if (!isOnOrAfterAccountingCutover(postingDate)) {
        continue;
      }

      const supplierCreditAccount = isPaid(payment)
        ? CASH_ACCOUNT
        : SUPPLIER_PAYABLE_ACCOUNT;

      const forwarderCreditAccount = isPaid(payment)
        ? CASH_ACCOUNT
        : FORWARDER_PAYABLE_ACCOUNT;

      const courierCreditAccount = isPaid(payment)
        ? CASH_ACCOUNT
        : COURIER_PAYABLE_ACCOUNT;

      addEntry({
        productId: product.id,
        productCode: product.productCode,
        productName: product.product,
        payment,
        postingDate,
        debitAccount: INVENTORY_IN_TRANSIT_ACCOUNT,
        creditAccount: supplierCreditAccount,
        componentKey: 'GRAND_TOTAL',
        componentLabel: 'Grand Total',
        amount: toAmount(product.grandTotal),
      });

      addEntry({
        productId: product.id,
        productCode: product.productCode,
        productName: product.product,
        payment,
        postingDate,
        debitAccount: LANDED_COST_CLEARING_ACCOUNT,
        creditAccount: forwarderCreditAccount,
        componentKey: 'FORWARDER_FEE',
        componentLabel: "Forwarder's Fee",
        amount: toAmount(product.forwardersFee),
      });

      addEntry({
        productId: product.id,
        productCode: product.productCode,
        productName: product.product,
        payment,
        postingDate,
        debitAccount: LANDED_COST_CLEARING_ACCOUNT,
        creditAccount: courierCreditAccount,
        componentKey: 'LALAMOVE',
        componentLabel: 'Lalamove',
        amount: toAmount(product.lalamove),
      });
    }

    if (entries.length === 0) {
      return {
        created: 0,
        skipped: skippedProducts,
        products: products.length,
      };
    }

    const result =
      await prisma.generalMerchandiseInventoryTransitBuildEntry.createMany({
        data: entries,
        skipDuplicates: true,
      });

    const skippedEntries = Math.max(0, entries.length - result.count);

    return {
      created: result.count,
      skipped: skippedProducts + skippedEntries,
      products: products.length,
    };
  },

  async bulkUpdate(payload) {
    const summary = await generalMerchandiseProductService.bulkImport(payload);
    return { ...summary, notifications: 0 };
  },

  async softDeleteAll() {
    const alreadyDeleted = await gmPrisma.generalMerchandiseProduct.count({
      where: { deletedAt: { not: null } },
    });

    const result = await gmPrisma.generalMerchandiseProduct.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return { deleted: result.count, alreadyDeleted };
  },
};
