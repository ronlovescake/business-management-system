import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/customers/:id/additional-info/add
 *
 * Add a single additional info item without deleting existing ones
 * Used for linking customers to Shopee usernames and addresses
 */
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
    const { type, value } = body;

    // Validate input
    if (!type || !value) {
      return NextResponse.json(
        { error: 'Type and value are required' },
        { status: 400 }
      );
    }

    const validTypes = ['address', 'phone', 'shopee_username'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // Check if this exact value already exists (case-insensitive for usernames)
    const trimmedValue = value.trim();
    const normalizedValue =
      type === 'shopee_username' ? trimmedValue.toLowerCase() : trimmedValue;

    const existing = await prisma.additionalCustomerInfo.findFirst({
      where: {
        customerId,
        type,
        value:
          type === 'shopee_username'
            ? { equals: normalizedValue, mode: 'insensitive' }
            : normalizedValue,
        deletedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          message: `This ${type.replace('_', ' ')} already exists for this customer`,
          alreadyExists: true,
        },
        { status: 200 }
      );
    }

    // Create new entry
    const newInfo = await prisma.additionalCustomerInfo.create({
      data: {
        customerId,
        type,
        value: normalizedValue,
      },
    });

    return NextResponse.json(
      {
        message: `${type.replace('_', ' ')} added successfully`,
        data: newInfo,
        alreadyExists: false,
      },
      { status: 201 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error adding additional customer info:', error);
    return NextResponse.json(
      { error: 'Failed to add additional customer info' },
      { status: 500 }
    );
  }
}
