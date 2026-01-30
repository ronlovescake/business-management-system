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
  softDeleteAll: () => Promise<{ deleted: number; alreadyDeleted: number }>;
}

const gmPrisma = prisma as unknown as {
  generalMerchandiseProduct: typeof prisma.product;
};

const ACCOUNTING_CUTOVER_DATE = getAccountingCutoverDate();

const INVENTORY_IN_TRANSIT_ACCOUNT = 'Inventory in Transit';
const CASH_ACCOUNT = 'Cash';
const SUPPLIER_PAYABLE_ACCOUNT = 'Supplier Payable';

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

function resolveProductValuationAmount(dto: ProductDTO): number {
  const grandTotal = Number(dto['Grand Total'] ?? 0);
  if (Number.isFinite(grandTotal) && grandTotal > 0) {
    return grandTotal;
  }

  return 0;
}

function buildProductTransitBuildIdempotencyKey(productId: number): string {
  return `PRODUCT_TRANSIT_BUILD:${productId}`;
}

async function postTransitBuildForProduct(params: {
  productId: number;
  dto: ProductDTO;
}) {
  const { productId, dto } = params;

  const shipmentCode = (dto['Shipment Code'] ?? '').toString().trim();
  if (!shipmentCode) {
    logger.info('GM: skip product transit build-up: missing shipment code', {
      productId,
    });
    return;
  }

  const payment = (dto.Payment ?? '').toString().trim();
  if (!payment) {
    logger.info('GM: skip product transit build-up: missing payment', {
      productId,
      shipmentCode,
    });
    return;
  }

  const postingDate =
    normalizeDateOrNull(dto['Posting Date']) ??
    normalizeDateOrNull(dto['Order Date']);
  if (!postingDate) {
    logger.info(
      'GM: skip product transit build-up: missing/invalid posting date',
      {
        productId,
        shipmentCode,
        postingDate: dto['Posting Date'],
        orderDate: dto['Order Date'],
      }
    );
    return;
  }

  if (!isOnOrAfterAccountingCutover(postingDate)) {
    logger.info(
      'GM: skip product transit build-up: before accounting cutover',
      {
        productId,
        shipmentCode,
        date: postingDate.toISOString().slice(0, 10),
        cutover: ACCOUNTING_CUTOVER_DATE.toISOString().slice(0, 10),
      }
    );
    return;
  }

  const amount = resolveProductValuationAmount(dto);
  if (!Number.isFinite(amount) || amount <= 0) {
    logger.info('GM: skip product transit build-up: amount not positive', {
      productId,
      shipmentCode,
      amount,
    });
    return;
  }

  const creditAccount = isPaid(payment)
    ? CASH_ACCOUNT
    : SUPPLIER_PAYABLE_ACCOUNT;
  const productCode = (dto['Product Code'] ?? '').toString().trim();
  const productName = (dto.Product ?? '').toString().trim();
  const notesParts = [
    `GM Product #${productId}`,
    productCode ? `Code: ${productCode}` : null,
    productName ? `Name: ${productName}` : null,
    `Payment: ${payment}`,
  ].filter(Boolean);

  try {
    await prisma.generalMerchandiseInventoryTransitBuildEntry.create({
      data: {
        postingDate,
        shipmentId: null,
        shipmentCode,
        amount,
        debitAccount: INVENTORY_IN_TRANSIT_ACCOUNT,
        creditAccount,
        idempotencyKey: buildProductTransitBuildIdempotencyKey(productId),
        notes: notesParts.join(' | '),
      },
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'P2002') {
      logger.info(
        'GM: product transit build-up already exists; skip duplicate',
        {
          productId,
          shipmentCode,
        }
      );
      return;
    }

    logger.warn('GM: failed to post product transit build-up', {
      error,
      productId,
      shipmentCode,
      amount,
      creditAccount,
    });
  }
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

  const transitBuild = await prisma.generalMerchandiseInventoryTransitBuildEntry
    .findUnique({
      where: {
        idempotencyKey: buildProductTransitBuildIdempotencyKey(productId),
      },
      select: { amount: true, creditAccount: true },
    })
    .catch(() => null);

  if (!transitBuild) {
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

  const amount = Number(transitBuild.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  if (transitBuild.creditAccount !== SUPPLIER_PAYABLE_ACCOUNT) {
    logger.info(
      'GM: skip supplier settlement: transit build-up not payable-based',
      {
        productId,
        productCode,
        shipmentCode,
        creditAccount: transitBuild.creditAccount,
      }
    );
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
    await postTransitBuildForProduct({ productId: created.id, dto: payload });
    return mapToDTO(created);
  },

  async bulkImport(payload) {
    const transitBuilds: Array<{ productId: number; dto: ProductDTO }> = [];
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
            tx as unknown as typeof gmPrisma
          ).generalMerchandiseProduct.findUnique({
            where: { id: dto.id },
          });

          await (
            tx as unknown as typeof gmPrisma
          ).generalMerchandiseProduct.upsert({
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
          } else {
            transitBuilds.push({ productId: dto.id, dto });
          }

          updated += 1;
          continue;
        }

        if (productCode) {
          const existing = await (
            tx as unknown as typeof gmPrisma
          ).generalMerchandiseProduct.findFirst({
            where: { productCode },
          });

          if (existing) {
            const prevPayment = (existing as { payment?: string | null })
              .payment;
            await (
              tx as unknown as typeof gmPrisma
            ).generalMerchandiseProduct.update({
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

        const createdProduct = await (
          tx as unknown as typeof gmPrisma
        ).generalMerchandiseProduct.create({ data });
        transitBuilds.push({ productId: createdProduct.id, dto });
        created += 1;
      }

      return { created, updated, restored };
    });

    await Promise.all(
      transitBuilds.map(({ productId, dto }) =>
        postTransitBuildForProduct({ productId, dto })
      )
    );

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
