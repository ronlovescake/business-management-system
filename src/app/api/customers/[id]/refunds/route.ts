import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import {
  transactionRefundCreateSchema,
  type TransactionRefundCreateInput,
  formatValidationErrors,
} from '@/lib/validations/transaction-refund.validation';

type RouteContext = { params: { id: string } };

type RefundRow = {
  id: number;
  transactionId: number;
  refundDate: string;
  amount: number;
  reason: string | null;
  returnedQuantity: number | null;
  restockBucket: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function buildAutoReturnMovementNote(refundId: number): string {
  return `auto-return refund ${refundId}`;
}

function parseCustomerId(
  context?: RouteContext
): { id: number } | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const idParam = context?.params?.id ?? '';
  const id = Number(idParam);

  if (!idParam || Number.isNaN(id)) {
    return {
      error: ApiResponse.badRequest('Invalid customer ID', {
        id: 'Provide a numeric customer ID in the URL path.',
      }),
    };
  }

  return { id };
}

// GET all refunds for a customer (optionally filter by transactionId)
export const GET = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: idResult.id },
      select: { customerName: true },
    });

    if (!customer) {
      return ApiResponse.notFound('Customer');
    }

    const transactionIdParam =
      request.nextUrl.searchParams.get('transactionId');
    const transactionId = transactionIdParam
      ? Number(transactionIdParam)
      : null;

    if (transactionIdParam && Number.isNaN(transactionId)) {
      return ApiResponse.badRequest('Invalid transactionId', {
        transactionId: 'Provide a numeric transactionId query parameter.',
      });
    }

    const transactionRefund = prisma.transactionRefund;

    const refunds = (await transactionRefund.findMany({
      where: {
        deletedAt: null,
        ...(transactionId ? { transactionId } : {}),
        transaction: {
          deletedAt: null,
          customers: customer.customerName,
        },
      },
      orderBy: [{ refundDate: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        transactionId: true,
        refundDate: true,
        amount: true,
        reason: true,
        returnedQuantity: true,
        restockBucket: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    })) as RefundRow[];

    logger.info('Customer refunds fetched', {
      customerId: idResult.id,
      count: refunds.length,
      transactionId: transactionId ?? undefined,
    });

    return ApiResponse.success(refunds, 'Customer refunds fetched');
  }
);

