import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// GET - Fetch additional customer info
// ============================================================================

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

    const additionalInfo = await prisma.additionalCustomerInfo.findMany({
      where: {
        customerId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by type
    const grouped = {
      addresses: additionalInfo
        .filter((info: { type: string }) => info.type === 'address')
        .map((info: { id: number; value: string }) => ({
          id: info.id.toString(),
          value: info.value,
        })),
      phones: additionalInfo
        .filter((info: { type: string }) => info.type === 'phone')
        .map((info: { id: number; value: string }) => ({
          id: info.id.toString(),
          value: info.value,
        })),
      shopeeUsernames: additionalInfo
        .filter((info: { type: string }) => info.type === 'shopee_username')
        .map((info: { id: number; value: string }) => ({
          id: info.id.toString(),
          value: info.value,
        })),
    };

    return NextResponse.json(grouped);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching additional customer info:', error);
    return NextResponse.json(
      { error: 'Failed to fetch additional customer info' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Save additional customer info
// ============================================================================

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
    const { addresses, phones, shopeeUsernames } = body;

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

    // Delete all existing additional info for this customer
    await prisma.additionalCustomerInfo.updateMany({
      where: { customerId },
      data: { deletedAt: new Date() },
    });

    // Create new entries
    const newEntries = [];

    if (addresses && Array.isArray(addresses)) {
      for (const addr of addresses) {
        if (addr.value && addr.value.trim()) {
          newEntries.push({
            customerId,
            type: 'address',
            value: addr.value.trim(),
          });
        }
      }
    }

    if (phones && Array.isArray(phones)) {
      for (const phone of phones) {
        if (phone.value && phone.value.trim()) {
          newEntries.push({
            customerId,
            type: 'phone',
            value: phone.value.trim(),
          });
        }
      }
    }

    if (shopeeUsernames && Array.isArray(shopeeUsernames)) {
      for (const username of shopeeUsernames) {
        if (username.value && username.value.trim()) {
          newEntries.push({
            customerId,
            type: 'shopee_username',
            value: username.value.trim(),
          });
        }
      }
    }

    if (newEntries.length > 0) {
      await prisma.additionalCustomerInfo.createMany({
        data: newEntries,
      });
    }

    return NextResponse.json(
      { message: 'Additional customer info saved successfully' },
      { status: 200 }
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error saving additional customer info:', error);
    return NextResponse.json(
      { error: 'Failed to save additional customer info' },
      { status: 500 }
    );
  }
}
