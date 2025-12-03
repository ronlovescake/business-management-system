/**
 * Item Weights API Route
 */

import type { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { ZodError } from 'zod';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  CreateItemWeightSchema,
  ItemWeightsQuerySchema,
  UpdateItemWeightSchema,
  type CreateItemWeightInput,
  type ItemWeightsQuery,
  type UpdateItemWeightInput,
} from '@/modules/clothing/operations/checkout-links/api/schemas';

const DEFAULT_LIMIT = 100;

const itemWeightSelect = {
  id: true,
  itemName: true,
  bulkQuantity: true,
  bulkWeight: true,
  approxWeightPerPiece: true,
  createdAt: true,
  deletedAt: true,
} as const;

type ItemWeightEntity = Prisma.ItemWeightGetPayload<{
  select: typeof itemWeightSelect;
}>;

type ItemWeightClient = typeof prisma.itemWeight;

const getItemWeightClient = (): ItemWeightClient => prisma.itemWeight;

type UpdatePayloadData = {
  itemName: string;
  bulkQuantity: Prisma.Decimal;
  bulkWeight: Prisma.Decimal;
  approxWeightPerPiece: Prisma.Decimal;
};

type UpdatePayloadResult =
  | { data: UpdatePayloadData; error?: undefined }
  | { data?: undefined; error: ReturnType<typeof ApiResponse.error> };

const serializeItemWeight = (item: ItemWeightEntity) => ({
  id: item.id,
  itemName: item.itemName,
  bulkQuantity: item.bulkQuantity.toFixed(2),
  bulkWeight: item.bulkWeight.toFixed(2),
  approxWeightPerPiece: item.approxWeightPerPiece.toFixed(2),
  createdAt: item.createdAt.toISOString(),
});

const toDecimal = (value: number | Prisma.Decimal, precision = 2) =>
  value instanceof Prisma.Decimal
    ? value.toDecimalPlaces(precision)
    : new Prisma.Decimal(value).toDecimalPlaces(precision);

const calculateApproxWeightPerPiece = (
  bulkWeight: Prisma.Decimal,
  bulkQuantity: Prisma.Decimal
) => bulkWeight.div(bulkQuantity).toDecimalPlaces(2);

const formatZodErrors = (error: ZodError) =>
  error.errors.reduce<Record<string, string>>((acc, issue) => {
    const key = issue.path.join('.') || 'root';
    acc[key] = issue.message;
    return acc;
  }, {});

const validationFailedResponse = (error: ZodError) =>
  ApiResponse.error(
    'Validation failed',
    HTTP_STATUS.UNPROCESSABLE_ENTITY,
    undefined,
    {
      validationErrors: formatZodErrors(error),
    }
  );

const ensurePositiveQuantity = (quantity: Prisma.Decimal) => {
  if (quantity.isZero()) {
    return ApiResponse.error(
      'Bulk quantity must be greater than zero',
      HTTP_STATUS.UNPROCESSABLE_ENTITY
    );
  }
  return null;
};

const buildWhereClause = (query: ItemWeightsQuery) => {
  if (!query.search) {
    return { deletedAt: null };
  }

  return {
    deletedAt: null,
    itemName: {
      contains: query.search,
      mode: 'insensitive' as const,
    },
  };
};

const handlePrismaError = (error: unknown, context: string) => {
  logger.error(context, { error });
  return ApiResponse.error('Failed to process item weight request');
};

const parseQuery = (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  return ItemWeightsQuerySchema.safeParse({
    search: searchParams.get('search') ?? undefined,
    limit: limitParam ? Number.parseInt(limitParam, 10) : undefined,
    offset: offsetParam ? Number.parseInt(offsetParam, 10) : undefined,
  });
};

const parseBody = <T>(
  body: unknown,
  schema: typeof CreateItemWeightSchema | typeof UpdateItemWeightSchema
): { success: true; data: T } | { success: false; error: ZodError } => {
  const result = schema.safeParse(body);
  return result.success
    ? { success: true, data: result.data as T }
    : { success: false, error: result.error };
};

