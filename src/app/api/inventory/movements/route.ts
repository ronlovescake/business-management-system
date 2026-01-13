import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const movementSchema = z.object({
  productCode: z.string().min(1, 'productCode is required'),
  quantity: z.number().positive('quantity must be > 0'),
  fromBucket: z.enum(['sellable', 'damaged_hold', 'scrap', 'sold']),
  toBucket: z.enum(['sellable', 'damaged_hold', 'scrap', 'sold']),
  postingDate: z.string().optional(),
  notes: z.string().optional(),
});

function normalizeProductCode(value: string) {
  return value.trim();
}

export async function GET() {
  try {
    const movements = await prisma.inventoryMovement.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: movements });
  } catch (error) {
    logger.error('Failed to fetch inventory movements', { error });
    return NextResponse.json(
      { error: 'Failed to fetch inventory movements' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = movementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productCode, quantity, fromBucket, toBucket, postingDate, notes } =
      parsed.data;

    if (fromBucket === toBucket) {
      return NextResponse.json(
        { error: 'fromBucket and toBucket must differ' },
        { status: 400 }
      );
    }

    const normalizedCode = normalizeProductCode(productCode);

    const created = await prisma.inventoryMovement.create({
      data: {
        productCode: normalizedCode,
        quantity,
        fromBucket,
        toBucket,
        postingDate: postingDate?.trim() || null,
        notes,
      },
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    logger.error('Failed to create inventory movement', { error });
    return NextResponse.json(
      { error: 'Failed to create inventory movement' },
      { status: 500 }
    );
  }
}
