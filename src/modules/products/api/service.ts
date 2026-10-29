import { randomUUID } from 'crypto';
import {
  applySupplierCreditInTransaction,
  assertSupplierFundingWrite,
  supplierOperationsUser,
} from './supplier-resolution';
import { hasSupplierSettlementForTransitKeys } from '@/lib/accounting/supplier-settlement-dependencies';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  getAccountingCutoverDate,
  getRuntimeAccountingCutoverDate,
} from '@/lib/accounting/cutover';
import { pickUnitCostFromProductRow } from '@/lib/accounting/inventoryCogsShared';
import { parseDate } from '@/lib/accounting/date-utils';
import {
  getPaymentAccountForMethod,
  getSupplierSettlementCreditAccount,
} from '@/lib/accounting/payment-accounts';
import { mapFromDTO, mapToDTO } from './dto';
import type { ProductDTO } from './dto';
import { expenseService } from '@/modules/clothing/ledger/api/service';
import type { ExpenseCreateInput } from '@/modules/clothing/ledger/api/schemas';
import { getCurrentDateISO } from '@/utils/date';

// Cutover rule: only auto-post expenses for orders on/after this date
const EXPENSE_CUTOVER_DATE = new Date('2026-01-01');
const isOnOrAfterCutover = (date: Date) => date >= EXPENSE_CUTOVER_DATE;

// Accounting policy: product costs/COGS are handled in the ledger; the Expenses
// module is reserved for operational expenses.
const ENABLE_PRODUCT_EXPENSE_POSTING = false;

const ACCOUNTING_CUTOVER_DATE = getAccountingCutoverDate();

const INVENTORY_IN_TRANSIT_ACCOUNT = 'Inventory in Transit';
const OPENING_EQUITY_ACCOUNT = 'Opening Equity';
const LANDED_COST_CLEARING_ACCOUNT = 'Landed Cost Clearing';
const SUPPLIER_PAYABLE_ACCOUNT = 'Supplier Payable';
const FORWARDER_PAYABLE_ACCOUNT = 'Forwarder Payable';
const COURIER_PAYABLE_ACCOUNT = 'Courier Payable';

// Feature flag: set to true to include forwarder fee & lalamove entries in
// transit build-up.  Disabled because these costs are handled separately via
// the Logistics Costs tab on the Shipments page.
const ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS = false;

function normalizeToUtcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}

function isOnOrAfterAccountingCutover(date: Date): boolean {
  return date >= ACCOUNTING_CUTOVER_DATE;
}

function buildProductTransitBuildIdempotencyKey(productId: number): string {
  return `PRODUCT_TRANSIT_BUILD:${productId}:`;
}

