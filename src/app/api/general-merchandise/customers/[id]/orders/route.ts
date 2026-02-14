import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';

export interface Order {
  id?: number;
  customerId: number;
  orderDate: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  items: OrderItem[];
  notes?: string;
}

export interface OrderItem {
  id?: number;
  orderId?: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

const ORDER_STATUSES = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];

type RouteContext = { params: { id: string } };

const DEFAULT_ITEMS: OrderItem[] = [];

type TransactionRow = {
  id: number;
  orderDate: string | null;
  productCode: string | null;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
  orderStatus: string | null;
  notes: string | null;
  shipmentCode: string | null;
  createdAt: Date;
};

const gmPrisma = prisma as unknown as {
  generalMerchandiseCustomer: typeof prisma.customer;
  generalMerchandiseTransaction: typeof prisma.transaction;
};

export const GET = withErrorHandler<RouteContext>(
  async (_request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const customer = await gmPrisma.generalMerchandiseCustomer.findUnique({
      where: { id: idResult.id },
      select: { customerName: true },
    });

    if (!customer) {
      logger.info('GM customer orders fetched for missing customer', {
        customerId: idResult.id,
        transactionCount: 0,
        orderCount: 0,
      });
      return ApiResponse.success<Order[]>([], 'Customer orders fetched');
    }

    const transactions = (await gmPrisma.generalMerchandiseTransaction.findMany(
      {
        where: {
          customers: customer.customerName,
          deletedAt: null,
        },
        orderBy: [{ orderDate: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          orderDate: true,
          productCode: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          orderStatus: true,
          notes: true,
          shipmentCode: true,
          createdAt: true,
        },
      }
    )) as TransactionRow[];

    const orders = mapTransactionsToOrders(transactions, idResult.id);

    logger.info('GM customer orders fetched', {
      customerId: idResult.id,
      transactionCount: transactions.length,
      orderCount: orders.length,
    });

    return ApiResponse.success<Order[]>(orders, 'Customer orders fetched');
  }
);

export const POST = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const body = await request.json();
    const newOrder = buildMockOrder(body, idResult.id);

    logger.info('GM mock customer order created', {
      customerId: idResult.id,
      orderNumber: newOrder.orderNumber,
    });

    return ApiResponse.success(newOrder, 'Order recorded (mock)');
  }
);

function buildMockOrder(
  payload: Record<string, unknown>,
  customerId: number
): Order {
  return {
    id: generateMockId(),
    customerId,
    orderDate: sanitizeOrderDate(payload.orderDate),
    orderNumber:
      sanitizers.name(payload.orderNumber) || `ORD-${customerId}-${Date.now()}`,
    status: sanitizeStatus(payload.status),
    totalAmount:
      sanitizers.number(payload.totalAmount, { min: 0, decimals: 2 }) ?? 0,
    items: sanitizeOrderItems(payload.items),
    notes: payload.notes ? sanitizers.notes(payload.notes) : undefined,
  } satisfies Order;
}

function sanitizeOrderItems(rawItems: unknown): OrderItem[] {
  if (!Array.isArray(rawItems)) {
    return DEFAULT_ITEMS;
  }

  return rawItems.slice(0, 100).map((item) => {
    const asRecord = (item ?? {}) as Record<string, unknown>;
    const quantity = sanitizers.number(asRecord.quantity, { min: 0 }) ?? 0;
    const unitPrice =
      sanitizers.number(asRecord.unitPrice, { min: 0, decimals: 2 }) ?? 0;
    return {
      id:
        typeof asRecord.id === 'number' && Number.isFinite(asRecord.id)
          ? asRecord.id
          : undefined,
      productName: sanitizers.name(asRecord.productName) || 'Unnamed Product',
      quantity,
      unitPrice,
      totalPrice:
        sanitizers.number(asRecord.totalPrice, { min: 0, decimals: 2 }) ??
        quantity * unitPrice,
    } satisfies OrderItem;
  });
}

function sanitizeOrderDate(value: unknown): string {
  const sanitized = value ? sanitizers.date(value) : null;
  return sanitized || new Date().toISOString();
}

function sanitizeStatus(value: unknown): OrderStatus {
  const normalized = sanitizers
    .name(typeof value === 'string' ? value : '')
    ?.toLowerCase();
  if (normalized && ORDER_STATUSES.includes(normalized as OrderStatus)) {
    return normalized as OrderStatus;
  }
  return 'pending';
}

function generateMockId(): number {
  return Number(String(Date.now()).slice(-6));
}

function mapTransactionsToOrders(
  transactions: TransactionRow[],
  customerId: number
): Order[] {
  const grouped = new Map<string, Order>();

  for (const tx of transactions) {
    const groupKey =
      tx.shipmentCode?.trim() ||
      tx.orderDate?.trim() ||
      `tx-${tx.id.toString()}`;

    const existing = grouped.get(groupKey);
    const quantity = tx.quantity ?? 0;
    const unitPrice = tx.unitPrice ?? 0;
    const lineTotal = tx.lineTotal ?? quantity * unitPrice;

    const orderItem: OrderItem = {
      id: tx.id,
      orderId: existing?.id,
      productName: tx.productCode || 'Unknown Product',
      quantity,
      unitPrice,
      totalPrice: lineTotal,
    };

    if (!existing) {
      const status = sanitizeStatus(tx.orderStatus ?? 'pending');
      grouped.set(groupKey, {
        id: tx.id,
        customerId,
        orderDate: tx.orderDate || tx.createdAt.toISOString(),
        orderNumber: tx.shipmentCode || `ORD-${customerId}-${tx.id}`,
        status,
        totalAmount: lineTotal,
        items: [orderItem],
        notes: tx.notes || undefined,
      });
      continue;
    }

    existing.items.push(orderItem);
    existing.totalAmount += lineTotal;
    if (!existing.notes && tx.notes) {
      existing.notes = tx.notes;
    }
  }

  return Array.from(grouped.values()).sort((a, b) =>
    b.orderDate.localeCompare(a.orderDate)
  );
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
