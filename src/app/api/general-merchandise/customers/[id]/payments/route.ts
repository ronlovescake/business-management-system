import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import {
  transactionPaymentCreateSchema,
  type TransactionPaymentCreateInput,
  formatValidationErrors,
} from '@/lib/validations/transaction-payment.validation';

type RouteContext = { params: { id: string } };

type TransactionMetaRow = { id: number; quantity: number; unitPrice: number };

type PaymentRow = {
  id: number;
  transactionId: number;
  paymentDate: string;
  amount: number;
  method: string | null;
  notes: string | null;
  isReservation: boolean;
  createdAt: Date;
  updatedAt: Date;
};

async function supportsReservationFlag(): Promise<boolean> {
  try {
    const rows = (await prisma.$queryRaw<
      Array<{ exists: number }>
    >`SELECT 1 as exists FROM information_schema.columns WHERE table_schema = 'general_merchandise' AND table_name = 'transaction_payments' AND column_name = 'isReservation' LIMIT 1;`) as Array<{
      exists: number;
    }>;

    return rows.length > 0;
  } catch {
    return false;
  }
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

function sanitizeCreateInput(input: TransactionPaymentCreateInput):
  | {
      transactionId: number;
      paymentDate: string;
      amount: number;
      method: string | null;
      notes: string | null;
      isReservation: boolean;
    }
  | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const paymentDate = sanitizers.date(input.paymentDate);
  if (!paymentDate) {
    return {
      error: ApiResponse.badRequest('Invalid paymentDate', {
        paymentDate: 'Provide a valid date (YYYY-MM-DD or ISO format).',
      }),
    };
  }

  const amount = sanitizers.number(input.amount, { min: 0, decimals: 2 }) ?? 0;

  const method =
    input.method === undefined || input.method === null
      ? null
      : sanitizers.name(input.method) || null;

  const notes =
    input.notes === undefined || input.notes === null
      ? null
      : sanitizers.notes(input.notes) || null;

  const isReservation = Boolean(input.isReservation);

  return {
    transactionId: input.transactionId,
    paymentDate,
    amount,
    method,
    notes,
    isReservation,
  };
}

// GET all payments for a customer (optionally filter by transactionId)
export const GET = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const customer = await prisma.generalMerchandiseCustomer.findUnique({
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

    const payments =
      (await prisma.generalMerchandiseTransactionPayment.findMany({
        where: {
          deletedAt: null,
          ...(transactionId ? { transactionId } : {}),
          transaction: {
            deletedAt: null,
            customers: customer.customerName,
          },
        },
        orderBy: [{ paymentDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          transactionId: true,
          paymentDate: true,
          amount: true,
          method: true,
          notes: true,
          isReservation: true,
          createdAt: true,
          updatedAt: true,
        },
      })) as PaymentRow[];

    logger.info('GM customer payments fetched', {
      customerId: idResult.id,
      count: payments.length,
      transactionId: transactionId ?? undefined,
    });

    return ApiResponse.success(payments, 'Customer payments fetched');
  }
);

// POST create a payment record for a transaction belonging to the customer
export const POST = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const customer = await prisma.generalMerchandiseCustomer.findUnique({
      where: { id: idResult.id },
      select: { customerName: true },
    });

    if (!customer) {
      return ApiResponse.notFound('Customer');
    }

    const body = await request.json();
    const validation = transactionPaymentCreateSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('GM transaction payment validation failed', {
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

    const hasReservationFlag = await supportsReservationFlag();

    const tx = await prisma.generalMerchandiseTransaction.findFirst({
      where: {
        id: sanitized.transactionId,
        deletedAt: null,
        customers: customer.customerName,
      },
      select: { id: true },
    });

    if (!tx) {
      return ApiResponse.badRequest('Invalid transaction', {
        transactionId: 'Transaction not found for this customer.',
      });
    }

    const created = await prisma.generalMerchandiseTransactionPayment.create({
      data: {
        transactionId: sanitized.transactionId,
        paymentDate: sanitized.paymentDate,
        amount: sanitized.amount,
        method: sanitized.method,
        notes: sanitized.notes,
        ...(hasReservationFlag
          ? { isReservation: sanitized.isReservation }
          : {}),
      },
    });

    // Keep transaction totals consistent with payment rows.
    const meta = (await prisma.generalMerchandiseTransaction.findUnique({
      where: { id: sanitized.transactionId },
      select: { id: true, quantity: true, unitPrice: true },
    })) as TransactionMetaRow | null;

    const paymentDelegate = prisma.generalMerchandiseTransactionPayment;

    let paid = 0;
    if (paymentDelegate.aggregate) {
      const paymentAggregate = await paymentDelegate.aggregate({
        where: {
          transactionId: sanitized.transactionId,
          deletedAt: null,
        },
        _sum: {
          amount: true,
        },
      });
      paid = paymentAggregate._sum.amount ?? 0;
    } else {
      const groupBy = Reflect.get(paymentDelegate, 'groupBy');

      if (typeof groupBy !== 'function') {
        throw new Error(
          'GeneralMerchandiseTransactionPayment groupBy is unavailable'
        );
      }

      const groupByAny = groupBy as (
        this: unknown,
        args: Record<string, unknown>
      ) => Promise<unknown>;

      const grouped = (await groupByAny.call(paymentDelegate, {
        by: ['transactionId'],
        where: {
          transactionId: sanitized.transactionId,
          deletedAt: null,
        },
        _sum: {
          amount: true,
        },
      })) as Array<{ _sum?: { amount?: number | null } }>;
      paid = grouped[0]?._sum?.amount ?? 0;
    }

    const gross = (meta?.quantity ?? 0) * (meta?.unitPrice ?? 0);
    const balance = gross - paid;

    await prisma.generalMerchandiseTransaction.update({
      where: { id: sanitized.transactionId },
      data: {
        adjustment: paid,
        lineTotal: balance,
      },
    });

    logger.info('GM customer payment recorded', {
      customerId: idResult.id,
      paymentId: (created as { id?: number }).id,
    });

    return ApiResponse.success(created, 'Payment recorded');
  }
);
