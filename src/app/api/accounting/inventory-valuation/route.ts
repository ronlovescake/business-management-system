import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiResponse } from '@/core/api';
import {
  getAuthorizationErrorResponse,
  withErrorHandler,
} from '@/core/api/middleware';
import { requireAuth } from '@/lib/auth/session';
import { getRuntimeAccountingCutoverDate } from '@/lib/accounting/cutover';
import { parseDateRangeFromParams } from '@/lib/accounting/date-utils';
import { buildCogsAndInventoryEntries } from '@/lib/accounting/inventory-cogs';
import {
  pickUnitCostFromProductRow,
  summarizeInventoryValuation,
} from '@/lib/accounting/inventoryCogsShared';
import {
  confirmZeroCostMovement,
  costCorrectionSchema,
  recordDatedCostCorrection,
  zeroCostConfirmationSchema,
} from '@/lib/accounting/inventory-valuation';
import {
  FinancialOperationError,
  financialRequestId,
} from '@/lib/accounting/financial-transactions';
import { prisma } from '@/lib/db';

const options = {
  onError: (error: unknown) =>
    error instanceof FinancialOperationError
      ? ApiResponse.error(error.message, error.status)
      : error instanceof z.ZodError
        ? ApiResponse.badRequest('Invalid valuation confirmation')
        : (getAuthorizationErrorResponse(error) ?? undefined),
};

async function requireValuationAdministrator() {
  const actor = await requireAuth();
  if (!['ADMIN', 'SUPER_ADMIN'].includes(actor.role)) {
    throw new FinancialOperationError('Administrator access required.', 403);
  }
  return actor;
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireValuationAdministrator();
  if (request.nextUrl.searchParams.get('review') === 'cost-corrections') {
    const [products, capitalizations, history] = await Promise.all([
      prisma.product.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          productCode: true,
          shipmentCode: true,
          quantity: true,
          landedUnitCost: true,
          cogs: true,
        },
        orderBy: { productCode: 'asc' },
      }),
      prisma.clothingAccountingJournalLine.findMany({
        where: {
          deletedAt: null,
          account: 'Stock on Hand',
          sourceType: { in: ['MANUAL', 'SHIPMENT_LOGISTICS'] },
          date: { lte: new Date() },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.clothingFinancialRequest.findMany({
        where: { operation: 'INVENTORY_COST_CORRECTION' },
        select: { id: true, result: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return ApiResponse.success({
      products: products.map((product) => ({
        id: product.id,
        productCode: product.productCode,
        shipmentCode: product.shipmentCode,
        quantity: product.quantity,
        unitCost: pickUnitCostFromProductRow(product),
      })),
      capitalizations: capitalizations.map((line) => ({
        id: line.id,
        ref: line.ref,
        date: line.date.toISOString(),
        amount: line.debit - line.credit,
      })),
      history: history.map((request) => ({
        id: request.id,
        ...(request.result as object),
      })),
    });
  }
  const cutover = await getRuntimeAccountingCutoverDate();
  const { from, to } = parseDateRangeFromParams(request.nextUrl.searchParams);
  const result = await buildCogsAndInventoryEntries({
    from: from && from > cutover ? from : cutover,
    to: to ?? new Date(),
  });
  return ApiResponse.success(
    summarizeInventoryValuation(result.valuationIssues)
  );
}, options);

export const POST = withErrorHandler(async (request: NextRequest) => {
  const actor = await requireValuationAdministrator();
  const input = zeroCostConfirmationSchema.parse(await request.json());
  return ApiResponse.success(
    await confirmZeroCostMovement(
      financialRequestId(request.headers),
      input,
      actor
    ),
    'Zero-cost confirmation recorded',
    201
  );
}, options);

export const PATCH = withErrorHandler(async (request: NextRequest) => {
  const actor = await requireValuationAdministrator();
  const input = costCorrectionSchema.parse(await request.json());
  return ApiResponse.success(
    await recordDatedCostCorrection(
      financialRequestId(request.headers),
      input,
      actor
    ),
    'Dated cost correction recorded',
    201
  );
}, options);