async function postSupplierSettlementForProduct(
  params: {
    productId: number;
    productCode: string | null;
    shipmentCode: string | null;
    paymentMethod: string | null;
    existingSettlement: Array<{
      sourceLineKey: string;
      account: string;
      debit: number;
      credit: number;
    }>;
  },
  tx: Prisma.TransactionClient
): Promise<void> {
  const { productId, productCode, shipmentCode } = params;

  const today = new Date(`${getCurrentDateISO()}T00:00:00.000Z`);
  if (!isOnOrAfterAccountingCutover(today)) {
    return;
  }

  const transitBuildRows = await tx.clothingInventoryTransitBuildEntry.findMany(
    {
      where: {
        deletedAt: null,
        idempotencyKey: {
          startsWith: buildProductTransitBuildIdempotencyKey(productId),
        },
        creditAccount: SUPPLIER_PAYABLE_ACCOUNT,
      },
      select: { amount: true },
    }
  );

  if (transitBuildRows.length === 0) {
    logger.info('Skip supplier settlement: missing transit build-up entry', {
      productId,
      productCode,
      shipmentCode,
    });
    return;
  }

  const amount = transitBuildRows.reduce(
    (sum, row) => sum + Number(row.amount ?? 0),
    0
  );
  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const settlementCreditAccount = getSupplierSettlementCreditAccount(
    params.paymentMethod
  );
  if (!settlementCreditAccount) {
    throw new ProductSupplierSettlementError(
      "A supported Payment Method is required to settle this product's Supplier Payable."
    );
  }

  const expectedLines = [
    {
      sourceLineKey: 'SUPPLIER_SETTLEMENT:debit',
      account: SUPPLIER_PAYABLE_ACCOUNT,
      debit: amount,
      credit: 0,
    },
    {
      sourceLineKey: 'SUPPLIER_SETTLEMENT:credit',
      account: settlementCreditAccount,
      debit: 0,
      credit: amount,
    },
  ];
  for (const line of params.existingSettlement) {
    const expected = expectedLines.find(
      (candidate) => candidate.sourceLineKey === line.sourceLineKey
    );
    if (
      !expected ||
      expected.account !== line.account ||
      Math.round(expected.debit * 100) !== Math.round(line.debit * 100) ||
      Math.round(expected.credit * 100) !== Math.round(line.credit * 100)
    ) {
      throw new ProductSupplierSettlementError(
        'Supplier settlement already exists with different payment details. Reverse it before changing the payment.',
        409
      );
    }
  }
  if (params.existingSettlement.length === 2) {
    return;
  }
  const { getCurrentUser } = await import('@/lib/auth/session');
  const user = await getCurrentUser();
  if (!user) {
    throw new ProductSupplierSettlementError('Authentication required', 401);
  }
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    throw new ProductSupplierSettlementError(
      'Only an administrator may post a supplier settlement.',
      403
    );
  }

  const ref = productCode ? `PRODUCT:${productCode}` : `PRODUCT:${productId}`;
  const descriptionParts = [
    'Supplier payment settlement',
    productCode ? `Product ${productCode}` : `Product #${productId}`,
    shipmentCode ? `Shipment ${shipmentCode}` : null,
  ].filter(Boolean);
  const description = descriptionParts.join(' | ');

  const debitLine = await tx.clothingAccountingJournalLine.upsert({
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
    update: {},
  });

  const creditLine = await tx.clothingAccountingJournalLine.upsert({
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
      account: settlementCreditAccount,
      debit: 0,
      credit: amount,
      description,
      sourceType: 'PRODUCT',
      sourceId: String(productId),
      sourceLineKey: 'SUPPLIER_SETTLEMENT:credit',
      systemGenerated: true,
    },
    update: {},
  });
  if (debitLine.deletedAt || creditLine.deletedAt) {
    throw new ProductSupplierSettlementError(
      'A deleted supplier settlement already owns these posting keys. Resolve or reverse it before retrying the payment.',
      409
    );
  }
}

export async function postSupplierSettlementForProductPaymentChange(
  params: {
    productId: number;
    prevPayment: string | null | undefined;
    nextPayment: string | null | undefined;
    productCode: string | null;
    shipmentCode: string | null;
    paymentMethod: string | null;
  },
  tx: Prisma.TransactionClient
): Promise<void> {
  const { productId, nextPayment, productCode, shipmentCode, paymentMethod } =
    params;

  const existingSettlement = await tx.clothingAccountingJournalLine.findMany({
    where: {
      sourceType: 'PRODUCT',
      sourceId: String(productId),
      deletedAt: null,
      sourceLineKey: {
        in: ['SUPPLIER_SETTLEMENT:debit', 'SUPPLIER_SETTLEMENT:credit'],
      },
    },
    select: { sourceLineKey: true, account: true, debit: true, credit: true },
  });
  if (!isPaid(nextPayment) && existingSettlement.length > 0) {
    throw new ProductSupplierSettlementError(
      'Reverse the existing supplier settlement before changing the product to Unpaid.',
      409
    );
  }
  if (isPaid(nextPayment)) {
    await postSupplierSettlementForProduct(
      {
        productId,
        productCode,
        shipmentCode,
        paymentMethod,
        existingSettlement,
      },
      tx
    );
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
  postManualTransitBuildUpByShipmentCode: (params: {
    shipmentCode: string;
    fundingSource?: 'PAYMENT' | 'OPENING_BALANCE';
    openingBalanceConfirmed?: boolean;
  }) => Promise<{ created: number; skipped: number; products: number }>;
  softDeleteAll: () => Promise<{ deleted: number; alreadyDeleted: number }>;
}

function buildUpdateData(dto: ProductDTO): Prisma.ProductUpdateInput {
  const base = mapFromDTO(dto);
  return { ...base, deletedAt: null };
}

async function findProductForWrite(
  tx: Prisma.TransactionClient,
  dto: ProductDTO
) {
  if (dto.id !== undefined) {
    if (!Number.isSafeInteger(dto.id) || dto.id <= 0) {
      throw new Error('Invalid product ID');
    }
    const product = await tx.product.findUnique({ where: { id: dto.id } });
    if (!product) {
      throw new Error(`Product ${dto.id} no longer exists`);
    }
    return product;
  }

  const matches = await tx.product.findMany({
    where: { productCode: dto['Product Code'] },
    take: 2,
  });
  if (matches.length > 1) {
    throw new Error(
      `Product code ${dto['Product Code']} is ambiguous; use a product ID`
    );
  }
  return matches[0] ?? null;
}

function isPaid(payment?: string | null): boolean {
  return (payment ?? '').trim().toLowerCase() === 'paid';
}

export class ProductShipmentAccountingConflictError extends Error {
  constructor(shipmentCode: string, message?: string) {
    super(
      message ??
        `Cannot change Product Code or Shipment Code, or delete this product, while active transit-build, reclass, or supplier settlement entries exist for ${shipmentCode || 'this product'}. Reverse or resolve those entries first.`
    );
    this.name = 'ProductShipmentAccountingConflictError';
  }
}

export class ProductSupplierSettlementError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 409 = 400
  ) {
    super(message);
  }
}

