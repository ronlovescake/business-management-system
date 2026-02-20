import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface Transaction {
  id: number;
  orderDate: string | null;
  customers: string | null;
  productCode: string | null;
  quantity: number | null;
  unitPrice: number | null;
  discount: number | null;
  adjustment: number | null;
  lineTotal: number | null;
  orderStatus: string | null;
  notes: string | null;
  invoiceDate: string | null;
  packedDate: string | null;
  shipmentCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type RouteContext = { params: { id: string } };

// GET all transactions for a customer
export const GET = withErrorHandler<RouteContext>(
  async (_request: NextRequest, context) => {
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

    const transactions = await prisma.generalMerchandiseTransaction.findMany({
      where: {
        customers: customer.customerName,
      },
      orderBy: {
        orderDate: 'desc',
      },
    });

    logger.info('GM customer transactions fetched', {
      customerId: idResult.id,
      count: transactions.length,
    });

    return ApiResponse.success(transactions, 'Customer transactions fetched');
  }
);

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
