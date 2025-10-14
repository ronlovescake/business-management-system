import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

// import { prisma } from '@/lib/db';

export interface Order {
  id?: number;
  customerId: number;
  orderDate: string;
  orderNumber: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
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

// GET all orders for a customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id);
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    // For now, return mock data since we haven't created the order tables yet
    // This will be replaced with actual database queries once the schema is updated
    const mockOrders: Order[] = [
      {
        id: 1,
        customerId,
        orderDate: '2024-09-15',
        orderNumber: 'ORD-2024-001',
        status: 'delivered',
        totalAmount: 2500,
        items: [
          {
            id: 1,
            productName: 'Cotton T-Shirt',
            quantity: 2,
            unitPrice: 750,
            totalPrice: 1500,
          },
          {
            id: 2,
            productName: 'Denim Jeans',
            quantity: 1,
            unitPrice: 1000,
            totalPrice: 1000,
          },
        ],
        notes: 'Customer requested express delivery',
      },
      {
        id: 2,
        customerId,
        orderDate: '2024-09-20',
        orderNumber: 'ORD-2024-002',
        status: 'processing',
        totalAmount: 1800,
        items: [
          {
            id: 3,
            productName: 'Polo Shirt',
            quantity: 3,
            unitPrice: 600,
            totalPrice: 1800,
          },
        ],
      },
      {
        id: 3,
        customerId,
        orderDate: '2024-09-25',
        orderNumber: 'ORD-2024-003',
        status: 'cancelled',
        totalAmount: 3200,
        items: [
          {
            id: 4,
            productName: 'Dress Shirt',
            quantity: 4,
            unitPrice: 800,
            totalPrice: 3200,
          },
        ],
        notes: 'Customer changed mind',
      },
    ];

    return NextResponse.json(mockOrders);
  } catch (err) {
    logger.error('GET /api/customers/[id]/orders error', err);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// POST create new order for a customer
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = parseInt(params.id);
    if (isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // For now, return mock created order
    // This will be replaced with actual database insertion once the schema is updated
    const newOrder: Order = {
      id: Math.floor(Math.random() * 10000),
      customerId,
      orderDate: body.orderDate || new Date().toISOString(),
      orderNumber: body.orderNumber,
      status: body.status || 'pending',
      totalAmount: body.totalAmount || 0,
      items: body.items || [],
      notes: body.notes,
    };

    return NextResponse.json(newOrder);
  } catch (err) {
    logger.error('POST /api/customers/[id]/orders error', err);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