export async function assertProductAccountingIdentityChange(
  client: Pick<
    Prisma.TransactionClient,
    | 'clothingInventoryTransitBuildEntry'
    | 'clothingInventoryReclassEntry'
    | 'clothingAccountingJournalLine'
    | 'inventoryMovement'
  >,
  existing: {
    id: number;
    productCode: string | null;
    shipmentCode: string | null;
    supplierFulfillmentStatus?: string;
    supplierCreditAppliedAmount?: Prisma.Decimal;
    landedUnitCost?: number;
    cogs?: number;
    quantity?: number;
  },
  next: {
    productCode?: string | null;
    shipmentCode?: string | null;
    landedUnitCost?: number;
    cogs?: number;
    quantity?: number;
  } | null
): Promise<void> {
  if (!next) {
    assertSupplierFundingWrite(existing, null);
  }
  if (next && (next.landedUnitCost !== undefined || next.cogs !== undefined)) {
    const oldCost = pickUnitCostFromProductRow(existing);
    const newCost = pickUnitCostFromProductRow({
      landedUnitCost: next.landedUnitCost ?? existing.landedUnitCost,
      cogs: next.cogs ?? existing.cogs,
      quantity: next.quantity ?? existing.quantity,
    });
    if (
      oldCost !== newCost &&
      (await client.inventoryMovement.findFirst({
        where: {
          deletedAt: null,
          OR: [
            { productId: existing.id },
            ...(existing.productCode
              ? [{ productCode: existing.productCode }]
              : []),
          ],
        },
        select: { id: true },
      }))
    ) {
      throw new ProductShipmentAccountingConflictError(
        existing.shipmentCode ?? '',
        'Use an administrator-approved dated cost correction for products with inventory history. Original movement costs cannot be rewritten by an edit or import.'
      );
    }
  }
  if (
    next &&
    (existing.productCode ?? '').trim() === (next.productCode ?? '').trim() &&
    (existing.shipmentCode ?? '').trim() === (next.shipmentCode ?? '').trim()
  ) {
    return;
  }

  const [transitEntries, reclassEntries, settlementEntries] = await Promise.all(
    [
      client.clothingInventoryTransitBuildEntry.findMany({
        where: {
          deletedAt: null,
          OR: [
            {
              idempotencyKey: {
                startsWith: buildProductTransitBuildIdempotencyKey(existing.id),
              },
            },
            ...(existing.shipmentCode
              ? [
                  {
                    shipmentCode: existing.shipmentCode,
                    idempotencyKey: { startsWith: 'SHIPMENT_TRANSIT_BUILD:' },
                  },
                ]
              : []),
          ],
        },
        select: { id: true },
      }),
      client.clothingInventoryReclassEntry.findMany({
        where: {
          deletedAt: null,
          OR: [
            { productId: existing.id },
            ...(existing.productCode
              ? [{ productCode: existing.productCode }]
              : []),
          ],
        },
        select: { id: true },
      }),
      client.clothingAccountingJournalLine.findMany({
        where: {
          deletedAt: null,
          sourceType: 'PRODUCT',
          sourceId: String(existing.id),
          sourceLineKey: { startsWith: 'SUPPLIER_SETTLEMENT:' },
        },
        select: { id: true },
      }),
    ]
  );

  if (
    transitEntries.length > 0 ||
    reclassEntries.length > 0 ||
    settlementEntries.length > 0
  ) {
    throw new ProductShipmentAccountingConflictError(
      existing.shipmentCode ?? ''
    );
  }
}

