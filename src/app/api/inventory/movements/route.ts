import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const movementSchema = z.object({
  productCode: z.string().min(1, 'productCode is required'),
  quantity: z.number().positive('quantity must be > 0'),
  fromBucket: z.enum([
    'sellable',
    'damaged_hold',
    'reserved',
    'assembly_wip',
    'scrap',
    'sold',
  ]),
  toBucket: z.enum([
    'sellable',
    'damaged_hold',
    'reserved',
    'assembly_wip',
    'scrap',
    'sold',
  ]),
  postingDate: z.string().optional(),
  notes: z.string().optional(),
});

const movementPatchSchema = z.object({
  id: z.number().int().positive('id is required'),
  quantity: z.number().positive('quantity must be > 0').optional(),
  toBucket: z.enum(['damaged_hold', 'scrap']).optional(),
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = movementPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, quantity, toBucket, postingDate, notes } = parsed.data;

    const existing = await prisma.inventoryMovement.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Movement not found' },
        { status: 404 }
      );
    }

    // Only allow editing adjustment-style movements (keeps behavior predictable).
    if (
      existing.fromBucket !== 'sellable' ||
      (existing.toBucket !== 'damaged_hold' && existing.toBucket !== 'scrap')
    ) {
      return NextResponse.json(
        {
          error: 'Only sellable -> damaged_hold/scrap movements can be edited',
        },
        { status: 400 }
      );
    }

    // fromBucket is always 'sellable' for editable adjustments; toBucket is restricted
    // to 'damaged_hold' | 'scrap', so they cannot be equal.

    const updated = await prisma.inventoryMovement.update({
      where: { id },
      data: {
        quantity: typeof quantity === 'number' ? quantity : undefined,
        toBucket: typeof toBucket === 'string' ? toBucket : undefined,
        postingDate:
          typeof postingDate === 'string'
            ? postingDate.trim() || null
            : undefined,
        notes: typeof notes === 'string' ? notes : undefined,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    logger.error('Failed to update inventory movement', { error });
    return NextResponse.json(
      { error: 'Failed to update inventory movement' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const id = idParam ? Number(idParam) : NaN;

    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await prisma.inventoryMovement.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Movement not found' },
        { status: 404 }
      );
    }

    // Only allow deleting adjustment-style movements.
    if (
      existing.fromBucket !== 'sellable' ||
      (existing.toBucket !== 'damaged_hold' && existing.toBucket !== 'scrap')
    ) {
      return NextResponse.json(
        {
          error: 'Only sellable -> damaged_hold/scrap movements can be deleted',
        },
        { status: 400 }
      );
    }

    const deleted = await prisma.inventoryMovement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ data: deleted });
  } catch (error) {
    logger.error('Failed to delete inventory movement', { error });
    return NextResponse.json(
      { error: 'Failed to delete inventory movement' },
      { status: 500 }
    );
  }
}
