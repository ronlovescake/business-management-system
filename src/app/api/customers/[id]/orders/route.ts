import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
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

export const GET = withErrorHandler<RouteContext>(
  async (_request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    // TODO: Replace with real queries when order tables exist
    logger.info('Customer orders requested', { customerId: idResult.id });
    return ApiResponse.success<Order[]>(
      DEFAULT_ITEMS,
      'Customer orders fetched'
    );
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

    logger.info('Mock customer order created', {
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