const computeUpdatePayload = (
  validated: UpdateItemWeightInput,
  existing: ItemWeightEntity
): UpdatePayloadResult => {
  const bulkQuantityDecimal =
    validated.bulkQuantity !== undefined
      ? toDecimal(validated.bulkQuantity)
      : toDecimal(existing.bulkQuantity);

  const bulkWeightDecimal =
    validated.bulkWeight !== undefined
      ? toDecimal(validated.bulkWeight)
      : toDecimal(existing.bulkWeight);

  const quantityError = ensurePositiveQuantity(bulkQuantityDecimal);
  if (quantityError !== null) {
    return { error: quantityError };
  }

  const approxWeightPerPiece = calculateApproxWeightPerPiece(
    bulkWeightDecimal,
    bulkQuantityDecimal
  );

  return {
    data: {
      itemName:
        validated.itemName !== undefined
          ? validated.itemName.trim()
          : existing.itemName,
      bulkQuantity: bulkQuantityDecimal,
      bulkWeight: bulkWeightDecimal,
      approxWeightPerPiece,
    },
  };
};

export const GET = withErrorHandler(async (request: NextRequest) => {
  const parsedQuery = parseQuery(request);
  if (!parsedQuery.success) {
    return validationFailedResponse(parsedQuery.error);
  }

  const { limit = DEFAULT_LIMIT, offset = 0 } = parsedQuery.data;
  const where = buildWhereClause(parsedQuery.data);
  const itemWeightClient = getItemWeightClient();

  const [items, total] = await Promise.all([
    itemWeightClient.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      select: itemWeightSelect,
    }),
    itemWeightClient.count({ where }),
  ]);

  return ApiResponse.success(
    {
      data: items.map(serializeItemWeight),
      total,
      limit,
      offset,
    },
    'Item weights fetched'
  );
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  const parsedBody = parseBody<CreateItemWeightInput>(
    body,
    CreateItemWeightSchema
  );

  if (!parsedBody.success) {
    return validationFailedResponse(parsedBody.error);
  }

  const itemWeightClient = getItemWeightClient();
  const bulkQuantityDecimal = toDecimal(parsedBody.data.bulkQuantity);
  const quantityError = ensurePositiveQuantity(bulkQuantityDecimal);
  if (quantityError) {
    return quantityError;
  }

  const bulkWeightDecimal = toDecimal(parsedBody.data.bulkWeight);
  const approxWeightPerPiece = calculateApproxWeightPerPiece(
    bulkWeightDecimal,
    bulkQuantityDecimal
  );

  try {
    const created = await itemWeightClient.create({
      data: {
        itemName: parsedBody.data.itemName.trim(),
        bulkQuantity: bulkQuantityDecimal,
        bulkWeight: bulkWeightDecimal,
        approxWeightPerPiece,
      },
      select: itemWeightSelect,
    });

    return ApiResponse.success(
      serializeItemWeight(created),
      'Item weight created',
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    return handlePrismaError(error, 'Failed to create item weight');
  }
});

export const PUT = withErrorHandler(
  async (request: NextRequest): Promise<NextResponse> => {
    const body = await request.json();
    const { id, ...payload } = (body ?? {}) as { id?: unknown } & Record<
      string,
      unknown
    >;

    if (!id || typeof id !== 'string') {
      return ApiResponse.badRequest('Item weight ID is required');
    }

    const parsedBody = parseBody<UpdateItemWeightInput>(
      payload,
      UpdateItemWeightSchema
    );

    if (!parsedBody.success) {
      return validationFailedResponse(parsedBody.error);
    }

    const itemWeightClient = getItemWeightClient();
    const existing = await itemWeightClient.findUnique({
      where: { id },
      select: itemWeightSelect,
    });

    if (!existing || existing.deletedAt) {
      return ApiResponse.notFound('Item weight');
    }

    const updatePayload = computeUpdatePayload(parsedBody.data, existing);
    const errorResponse = updatePayload.error;
    if (errorResponse) {
      return errorResponse;
    }

    try {
      const updated = await itemWeightClient.update({
        where: { id },
        data: updatePayload.data,
        select: itemWeightSelect,
      });

      return ApiResponse.success(
        serializeItemWeight(updated),
        'Item weight updated'
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          return ApiResponse.notFound('Item weight');
        }
      }
      return handlePrismaError(error, 'Failed to update item weight');
    }
  }
);

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return ApiResponse.badRequest('Item weight ID is required');
  }

  const itemWeightClient = getItemWeightClient();

  try {
    await itemWeightClient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return ApiResponse.success({ success: true }, 'Item weight deleted');
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return ApiResponse.notFound('Item weight');
      }
    }
    return handlePrismaError(error, 'Failed to delete item weight');
  }
});
