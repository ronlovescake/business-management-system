import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

// GET all transactions for a customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = params.id;

    // First, get the customer name
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(customerId) },
      select: { customerName: true },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Fetch all transactions for this customer by name
    const transactions = await prisma.transaction.findMany({
      where: {
        customers: customer.customerName,
      },
      orderBy: {
        orderDate: 'desc',
      },
    });

    return NextResponse.json(transactions);
  } catch (err) {
    console.error('GET /api/customers/[id]/transactions error', err);
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    );
  }
}
