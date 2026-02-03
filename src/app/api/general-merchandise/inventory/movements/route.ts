import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/core/api/response';
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
    'supplier_short',
    'sold',
  ]),
  toBucket: z.enum([
    'sellable',
    'damaged_hold',
    'reserved',
    'assembly_wip',
    'scrap',
    'supplier_short',
    'sold',
  ]),
  postingDate: z.string().optional(),
  notes: z.string().optional(),
});

const movementPatchSchema = z.object({
  id: z.number().int().positive('id is required'),
  quantity: z.number().positive('quantity must be > 0').optional(),
  toBucket: z.enum(['damaged_hold', 'scrap', 'supplier_short']).optional(),
  postingDate: z.string().optional(),
  notes: z.string().optional(),
});

const gmPrisma = prisma as unknown as {
  generalMerchandiseInventoryMovement: typeof prisma.inventoryMovement;
};

function normalizeProductCode(value: string) {
  return value.trim();
}

export async function GET() {
  try {
    const movements =
      await gmPrisma.generalMerchandiseInventoryMovement.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

    return ApiResponseUtil.success(movements);
  } catch (error) {
    logger.error('Failed to fetch GM inventory movements', { error });
    return ApiResponseUtil.error('Failed to fetch inventory movements', 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = movementSchema.safeParse(body);

    if (!parsed.success) {
      return ApiResponseUtil.error('Invalid payload', 400, undefined, {
        meta: parsed.error.flatten(),
      });
    }

    const { productCode, quantity, fromBucket, toBucket, postingDate, notes } =
      parsed.data;

    if (fromBucket === toBucket) {
      return ApiResponseUtil.error('fromBucket and toBucket must differ', 400);
    }

    const normalizedCode = normalizeProductCode(productCode);

    const created = await gmPrisma.generalMerchandiseInventoryMovement.create({
      data: {
        productCode: normalizedCode,
        quantity,
        fromBucket,
        toBucket,
        postingDate: postingDate?.trim() || null,
        notes,
      },
    });

    return ApiResponseUtil.success(created, undefined, 201);
  } catch (error) {
    logger.error('Failed to create GM inventory movement', { error });
    return ApiResponseUtil.error('Failed to create inventory movement', 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = movementPatchSchema.safeParse(body);

    if (!parsed.success) {
      return ApiResponseUtil.error('Invalid payload', 400, undefined, {
        meta: parsed.error.flatten(),
      });
    }

    const { id, quantity, toBucket, postingDate, notes } = parsed.data;

    const existing =
      await gmPrisma.generalMerchandiseInventoryMovement.findFirst({
        where: { id, deletedAt: null },
      });

    if (!existing) {
      return ApiResponseUtil.error('Movement not found', 404);
    }

    const allowedDestinations = [
      'damaged_hold',
      'scrap',
      'supplier_short',
    ] as const;
    if (
      existing.fromBucket !== 'sellable' ||
      !allowedDestinations.includes(
        existing.toBucket as (typeof allowedDestinations)[number]
      )
    ) {
      return ApiResponseUtil.error(
        'Only sellable -> damaged_hold/scrap/supplier_short movements can be edited',
        400
      );
    }

    const updated = await gmPrisma.generalMerchandiseInventoryMovement.update({
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

    return ApiResponseUtil.success(updated);
  } catch (error) {
    logger.error('Failed to update GM inventory movement', { error });
    return ApiResponseUtil.error('Failed to update inventory movement', 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');
    const id = idParam ? Number(idParam) : NaN;

    if (!Number.isFinite(id)) {
      return ApiResponseUtil.error('id is required', 400);
    }

    const existing =
      await gmPrisma.generalMerchandiseInventoryMovement.findFirst({
        where: { id, deletedAt: null },
      });

    if (!existing) {
      return ApiResponseUtil.error('Movement not found', 404);
    }

    const allowedDestinations = [
      'damaged_hold',
      'scrap',
      'supplier_short',
    ] as const;
    if (
      existing.fromBucket !== 'sellable' ||
      !allowedDestinations.includes(
        existing.toBucket as (typeof allowedDestinations)[number]
      )
    ) {
      return ApiResponseUtil.error(
        'Only sellable -> damaged_hold/scrap/supplier_short movements can be deleted',
        400
      );
    }

    await gmPrisma.generalMerchandiseInventoryMovement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return ApiResponseUtil.ok();
  } catch (error) {
    logger.error('Failed to delete GM inventory movement', { error });
    return ApiResponseUtil.error('Failed to delete inventory movement', 500);
  }
}
