/**
 * Item Weights API Route
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  CreateItemWeightSchema,
  ItemWeightsQuerySchema,
  UpdateItemWeightSchema,
} from '@/modules/clothing/operations/checkout-links/api/schemas';

const DEFAULT_LIMIT = 100;

type ItemWeightEntity = {
  id: string;
  itemName: string;
  bulkQuantity: Prisma.Decimal;
  bulkWeight: Prisma.Decimal;
  approxWeightPerPiece: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

const getItemWeightClient = () =>
  (
    prisma as unknown as {
      itemWeight: {
        findMany: (
          args: Prisma.ItemWeightFindManyArgs
        ) => Promise<ItemWeightEntity[]>;
        count: (args: Prisma.ItemWeightCountArgs) => Promise<number>;
        create: (
          args: Prisma.ItemWeightCreateArgs
        ) => Promise<ItemWeightEntity>;
        findUnique: (
          args: Prisma.ItemWeightFindUniqueArgs
        ) => Promise<ItemWeightEntity | null>;
        update: (
          args: Prisma.ItemWeightUpdateArgs
        ) => Promise<ItemWeightEntity>;
      };
    }
  ).itemWeight;

const serializeItemWeight = (item: ItemWeightEntity) => ({
  id: item.id,
  itemName: item.itemName,
  bulkQuantity: item.bulkQuantity.toFixed(2),
  bulkWeight: item.bulkWeight.toFixed(2),
  approxWeightPerPiece: item.approxWeightPerPiece.toFixed(2),
  createdAt: item.createdAt.toISOString(),
});

const toDecimal = (value: number, precision = 2) =>
  new Prisma.Decimal(value).toDecimalPlaces(precision);

/**
 * GET /api/item-weights
 *
 * Fetch all item weights with optional search and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? undefined;
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const limitParsed = limitParam
      ? Number.parseInt(limitParam, 10)
      : undefined;
    const offsetParsed = offsetParam
      ? Number.parseInt(offsetParam, 10)
      : undefined;

    const query = ItemWeightsQuerySchema.parse({
      search,
      limit: limitParsed,
      offset: offsetParsed,
    });

    const take = query.limit ?? DEFAULT_LIMIT;
    const skip = query.offset ?? 0;

    const where = query.search
      ? {
          deletedAt: null,
          itemName: {
            contains: query.search,
            mode: 'insensitive' as const,
          },
        }
      : { deletedAt: null };

    const itemWeightClient = getItemWeightClient();

    const [items, total] = await Promise.all([
      itemWeightClient.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      itemWeightClient.count({ where }),
    ]);

    return NextResponse.json({
      data: items.map(serializeItemWeight),
      total,
    });
  } catch (error) {
    logger.error('Error fetching item weights', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch item weights' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/item-weights
 *
 * Create a new item weight record
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateItemWeightSchema.parse(body);

    const bulkQuantityDecimal = toDecimal(validated.bulkQuantity);
    const bulkWeightDecimal = toDecimal(validated.bulkWeight);

    if (bulkQuantityDecimal.isZero()) {
      return NextResponse.json(
        { error: 'Bulk quantity must be greater than zero' },
        { status: 422 }
      );
    }

    const approxWeightPerPiece = bulkWeightDecimal
      .div(bulkQuantityDecimal)
      .toDecimalPlaces(2);

    const itemWeightClient = getItemWeightClient();

    const created = await itemWeightClient.create({
      data: {
        itemName: validated.itemName.trim(),
        bulkQuantity: bulkQuantityDecimal,
        bulkWeight: bulkWeightDecimal,
        approxWeightPerPiece,
      },
    });

    return NextResponse.json(
      { data: serializeItemWeight(created) },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating item weight', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create item weight' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/item-weights
 *
 * Update an existing item weight record
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...rest } = body ?? {};

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'ID is required for updating item weight' },
        { status: 400 }
      );
    }

    const validated = UpdateItemWeightSchema.parse(rest);

    const itemWeightClient = getItemWeightClient();

    const existing = await itemWeightClient.findUnique({
      where: { id },
    });

    if (!existing || existing.deletedAt) {
      return NextResponse.json(
        { error: 'Item weight not found' },
        { status: 404 }
      );
    }

    const bulkQuantityDecimal =
      validated.bulkQuantity !== undefined
        ? toDecimal(validated.bulkQuantity)
        : existing.bulkQuantity;

    if (bulkQuantityDecimal.isZero()) {
      return NextResponse.json(
        { error: 'Bulk quantity must be greater than zero' },
        { status: 422 }
      );
    }

    const bulkWeightDecimal =
      validated.bulkWeight !== undefined
        ? toDecimal(validated.bulkWeight)
        : existing.bulkWeight;

    const approxWeightPerPiece = bulkWeightDecimal
      .div(bulkQuantityDecimal)
      .toDecimalPlaces(2);

    const updated = await itemWeightClient.update({
      where: { id },
      data: {
        itemName:
          validated.itemName !== undefined
            ? validated.itemName.trim()
            : existing.itemName,
        bulkQuantity: bulkQuantityDecimal,
        bulkWeight: bulkWeightDecimal,
        approxWeightPerPiece,
      },
    });

    return NextResponse.json({ data: serializeItemWeight(updated) });
  } catch (error) {
    logger.error('Error updating item weight', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update item weight' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/item-weights?id=ITEM_ID
 *
 * Soft delete an item weight record
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const itemWeightClient = getItemWeightClient();

    await itemWeightClient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting item weight', error);
    return NextResponse.json(
      { error: 'Failed to delete item weight' },
      { status: 500 }
    );
  }
}
