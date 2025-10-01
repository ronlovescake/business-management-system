import { NextRequest, NextResponse } from 'next/server';
// import { prisma } from '@/lib/db';

export interface Transaction {
  id?: number;
  customerId: number;
  date: string;
  type: 'payment' | 'refund' | 'credit';
  amount: number;
  description: string;
  reference?: string;
}

// GET all transactions for a customer
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

    // For now, return mock data since we haven't created the transaction tables yet
    // This will be replaced with actual database queries once the schema is updated
    const mockTransactions: Transaction[] = [
      {
        id: 1,
        customerId,
        date: '2024-09-15',
        type: 'payment',
        amount: 2500,
        description: 'Payment for Order ORD-2024-001',
        reference: 'PAY-001',
      },
      {
        id: 2,
        customerId,
        date: '2024-09-16',
        type: 'credit',
        amount: 500,
        description: 'Store credit for delayed delivery',
        reference: 'CREDIT-001',
      },
      {
        id: 3,
        customerId,
        date: '2024-09-25',
        type: 'refund',
        amount: 3200,
        description: 'Refund for cancelled Order ORD-2024-003',
        reference: 'REF-001',
      },
    ];

    return NextResponse.json(mockTransactions);
  } catch (err) {
    console.error('GET /api/customers/[id]/transactions error', err);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}

// POST create new transaction for a customer
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

    // For now, return mock created transaction
    // This will be replaced with actual database insertion once the schema is updated
    const newTransaction: Transaction = {
      id: Math.floor(Math.random() * 10000),
      customerId,
      date: body.date || new Date().toISOString(),
      type: body.type || 'payment',
      amount: body.amount || 0,
      description: body.description || '',
      reference: body.reference,
    };

    return NextResponse.json(newTransaction);
  } catch (err) {
    console.error('POST /api/customers/[id]/transactions error', err);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
