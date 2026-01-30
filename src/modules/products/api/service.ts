import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAccountingCutoverDate } from '@/lib/accounting/cutover';
import { parseDate } from '@/lib/accounting/date-utils';
import { mapFromDTO, mapToDTO } from './dto';
import type { ProductDTO } from './dto';
import { expenseService } from '@/modules/clothing/ledger/api/service';
import type { ExpenseCreateInput } from '@/modules/clothing/ledger/api/schemas';

// Cutover rule: only auto-post expenses for orders on/after this date
const EXPENSE_CUTOVER_DATE = new Date('2026-01-01');
const isOnOrAfterCutover = (date: Date) => date >= EXPENSE_CUTOVER_DATE;

// Accounting policy: product costs/COGS are handled in the ledger; the Expenses
// module is reserved for operational expenses.
const ENABLE_PRODUCT_EXPENSE_POSTING = false;

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
    logger.info('Skip product transit build-up: missing shipment code', {
      productId,
    });
    return;
  }

  const payment = (dto.Payment ?? '').toString().trim();
  if (!payment) {
    logger.info('Skip product transit build-up: missing payment', {
      productId,
      shipmentCode,
    });
    return;
  }

  const postingDate =
    normalizeDateOrNull(dto['Posting Date']) ??
    normalizeDateOrNull(dto['Order Date']);
  if (!postingDate) {
    logger.info('Skip product transit build-up: missing/invalid posting date', {
      productId,
      shipmentCode,
      postingDate: dto['Posting Date'],
      orderDate: dto['Order Date'],
    });
    return;
  }

  if (!isOnOrAfterAccountingCutover(postingDate)) {
    logger.info('Skip product transit build-up: before accounting cutover', {
      productId,
      shipmentCode,
      date: postingDate.toISOString().slice(0, 10),
      cutover: ACCOUNTING_CUTOVER_DATE.toISOString().slice(0, 10),
    });
    return;
  }

  const amount = resolveProductValuationAmount(dto);
  if (!Number.isFinite(amount) || amount <= 0) {
    logger.info('Skip product transit build-up: amount not positive', {
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
    `Product #${productId}`,
    productCode ? `Code: ${productCode}` : null,
    productName ? `Name: ${productName}` : null,
    `Payment: ${payment}`,
  ].filter(Boolean);

  try {
    await prisma.clothingInventoryTransitBuildEntry.create({
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
      logger.info('Product transit build-up already exists; skip duplicate', {
        productId,
        shipmentCode,
      });
      return;
    }

    logger.warn('Failed to post product transit build-up', {
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

  const transitBuild = await prisma.clothingInventoryTransitBuildEntry
    .findUnique({
      where: {
        idempotencyKey: buildProductTransitBuildIdempotencyKey(productId),
      },
      select: { amount: true, creditAccount: true },
    })
    .catch(() => null);

  if (!transitBuild) {
    logger.info('Skip supplier settlement: missing transit build-up entry', {
      productId,
      productCode,
      shipmentCode,
    });
    return;
  }

  const amount = Number(transitBuild.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  if (transitBuild.creditAccount !== SUPPLIER_PAYABLE_ACCOUNT) {
    logger.info(
      'Skip supplier settlement: transit build-up not payable-based',
      {
        productId,
        productCode,
        shipmentCode,
        creditAccount: transitBuild.creditAccount,
      }
    );
    return;
  }

  const ref = productCode ? `PRODUCT:${productCode}` : `PRODUCT:${productId}`;
  const descriptionParts = [
    'Supplier payment settlement',
    productCode ? `Product ${productCode}` : `Product #${productId}`,
    shipmentCode ? `Shipment ${shipmentCode}` : null,
  ].filter(Boolean);
  const description = descriptionParts.join(' | ');

  await prisma.$transaction(async (tx) => {
    await tx.clothingAccountingJournalLine.upsert({
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

    await tx.clothingAccountingJournalLine.upsert({
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

export async function postSupplierSettlementForProductPaymentChange(params: {
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

async function logOperationNotification(
  category: string,
  changes: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const id = randomUUID();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    const philippineTime = new Date(now);

    await prisma.$executeRaw`
      INSERT INTO "operations_notifications" (id, category, "user", changes, metadata, "createdAt")
      VALUES (${id}, ${category}, ${'Operations'}, ${changes}, ${metadataJson}::jsonb, ${philippineTime})
    `;
  } catch (error) {
    logger.warn('Failed to log operations notification', { error, category });
  }
}

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

function buildUpdateData(dto: ProductDTO): Prisma.ProductUpdateInput {
  const base = mapFromDTO(dto);
  return { ...base, deletedAt: null };
}

function isPaid(payment?: string | null): boolean {
  return (payment ?? '').trim().toLowerCase() === 'paid';
}

function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function buildAutoReceiptMovementNote(productId: number): string {
  return `auto-receipt product ${productId}`;
}

async function ensureReceiptMovementForProduct(params: {
  productId: number;
  productCode: string | null | undefined;
  quantity: number | null | undefined;
  postingDate?: string | null | undefined;
}) {
  const { productId, productCode, quantity, postingDate } = params;
  const normalizedCode = normalizeProductCode(productCode);
  const qty = quantity ?? 0;

  if (!normalizedCode || qty <= 0) {
    return;
  }

  // If any receipt movement already exists for this product code, do not create
  // a second one (prevents double-counting in movement-based on-hand).
  const existingReceipt = await prisma.inventoryMovement.findFirst({
    where: {
      deletedAt: null,
      productCode: {
        equals: normalizedCode,
        mode: 'insensitive',
      },
      fromBucket: 'scrap',
      toBucket: 'sellable',
    },
    select: { id: true },
  });

  if (existingReceipt) {
    return;
  }

  try {
    await prisma.inventoryMovement.create({
      data: {
        productCode: normalizedCode,
        quantity: qty,
        fromBucket: 'scrap',
        toBucket: 'sellable',
        postingDate: postingDate ?? null,
        notes: buildAutoReceiptMovementNote(productId),
      },
    });
  } catch (error) {
    logger.warn('Failed to create receipt movement for product', {
      error,
      productId,
      productCode: normalizedCode,
      quantity: qty,
    });
  }
}

function buildExpenseFromProduct(
  productId: number,
  dto: ProductDTO
): (ExpenseCreateInput & { sourceId: string }) | null {
  if (!isPaid(dto.Payment)) {
    logger.info('Skip expense post: payment not paid', {
      productId,
      payment: dto.Payment,
    });
    return null;
  }

  const amount = dto['Grand Total'] ?? 0;
  if (!amount || amount <= 0) {
    logger.info('Skip expense post: amount not positive', {
      productId,
      amount,
    });
    return null;
  }

  const dateString = dto['Order Date'] || dto['Posting Date'] || null;
  const date = dateString ? new Date(dateString) : new Date();
  if (Number.isNaN(date.getTime())) {
    logger.info('Skip expense post: invalid date', {
      productId,
      orderDate: dto['Order Date'],
      postingDate: dto['Posting Date'],
    });
    return null;
  }

  if (!isOnOrAfterCutover(date)) {
    logger.info('Skip expense post: before cutover date', {
      productId,
      date: date.toISOString().slice(0, 10),
      cutover: EXPENSE_CUTOVER_DATE.toISOString().slice(0, 10),
    });
    return null;
  }

  const description =
    dto['Product Code'] || dto.Product || `Product #${productId}`;
  const sourceLineKey = dto['Product Code'] || String(productId);

  return {
    date,
    amount,
    description,
    category: 'Products',
    notes: dto.Product ?? undefined,
    receipt: null,
    status: 'pending',
    employeeName: undefined,
    paymentMethod: dto['Payment Method'] ?? undefined,
    paymentCardId: dto['Payment Card Id'] ?? undefined,
    sourceType: 'PRODUCT',
    sourceId: String(productId),
    sourceLineKey,
    systemGenerated: true,
  };
}

export async function postExpenseForProduct(
  productId: number,
  dto: ProductDTO
) {
  if (!ENABLE_PRODUCT_EXPENSE_POSTING) {
    logger.debug('Skip expense post: product-to-expenses disabled', {
      productId,
      payment: dto.Payment,
    });
    return;
  }

  const expensePayload = buildExpenseFromProduct(productId, dto);
  if (!expensePayload) {
    return;
  }

  try {
    const expense = await expenseService.upsertBySource(expensePayload);
    logger.info('Expense posted from product', {
      productId,
      expenseId: expense.id,
      sourceLineKey: expense.sourceLineKey,
    });
  } catch (error) {
    logger.warn('Failed to post expense for product', {
      error,
      productId,
      payment: dto.Payment,
    });
  }
}

export const productService: ProductService = {
  async findActive() {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
    return products.map(mapToDTO);
  },

  async createSingle(payload) {
    const created = await prisma.product.create({ data: mapFromDTO(payload) });
    await ensureReceiptMovementForProduct({
      productId: created.id,
      productCode: created.productCode,
      quantity: created.quantity,
      postingDate: created.postingDate ?? created.orderDate ?? null,
    });
    await postTransitBuildForProduct({ productId: created.id, dto: payload });
    await postExpenseForProduct(created.id, payload);
    return mapToDTO(created);
  },

  async bulkImport(payload) {
    const postings: Array<{ productId: number; dto: ProductDTO }> = [];
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
        const data = mapFromDTO(dto);
        const productCode = data.productCode;
        if (!productCode) {
          continue;
        }

        const existing = await tx.product.findFirst({
          where: { productCode },
        });

        if (existing) {
          const prevPayment = (existing as { payment?: string | null }).payment;
          const wasDeleted = existing.deletedAt !== null;
          await tx.product.update({
            where: { id: existing.id },
            data: buildUpdateData(dto),
          });
          postings.push({ productId: existing.id, dto });

          const nextPayment = dto.Payment;
          if (isPaid(nextPayment) && !isPaid(prevPayment)) {
            settlements.push({
              productId: existing.id,
              productCode: existing.productCode,
              shipmentCode: existing.shipmentCode,
            });
          }

          if (wasDeleted) {
            restored++;
          } else {
            updated++;
          }
        } else {
          const createdProduct = await tx.product.create({ data });
          postings.push({ productId: createdProduct.id, dto });
          transitBuilds.push({ productId: createdProduct.id, dto });
          created++;
        }
      }

      return { created, updated, restored };
    });

    await Promise.all(
      postings.map(({ productId, dto }) =>
        postExpenseForProduct(productId, dto)
      )
    );

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

    // For newly created/imported products, ensure a receipt movement exists so
    // movement-based on-hand can be authoritative.
    await Promise.all(
      postings.map(({ productId, dto }) =>
        ensureReceiptMovementForProduct({
          productId,
          productCode: dto['Product Code'],
          quantity: dto.Quantity ?? 0,
          postingDate: dto['Posting Date'] ?? dto['Order Date'] ?? null,
        })
      )
    );

    return result;
  },

  async bulkUpdate(payload) {
    const postings: Array<{ productId: number; dto: ProductDTO }> = [];
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
      const changeTracking: Array<{
        productId: number;
        productCode: string | null;
        shipmentCode: string | null;
        changes: string[];
      }> = [];

      for (const dto of payload) {
        const data = mapFromDTO(dto);
        const productCode = data.productCode;
        if (!productCode) {
          continue;
        }

        const existing = await tx.product.findFirst({
          where: { productCode },
        });

        if (existing) {
          const prevPayment = (existing as { payment?: string | null }).payment;
          const changes: string[] = [];

          const compare = <T>(label: string, prevValue: T, nextValue: T) => {
            if (prevValue !== nextValue) {
              changes.push(
                `${label}: ${prevValue ?? 'empty'} → ${nextValue ?? 'empty'}`
              );
            }
          };

          compare(
            'shipmentCode',
            existing.shipmentCode ?? 'empty',
            data.shipmentCode ?? 'empty'
          );
          compare(
            'productCode',
            existing.productCode ?? 'empty',
            data.productCode ?? 'empty'
          );
          compare('unitPrice', existing.unitPrice ?? 0, data.unitPrice ?? 0);
          compare('quantity', existing.quantity ?? 0, data.quantity ?? 0);
          compare(
            'alibabaShipping',
            existing.alibabaShippingCost ?? 0,
            data.alibabaShippingCost ?? 0
          );
          compare(
            'exchangeRate',
            existing.exchangeRates ?? 0,
            data.exchangeRates ?? 0
          );

          const wasDeleted = existing.deletedAt !== null;
          await tx.product.update({
            where: { id: existing.id },
            data: buildUpdateData(dto),
          });
          postings.push({ productId: existing.id, dto });

          const nextPayment = dto.Payment;
          if (isPaid(nextPayment) && !isPaid(prevPayment)) {
            settlements.push({
              productId: existing.id,
              productCode: existing.productCode,
              shipmentCode: existing.shipmentCode,
            });
          }

          if (changes.length > 0) {
            changeTracking.push({
              productId: existing.id,
              productCode: productCode,
              shipmentCode: data.shipmentCode || null,
              changes,
            });
          }

          if (wasDeleted) {
            restored++;
          } else {
            updated++;
          }
        } else {
          const createdProduct = await tx.product.create({ data });
          postings.push({ productId: createdProduct.id, dto });
          transitBuilds.push({ productId: createdProduct.id, dto });
          created++;

          const changes: string[] = [];
          if (data.shipmentCode) {
            changes.push(`shipmentCode: empty → ${data.shipmentCode}`);
          }
          if (data.productCode) {
            changes.push(`productCode: empty → ${data.productCode}`);
          }
          if (data.unitPrice) {
            changes.push(`unitPrice: 0 → ${data.unitPrice}`);
          }
          if (data.quantity) {
            changes.push(`quantity: 0 → ${data.quantity}`);
          }
          if (data.alibabaShippingCost) {
            changes.push(`alibabaShipping: 0 → ${data.alibabaShippingCost}`);
          }
          if (data.exchangeRates) {
            changes.push(`exchangeRate: 0 → ${data.exchangeRates}`);
          }

          if (changes.length > 0) {
            changeTracking.push({
              productId: createdProduct.id,
              productCode,
              shipmentCode: data.shipmentCode || null,
              changes,
            });
          }
        }
      }

      return { created, updated, restored, changeTracking };
    });

    await Promise.all(
      postings.map(({ productId, dto }) =>
        postExpenseForProduct(productId, dto)
      )
    );

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

    await Promise.all(
      postings.map(({ productId, dto }) =>
        ensureReceiptMovementForProduct({
          productId,
          productCode: dto['Product Code'],
          quantity: dto.Quantity ?? 0,
          postingDate: dto['Posting Date'] ?? dto['Order Date'] ?? null,
        })
      )
    );

    let notifications = 0;
    if (result.changeTracking.length > 0) {
      await Promise.all(
        result.changeTracking.map(
          async ({ productId, productCode, shipmentCode, changes }) => {
            let message = `Updated product #${productId}`;
            if (productCode && shipmentCode) {
              message += ` - ${productCode} (${shipmentCode})`;
            } else if (productCode) {
              message += ` - ${productCode}`;
            } else if (shipmentCode) {
              message += ` - (${shipmentCode})`;
            }
            if (changes.length > 0) {
              message += ` - Modified: ${changes.join(', ')}`;
            }
            await logOperationNotification('products', message, { productId });
          }
        )
      );
      notifications = result.changeTracking.length;
    }

    return {
      created: result.created,
      updated: result.updated,
      restored: result.restored,
      notifications,
    };
  },

  async softDeleteAll() {
    const alreadyDeleted = await prisma.product.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.product.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return { deleted: result.count, alreadyDeleted };
  },
};