function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function resolvePostingDateFromProduct(params: {
  postingDate: string | null;
  orderDate: string | null;
}): Date | null {
  const parsed = parseDate(params.postingDate) ?? parseDate(params.orderDate);
  if (!parsed) {
    return null;
  }
  return normalizeToUtcMidnight(parsed);
}

function buildAutoReceiptMovementNote(productId: number): string {
  return `auto-receipt product ${productId}`;
}

async function ensureReceiptMovementForProduct(params: {
  productId: number;
  productCode: string | null | undefined;
  quantity: number | null | undefined;
  unitCost: number | null;
  postingDate?: string | null | undefined;
}) {
  const { productId, productCode, quantity, postingDate, unitCost } = params;
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
      productId,
      toBucket: 'sellable',
      // Any non-sellable -> sellable movement counts as a receipt ledger.
      // This prevents accidental double-receipts (e.g., opening_inventory->sellable
      // backfill plus an auto-receipt).
      fromBucket: { not: 'sellable' },
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
        product: { connect: { id: productId } },
        quantity: qty,
        unitCost:
          unitCost !== null && Number.isFinite(unitCost) && unitCost > 0
            ? unitCost
            : null,
        costBasis:
          unitCost !== null && Number.isFinite(unitCost) && unitCost > 0
            ? 'PURCHASE'
            : null,
        // Use opening_inventory as the canonical source bucket for receipts.
        // (We keep `scrap` reserved for actual write-offs, not receiving.)
        fromBucket: 'opening_inventory',
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

async function logProductBulkChange(
  action: string,
  payload: ProductDTO[],
  created: number,
  updated: number,
  restored: number
): Promise<void> {
  try {
    const { getCurrentUser } = await import('@/lib/auth/session');
    const { recordChange } = await import('@/core/change-log');
    const user = await getCurrentUser().catch(() => null);
    const productCodes = payload
      .map((dto) => dto['Product Code'])
      .filter((code): code is string => !!code)
      .slice(0, 50);
    await recordChange(
      {
        entityType: 'product',
        action,
        field: action,
        newValue: { count: payload.length, created, updated, restored },
        metadata: { productCodes, totalCount: payload.length },
      },
      {
        userId: user?.id ?? null,
        userName: user?.name ?? null,
        source: `products:${action}`,
      }
    );
  } catch (error) {
    logger.warn('Failed to record change log for product bulk operation', {
      error,
      action,
    });
  }
}

export const productService: ProductService = {
  async findActive() {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { id: 'asc' },
    });
    const shipmentCodes = Array.from(
      new Set(
        products
          .map((product) => product.shipmentCode)
          .filter((code): code is string => Boolean(code))
      )
    );
    const shipments = shipmentCodes.length
      ? await prisma.shipment.findMany({
          where: { shipmentCode: { in: shipmentCodes }, deletedAt: null },
          select: { shipmentCode: true, shipmentStatus: true },
        })
      : [];
    const shipmentStatusByCode = new Map(
      shipments.map((shipment) => [
        shipment.shipmentCode,
        shipment.shipmentStatus,
      ])
    );
    return products.map((product) => {
      const dto = mapToDTO(product);
      const shipmentStatus = product.shipmentCode
        ? shipmentStatusByCode.get(product.shipmentCode)
        : null;
      if (shipmentStatus) {
        dto['Shipment Status'] = shipmentStatus;
      }
      return dto;
    });
  },

  async createSingle(payload) {
    let created;
    const supplierCreditId = payload['Supplier Credit Id'];
    if (supplierCreditId) {
      const user = await supplierOperationsUser();
      const requestId = payload['Supplier Credit Request Id'];
      if (!requestId) {
        throw new ProductSupplierSettlementError(
          'A stable request ID is required for supplier-credit funding.'
        );
      }
      created = await prisma
        .$transaction(
          async (tx) => {
            const replay =
              await tx.clothingSupplierCreditApplication.findUnique({
                where: { requestId },
                include: { targetProduct: true },
              });
            if (replay) {
              const desired = mapFromDTO(payload);
              const purchaseChanged = (
                [
                  'supplierReference',
                  'shipmentCode',
                  'productCode',
                  'product',
                  'quantity',
                  'unitPrice',
                  'exchangeRates',
                  'alibabaShippingCost',
                  'transactionFee',
                  'grandTotal',
                  'payment',
                  'paymentMethod',
                  'postingDate',
                  'orderDate',
                ] as const
              ).some(
                (field) =>
                  String(desired[field] ?? '') !==
                  String(replay.targetProduct[field] ?? '')
              );
              if (
                replay.creditId !== payload['Supplier Credit Id'] ||
                Number(replay.amount) !== payload['Supplier Credit Amount'] ||
                purchaseChanged ||
                (replay.targetProduct.paymentCardId ?? null) !==
                  (payload['Payment Card Id'] ?? null)
              ) {
                throw new ProductSupplierSettlementError(
                  'This request ID already belongs to a different funded purchase.',
                  409
                );
              }
              return replay.targetProduct;
            }
            const product = await tx.product.create({
              data: mapFromDTO(payload),
            });
            await applySupplierCreditInTransaction(tx, {
              productId: product.id,
              creditId: supplierCreditId,
              amount: payload['Supplier Credit Amount'] ?? 0,
              supplierReference: payload['Supplier Reference'] ?? '',
              postingDate: product.postingDate || product.orderDate || '',
              requestId,
              userId: user.id,
            });
            return tx.product.findUniqueOrThrow({ where: { id: product.id } });
          },
          { isolationLevel: 'Serializable' }
        )
        .catch((error: unknown) => {
          if (
            error &&
            typeof error === 'object' &&
            'code' in error &&
            ['P2002', 'P2034'].includes(String(error.code))
          ) {
            throw new ProductSupplierSettlementError(
              'The funded purchase conflicted with another request. Refresh and retry using the same request ID.',
              409
            );
          }
          throw error;
        });
    } else {
      created = await prisma.product.create({ data: mapFromDTO(payload) });
    }
    await ensureReceiptMovementForProduct({
      productId: created.id,
      productCode: created.productCode,
      quantity: created.quantity,
      unitCost: pickUnitCostFromProductRow(created) || null,
      postingDate: created.postingDate ?? created.orderDate ?? null,
    });
    await postExpenseForProduct(created.id, payload);
    return mapToDTO(created);
  },

  async bulkImport(payload) {
    if (payload.some((row) => row['Supplier Credit Id'])) {
      throw new ProductSupplierSettlementError(
        'Apply supplier credit to one product through the product form, not a bulk import.'
      );
    }
    const postings: Array<{ productId: number; dto: ProductDTO }> = [];

    const result = await prisma.$transaction(
      async (tx) => {
        let created = 0;
        let updated = 0;
        let restored = 0;

        for (const dto of payload) {
          const data = mapFromDTO(dto);
          const productCode = data.productCode;
          if (!productCode) {
            continue;
          }

          const existing = await findProductForWrite(tx, dto);

          if (existing) {
            assertSupplierFundingWrite(existing, data);
            const prevPayment = (existing as { payment?: string | null })
              .payment;
            const wasDeleted = existing.deletedAt !== null;
            await assertProductAccountingIdentityChange(tx, existing, data);
            await tx.product.update({
              where: { id: existing.id },
              data: buildUpdateData(dto),
            });
            postings.push({ productId: existing.id, dto });

            await postSupplierSettlementForProductPaymentChange(
              {
                productId: existing.id,
                prevPayment,
                nextPayment: dto.Payment,
                productCode: data.productCode ?? null,
                shipmentCode: data.shipmentCode ?? null,
                paymentMethod: dto['Payment Method'] ?? null,
              },
              tx
            );

            if (wasDeleted) {
              restored++;
            } else {
              updated++;
            }
          } else {
            const createdProduct = await tx.product.create({ data });
            postings.push({ productId: createdProduct.id, dto });
            created++;
          }
        }

        return { created, updated, restored };
      },
      { isolationLevel: 'Serializable' }
    );

    await Promise.all(
      postings.map(({ productId, dto }) =>
        postExpenseForProduct(productId, dto)
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
          unitCost: pickUnitCostFromProductRow(mapFromDTO(dto)) || null,
          postingDate: dto['Posting Date'] ?? dto['Order Date'] ?? null,
        })
      )
    );

    void logProductBulkChange(
      'bulk_import',
      payload,
      result.created,
      result.updated,
      result.restored
    );
    return result;
  },

  async bulkUpdate(payload) {
    if (payload.some((row) => row['Supplier Credit Id'])) {
      throw new ProductSupplierSettlementError(
        'Use the dedicated supplier-credit action for existing products.'
      );
    }
    const postings: Array<{ productId: number; dto: ProductDTO }> = [];

    const result = await prisma.$transaction(
      async (tx) => {
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

          const existing = await findProductForWrite(tx, dto);

          if (existing) {
            const prevPayment = (existing as { payment?: string | null })
              .payment;
            const changes: string[] = [];

            assertSupplierFundingWrite(existing, data);
            await assertProductAccountingIdentityChange(tx, existing, data);

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

            await postSupplierSettlementForProductPaymentChange(
              {
                productId: existing.id,
                prevPayment,
                nextPayment: dto.Payment,
                productCode: data.productCode ?? null,
                shipmentCode: data.shipmentCode ?? null,
                paymentMethod: dto['Payment Method'] ?? null,
              },
              tx
            );

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
      },
      { isolationLevel: 'Serializable' }
    );

    await Promise.all(
      postings.map(({ productId, dto }) =>
        postExpenseForProduct(productId, dto)
      )
    );

    await Promise.all(
      postings.map(({ productId, dto }) =>
        ensureReceiptMovementForProduct({
          productId,
          productCode: dto['Product Code'],
          quantity: dto.Quantity ?? 0,
          unitCost: pickUnitCostFromProductRow(mapFromDTO(dto)) || null,
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

    void logProductBulkChange(
      'bulk_update',
      payload,
      result.created,
      result.updated,
      result.restored
    );
    return {
      created: result.created,
      updated: result.updated,
      restored: result.restored,
      notifications,
    };
  },

  async postManualTransitBuildUpByShipmentCode(params) {
    const fundingSource = params.fundingSource ?? 'PAYMENT';
    if (fundingSource !== 'PAYMENT' && fundingSource !== 'OPENING_BALANCE') {
      throw new ProductSupplierSettlementError(
        'Invalid transit funding source.'
      );
    }
    const isOpeningBalance = fundingSource === 'OPENING_BALANCE';
    if (isOpeningBalance && params.openingBalanceConfirmed !== true) {
      throw new ProductSupplierSettlementError(
        'Confirm that the supplier was paid before cutover and the goods were still in transit at cutover.'
      );
    }
    const openingDate = isOpeningBalance
      ? await getRuntimeAccountingCutoverDate()
      : null;
    const shipmentCode = (params.shipmentCode ?? '').toString().trim();
    if (!shipmentCode) {
      return { created: 0, skipped: 0, products: 0 };
    }

    return prisma.$transaction(
      async (tx) => {
        const products = await tx.product.findMany({
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
            paymentMethod: true,
            postingDate: true,
            orderDate: true,
            grandTotal: true,
            forwardersFee: true,
            lalamove: true,
            supplierFulfillmentStatus: true,
            supplierCreditAppliedAmount: true,
          },
          orderBy: { id: 'asc' },
        });

        if (isOpeningBalance) {
          if (products.length === 0) {
            throw new ProductSupplierSettlementError(
              'No products are linked to this shipment.'
            );
          }
          const existingOpening =
            await tx.clothingAccountingOpeningBalance.findFirst({
              where: {
                deletedAt: null,
                account: INVENTORY_IN_TRANSIT_ACCOUNT,
              },
              select: { id: true },
            });
          const existingManualTransit =
            await tx.clothingAccountingJournalLine.findFirst({
              where: {
                deletedAt: null,
                sourceType: 'MANUAL',
                account: INVENTORY_IN_TRANSIT_ACCOUNT,
                debit: { gt: 0 },
              },
              select: { id: true },
            });
          if (existingOpening || existingManualTransit) {
            throw new ProductSupplierSettlementError(
              'Inventory in Transit already has a standalone opening or manual debit. Reconcile that entry before posting opening transit funding.',
              409
            );
          }
        }

        const existingBuildKeys =
          await tx.clothingInventoryTransitBuildEntry.findMany({
            where: {
              deletedAt: null,
              shipmentCode: {
                equals: shipmentCode,
                mode: 'insensitive',
              },
            },
            select: { idempotencyKey: true, creditAccount: true },
          });

        if (
          existingBuildKeys.some(
            (row) => !row.idempotencyKey.startsWith('PRODUCT_TRANSIT_BUILD:')
          )
        ) {
          throw new ProductShipmentAccountingConflictError(shipmentCode);
        }
        if (
          isOpeningBalance &&
          existingBuildKeys.some(
            (row) => row.creditAccount !== OPENING_EQUITY_ACCOUNT
          )
        ) {
          throw new ProductSupplierSettlementError(
            'This shipment already has payment-funded transit entries. Opening funding cannot replace or duplicate them.',
            409
          );
        }

        const alreadyPostedProductIds = new Set<number>();
        for (const row of existingBuildKeys) {
          const parts = (row.idempotencyKey ?? '').split(':');
          const productId = Number(parts[1] ?? NaN);
          if (Number.isFinite(productId)) {
            alreadyPostedProductIds.add(productId);
          }
        }

        const entries: Prisma.ClothingInventoryTransitBuildEntryCreateManyInput[] =
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
            `Product #${params.productId}`,
            params.productCode ? `Code: ${params.productCode}` : null,
            params.productName ? `Name: ${params.productName}` : null,
            `Component: ${params.componentLabel}`,
            `Payment: ${params.payment}`,
            isOpeningBalance
              ? `Funding: Opening Balance | Cutover: ${openingDate?.toISOString().slice(0, 10)} | Confirmed paid before cutover and in transit at cutover`
              : null,
          ].filter(Boolean);

          entries.push({
            postingDate: params.postingDate,
            shipmentId: null,
            shipmentCode,
            amount: params.amount,
            debitAccount: params.debitAccount,
            creditAccount: params.creditAccount,
            idempotencyKey: `PRODUCT_TRANSIT_BUILD:${params.productId}:${params.componentKey}`,
            notes: notesParts.join(' | '),
          });
        };

        let skippedProducts = 0;

        for (const product of products) {
          if (openingDate) {
            const orderDate = parseDate(product.orderDate);
            if (
              !isPaid(product.payment) ||
              !orderDate ||
              normalizeToUtcMidnight(orderDate) >= openingDate ||
              product.supplierFulfillmentStatus === 'CREDIT_ISSUED' ||
              Number(product.supplierCreditAppliedAmount ?? 0) > 0 ||
              !Number.isFinite(toAmount(product.grandTotal)) ||
              toAmount(product.grandTotal) <= 0
            ) {
              throw new ProductSupplierSettlementError(
                `Opening transit requires every linked product to be a paid, positive-cost purchase ordered before cutover without supplier credit. Check ${product.productCode || product.id}.`
              );
            }
          }
          if (
            alreadyPostedProductIds.has(product.id) ||
            product.supplierFulfillmentStatus === 'CREDIT_ISSUED' ||
            Number(product.supplierCreditAppliedAmount ?? 0) > 0
          ) {
            skippedProducts += 1;
            continue;
          }

          const payment = (product.payment ?? '').toString().trim();
          if (!payment) {
            continue;
          }

          const paymentCreditAccount = isOpeningBalance
            ? OPENING_EQUITY_ACCOUNT
            : isPaid(payment)
              ? getPaymentAccountForMethod(product.paymentMethod)
              : SUPPLIER_PAYABLE_ACCOUNT;
          if (!paymentCreditAccount) {
            skippedProducts += 1;
            continue;
          }

          const postingDate =
            openingDate ??
            resolvePostingDateFromProduct({
              postingDate: product.postingDate,
              orderDate: product.orderDate,
            });
          if (!postingDate) {
            continue;
          }

          if (!isOpeningBalance && !isOnOrAfterAccountingCutover(postingDate)) {
            continue;
          }

          const forwarderCreditAccount = isPaid(payment)
            ? paymentCreditAccount
            : FORWARDER_PAYABLE_ACCOUNT;

          const courierCreditAccount = isPaid(payment)
            ? paymentCreditAccount
            : COURIER_PAYABLE_ACCOUNT;

          addEntry({
            productId: product.id,
            productCode: product.productCode,
            productName: product.product,
            payment,
            postingDate,
            debitAccount: INVENTORY_IN_TRANSIT_ACCOUNT,
            creditAccount: paymentCreditAccount,
            componentKey: 'GRAND_TOTAL',
            componentLabel: 'Grand Total',
            amount: toAmount(product.grandTotal),
          });

          if (!isOpeningBalance && ENABLE_TRANSIT_BUILD_LOGISTICS_COMPONENTS) {
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
        }

        if (entries.length === 0) {
          return {
            created: 0,
            skipped: skippedProducts,
            products: products.length,
          };
        }

        const reclass = await tx.clothingInventoryReclassEntry.findFirst({
          where: {
            shipmentCode: { equals: shipmentCode, mode: 'insensitive' },
            deletedAt: null,
          },
          select: { id: true },
        });
        if (reclass) {
          throw new ProductShipmentAccountingConflictError(shipmentCode);
        }
        if (
          await hasSupplierSettlementForTransitKeys(
            tx,
            entries.map((entry) => entry.idempotencyKey)
          )
        ) {
          throw new ProductShipmentAccountingConflictError(shipmentCode);
        }

        if (
          await tx.clothingInventoryTransitBuildEntry.findFirst({
            where: {
              deletedAt: { not: null },
              idempotencyKey: {
                in: entries.map((entry) => entry.idempotencyKey),
              },
              ...(!isOpeningBalance
                ? { creditAccount: OPENING_EQUITY_ACCOUNT }
                : {}),
            },
            select: { id: true },
          })
        ) {
          throw new ProductSupplierSettlementError(
            isOpeningBalance
              ? 'Deleted transit funding already owns these posting keys. Resolve its history before posting an opening.'
              : 'Deleted opening funding cannot be restored as a purchase payment. Resolve its history first.',
            409
          );
        }

        let restored = 0;
        for (const entry of entries) {
          const updated =
            await tx.clothingInventoryTransitBuildEntry.updateMany({
              where: {
                deletedAt: { not: null },
                idempotencyKey: entry.idempotencyKey,
              },
              data: { ...entry, deletedAt: null },
            });
          restored += updated.count;
        }

        const created = await tx.clothingInventoryTransitBuildEntry.createMany({
          data: entries,
          skipDuplicates: true,
        });
        const result = { count: created.count + restored };

        const skippedEntries = Math.max(0, entries.length - result.count);

        return {
          created: result.count,
          skipped: skippedProducts + skippedEntries,
          products: products.length,
        };
      },
      { isolationLevel: 'Serializable' }
    );
  },

  async softDeleteAll() {
    const alreadyDeleted = await prisma.product.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.$transaction(
      async (tx) => {
        const products = await tx.product.findMany({
          where: { deletedAt: null },
          select: { id: true, productCode: true, shipmentCode: true },
        });
        for (const product of products) {
          await assertProductAccountingIdentityChange(tx, product, null);
        }
        return tx.product.updateMany({
          where: { deletedAt: null },
          data: { deletedAt: new Date() },
        });
      },
      { isolationLevel: 'Serializable' }
    );

    return { deleted: result.count, alreadyDeleted };
  },
};