// POST create a refund record for a transaction belonging to the customer
export const POST = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const customer = await prisma.customer.findUnique({
      where: { id: idResult.id },
      select: { customerName: true },
    });

    if (!customer) {
      return ApiResponse.notFound('Customer');
    }

    const body = await request.json();
    const validation = transactionRefundCreateSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Transaction refund validation failed', {
        customerId: idResult.id,
        issues: validation.error.issues,
      });
      return ApiResponse.badRequest(
        'Validation failed',
        formatValidationErrors(validation.error)
      );
    }

    const sanitized = sanitizeCreateInput(validation.data);
    if ('error' in sanitized) {
      return sanitized.error;
    }

    const tx = await prisma.transaction.findFirst({
      where: {
        id: sanitized.transactionId,
        deletedAt: null,
        customers: customer.customerName,
      },
      select: { id: true, productCode: true, quantity: true },
    });

    if (!tx) {
      return ApiResponse.badRequest('Invalid transaction', {
        transactionId: 'Transaction not found for this customer.',
      });
    }

    const returnedQty = Number(sanitized.returnedQuantity ?? 0);
    const hasReturn = Number.isFinite(returnedQty) && returnedQty > 0;

    if (hasReturn) {
      if (!sanitized.restockBucket) {
        return ApiResponse.badRequest('Missing restockBucket', {
          restockBucket:
            'restockBucket is required when returnedQuantity is provided.',
        });
      }

      if (sanitized.restockBucket === 'sold') {
        return ApiResponse.badRequest('Invalid restockBucket', {
          restockBucket:
            "restockBucket cannot be 'sold' when recording a return.",
        });
      }

      const txQty = Number(tx.quantity ?? 0);
      if (Number.isFinite(txQty) && txQty > 0 && returnedQty > txQty) {
        return ApiResponse.badRequest('Invalid returnedQuantity', {
          returnedQuantity:
            'returnedQuantity cannot exceed the original transaction quantity.',
        });
      }

      const productCode = normalizeProductCode(tx.productCode);
      if (!productCode) {
        return ApiResponse.badRequest('Transaction missing productCode', {
          transactionId:
            'This transaction has no product code; cannot record a stock return.',
        });
      }
    }

    const created = await prisma.$transaction(async (txClient) => {
      const transactionRefund = txClient.transactionRefund;

      const refund = (await transactionRefund.create({
        data: {
          transactionId: sanitized.transactionId,
          refundDate: sanitized.refundDate,
          amount: sanitized.amount,
          reason: sanitized.reason,
          returnedQuantity: sanitized.returnedQuantity,
          restockBucket: sanitized.restockBucket,
          notes: sanitized.notes,
        },
        select: {
          id: true,
          transactionId: true,
          refundDate: true,
          amount: true,
          reason: true,
          returnedQuantity: true,
          restockBucket: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      })) as RefundRow;

      if (hasReturn && refund.restockBucket) {
        const productCode = normalizeProductCode(tx.productCode);
        const note = buildAutoReturnMovementNote(refund.id);

        const existingReturnMovement =
          await txClient.inventoryMovement.findFirst({
            where: {
              deletedAt: null,
              notes: note,
            },
            select: { id: true },
          });

        if (!existingReturnMovement) {
          await txClient.inventoryMovement.create({
            data: {
              productCode,
              quantity: returnedQty,
              fromBucket: 'sold',
              toBucket: refund.restockBucket as
                | 'sellable'
                | 'damaged_hold'
                | 'reserved'
                | 'assembly_wip'
                | 'scrap'
                | 'supplier_short'
                | 'sold',
              postingDate: refund.refundDate,
              notes: note,
            },
          });
        }
      }

      return refund;
    });

    logger.info('Transaction refund created', {
      customerId: idResult.id,
      transactionId: sanitized.transactionId,
      refundId: created.id,
    });

    return ApiResponse.success(created, 'Refund recorded', 201);
  }
);

function sanitizeCreateInput(input: TransactionRefundCreateInput):
  | {
      transactionId: number;
      refundDate: string;
      amount: number;
      reason: string | null;
      returnedQuantity: number | null;
      restockBucket:
        | 'sellable'
        | 'damaged_hold'
        | 'reserved'
        | 'assembly_wip'
        | 'scrap'
        | 'supplier_short'
        | 'sold'
        | null;
      notes: string | null;
    }
  | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const refundDate = sanitizers.date(input.refundDate);
  if (!refundDate) {
    return {
      error: ApiResponse.badRequest('Invalid refundDate', {
        refundDate: 'Provide a valid date (YYYY-MM-DD or ISO format).',
      }),
    };
  }

  const amount = sanitizers.number(input.amount, { min: 0, decimals: 2 }) ?? 0;

  const returnedQuantityRaw =
    input.returnedQuantity === undefined || input.returnedQuantity === null
      ? null
      : sanitizers.number(input.returnedQuantity, { min: 0, decimals: 3 });

  if (input.returnedQuantity !== undefined && input.returnedQuantity !== null) {
    if (returnedQuantityRaw === null) {
      return {
        error: ApiResponse.badRequest('Invalid returnedQuantity', {
          returnedQuantity: 'Provide a non-negative number.',
        }),
      };
    }
  }

  const reason =
    input.reason === undefined || input.reason === null
      ? null
      : sanitizers.name(input.reason) || null;

  const notes =
    input.notes === undefined || input.notes === null
      ? null
      : sanitizers.notes(input.notes) || null;

  return {
    transactionId: input.transactionId,
    refundDate,
    amount,
    reason,
    returnedQuantity: returnedQuantityRaw,
    restockBucket: input.restockBucket ?? null,
    notes,
  };
}
