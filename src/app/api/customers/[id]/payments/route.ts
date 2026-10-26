import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import {
  getAuthorizationErrorResponse,
  withErrorHandler,
} from '@/core/api/middleware';
import { requireAuth } from '@/lib/auth/session';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import {
  FinancialOperationError,
  financialRequestId,
  runFinancialRequest,
} from '@/lib/accounting/financial-transactions';
import {
  computeCollectionBalance,
  computeOriginalDepositAgreement,
} from '@/modules/transactions/api/service-calculations';
import {
  transactionPaymentCreateSchema,
  type TransactionPaymentCreateInput,
  formatValidationErrors,
} from '@/lib/validations/transaction-payment.validation';

type RouteContext = { params: { id: string } };

type TransactionMetaRow = {
  id: number;
  quantity: number;
  unitPrice: number;
  adjustment: number | null;
  orderStatus: string | null;
  customerId: number | null;
  deletedAt: Date | null;
  initialDepositAmount?: Prisma.Decimal | null;
};

type PaymentRow = {
  id: number;
  transactionId: number;
  paymentDate: string;
  amount: number;
  method: string | null;
  notes: string | null;
  isReservation?: boolean | null;
  createdAt: Date;
  updatedAt: Date;
};

async function supportsReservationFlag(): Promise<boolean> {
  try {
    const rows = (await prisma.$queryRaw<
      Array<{ exists: number }>
    >`SELECT 1 as exists FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'transaction_payments' AND column_name = 'isReservation' LIMIT 1;`) as Array<{
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
      originalDepositRate?: 10 | 20;
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

  const amount = sanitizers.number(input.amount, { min: 0, decimals: 2 });
  if (amount === null || amount <= 0) {
    return {
      error: ApiResponse.badRequest('Invalid amount', {
        amount: 'Provide a positive amount (greater than 0 after rounding).',
      }),
    };
  }

  const method =
    input.method === undefined || input.method === null
      ? null
      : sanitizers.name(input.method) || null;

  const notes =
    input.notes === undefined || input.notes === null
      ? null
      : sanitizers.notes(input.notes) || null;

  return {
    transactionId: input.transactionId,
    paymentDate,
    amount,
    method,
    notes,
    isReservation: Boolean(input.isReservation),
    originalDepositRate: input.originalDepositRate,
  };
}

// GET all payments for a customer (optionally filter by transactionId)
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

    const transactionPayment = prisma.transactionPayment;

    const hasReservationFlag = await supportsReservationFlag();

    const payments = (await transactionPayment.findMany({
      where: {
        deletedAt: null,
        ...(transactionId ? { transactionId } : {}),
        transaction: {
          deletedAt: null,
          customerId: idResult.id,
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
        ...(hasReservationFlag ? { isReservation: true } : {}),
        createdAt: true,
        updatedAt: true,
      },
    })) as PaymentRow[];

    logger.info('Customer payments fetched', {
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
    const actor = await requireAuth();
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
    const validation = transactionPaymentCreateSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Transaction payment validation failed', {
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

    const requestId = financialRequestId(request.headers);
    const tx = await prisma.transaction.findFirst({
      where: {
        id: sanitized.transactionId,
        deletedAt: null,
        customerId: idResult.id,
      },
      select: { id: true },
    });

    if (!tx) {
      return ApiResponse.badRequest('Invalid transaction', {
        transactionId: 'Transaction not found for this customer.',
      });
    }

    const hasReservationFlag = await supportsReservationFlag();

    const result = await runFinancialRequest(
      requestId,
      'CUSTOMER_COLLECTION',
      {
        customerId: idResult.id,
        payment: sanitized,
      },
      async (txp) => {
        const meta = (await txp.transaction.findUnique({
          where: { id: sanitized.transactionId },
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            adjustment: true,
            orderStatus: true,
            customerId: true,
            deletedAt: true,
            initialDepositAmount: true,
          },
        })) as TransactionMetaRow | null;

        if (!meta || meta.deletedAt || meta.customerId !== idResult.id) {
          return {
            validationError:
              'Transaction is no longer available for this customer.',
          };
        }

        const paymentDelegate = txp.transactionPayment;

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
            throw new Error('TransactionPayment groupBy is unavailable');
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

        const balance = computeCollectionBalance({
          transactionId: sanitized.transactionId,
          quantity: meta.quantity,
          unitPrice: meta.unitPrice,
          adjustment: meta.adjustment,
          orderStatus: meta.orderStatus,
          recordedPayments: paid,
          incomingAmount: sanitized.amount,
          isReservation: sanitized.isReservation,
        });
        if ('validationError' in balance) {
          return balance;
        }

        const deposit = computeOriginalDepositAgreement({
          quantity: meta.quantity,
          unitPrice: meta.unitPrice,
          incomingAmount: sanitized.amount,
          recordedPayments: paid,
          isReservation: sanitized.isReservation,
          originalDepositRate: sanitized.originalDepositRate,
          initialDepositAmount: meta.initialDepositAmount,
        });
        if ('validationError' in deposit) {
          return deposit;
        }
        if (sanitized.isReservation && !hasReservationFlag) {
          return {
            validationError:
              'Reservation Deposit storage is unavailable. Update the development schema before collecting a deposit.',
          };
        }
        const depositUpdate: Prisma.TransactionUpdateInput = { ...deposit };
        if (deposit.initialDepositAmount) {
          depositUpdate.depositConfirmedAt = new Date();
          depositUpdate.depositConfirmedBy =
            actor.name ?? actor.email ?? actor.id;
        }

        const createdRow = (await txp.transactionPayment.create({
          data: {
            transactionId: sanitized.transactionId,
            financialRequestId: requestId,
            paymentDate: sanitized.paymentDate,
            amount: sanitized.amount,
            method: sanitized.method,
            notes: sanitized.notes,
            ...(hasReservationFlag
              ? { isReservation: sanitized.isReservation }
              : {}),
          },
          select: {
            id: true,
            transactionId: true,
            paymentDate: true,
            amount: true,
            method: true,
            notes: true,
            ...(hasReservationFlag ? { isReservation: true } : {}),
            createdAt: true,
            updatedAt: true,
          },
        })) as PaymentRow;

        await txp.transaction.update({
          where: { id: sanitized.transactionId },
          data: {
            adjustment: balance.adjustment,
            lineTotal: balance.lineTotal,
            ...depositUpdate,
            ...(balance.orderStatus !== meta.orderStatus
              ? { orderStatus: balance.orderStatus }
              : {}),
          },
        });

        if (balance.orderStatus !== meta.orderStatus) {
          await txp.transactionStatusChange.create({
            data: {
              transactionId: sanitized.transactionId,
              previousStatus: meta.orderStatus,
              newStatus: balance.orderStatus,
            },
          });
        }

        return { payment: createdRow };
      }
    );

    if ('validationError' in result) {
      return ApiResponse.badRequest('Payment validation failed', {
        payments:
          result.validationError ?? 'Unable to validate this collection.',
      });
    }
    const created = result.payment;

    logger.info('Transaction payment created', {
      customerId: idResult.id,
      transactionId: sanitized.transactionId,
      paymentId: created.id,
    });

    return ApiResponse.success(created, 'Payment recorded', 201);
  },
  {
    onError: (error) =>
      error instanceof FinancialOperationError
        ? ApiResponse.error(error.message, error.status)
        : (getAuthorizationErrorResponse(error) ?? undefined),
  }
);
