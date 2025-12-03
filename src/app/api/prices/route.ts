import type { NextRequest } from 'next/server';
import type { Price } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import type { PriceRecordInput } from '@/modules/prices/api/schemas';
import {
  convertPriceDataToDb,
  validatePriceRecords,
} from '@/modules/prices/api/utils';
import { HTTP_STATUS } from '@/shared/constants/api';

type PriceDTO = {
  id?: number;
  'Product Code': string;
  'Lower Limit': number;
  'Upper Limit': number;
  Prices: number;
  'Price Adjustment': number;
};

const MASS_DELETE_CONFIRM_TOKEN = 'DELETE_ALL_PRICES';
const CSV_IMPORT_THRESHOLD = 10;

function mapPriceDbToDto(price: Price): PriceDTO {
  return {
    id: price.id,
    'Product Code': price.productCode,
    'Lower Limit': Math.round(price.lowerLimit / 100),
    'Upper Limit': Math.round(price.upperLimit / 100),
    Prices: Math.round(price.currentPrice / 100),
    'Price Adjustment': Math.round(price.priceAdjustment / 100),
  };
}

async function handleBulkPriceImport(
  records: PriceRecordInput[],
  options: { isCsvImport: boolean }
) {
  const pricePayloads = records.map(convertPriceDataToDb);

  return prisma.$transaction(async (tx) => {
    if (options.isCsvImport) {
      await tx.price.deleteMany();
      logger.info('CSV import mode: cleared existing prices before import');
    }

    let created = 0;
    let updated = 0;
    let restored = 0;

    for (const payload of pricePayloads) {
      const existing = await tx.price.findFirst({
        where: {
          productCode: payload.productCode,
          lowerLimit: payload.lowerLimit,
          upperLimit: payload.upperLimit,
        },
      });

      if (existing) {
        const wasDeleted = existing.deletedAt !== null;

        await tx.price.update({
          where: { id: existing.id },
          data: {
            ...payload,
            deletedAt: null,
          },
        });

        if (wasDeleted) {
          restored++;
        } else {
          updated++;
        }

        continue;
      }

      await tx.price.create({ data: payload });
      created++;
    }

    return { created, updated, restored };
  });
}

async function replaceProductTiers(
  productCode: string,
  records: PriceRecordInput[]
) {
  const payloads = records.map(convertPriceDataToDb);

  return prisma.$transaction(async (tx) => {
    await tx.price.deleteMany({ where: { productCode } });
    await tx.price.createMany({ data: payloads });

    return {
      productCode,
      tiersUpdated: payloads.length,
    };
  });
}

function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return ApiResponse.conflict(
        'Duplicate price',
        'A price with this product code and range already exists',
        'Product Code'
      );
    }
    if (error.code === 'P2003') {
      return ApiResponse.conflict(
        'Reference integrity violation',
        'Referenced product does not exist'
      );
    }
  }
  return null;
}

export const GET = withErrorHandler(async () => {
  try {
    const prices = await prisma.price.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const formattedPrices = prices.map(mapPriceDbToDto);
    logger.info('Prices fetched', { count: formattedPrices.length });
    return ApiResponse.success(formattedPrices, 'Prices fetched');
  } catch (error) {
    logger.error('Failed to fetch prices', { error });
    return ApiResponse.error('Failed to fetch prices');
  }
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();

    if (!Array.isArray(body) || body.length === 0) {
      return ApiResponse.badRequest('Invalid data format', {
        payload: 'Expected array of price objects',
      });
    }

    if (body.length > MAX_QUERY_LIMIT) {
      logger.warn(
        `Batch size limit exceeded: ${body.length} records (max ${MAX_QUERY_LIMIT})`
      );
      return ApiResponse.payloadTooLarge(body.length, MAX_QUERY_LIMIT);
    }

    const { valid, invalid } = validatePriceRecords(body);

    if (valid.length === 0) {
      return ApiResponse.badRequest('Validation failed', {
        prices:
          'All rows failed validation. Please review the import payload and try again.',
      });
    }

    const summary = await handleBulkPriceImport(valid, {
      isCsvImport: body.length > CSV_IMPORT_THRESHOLD,
    });

    logger.info('Prices import completed', {
      created: summary.created,
      updated: summary.updated,
      restored: summary.restored,
      skipped: invalid.length,
    });

    return ApiResponse.success(
      {
        created: summary.created,
        updated: summary.updated,
        restored: summary.restored,
        total: summary.created + summary.updated + summary.restored,
        skipped: invalid.length,
        skippedDetails: invalid,
        filtered: body.length - valid.length,
      },
      'Prices imported successfully',
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('Failed to import prices', { error });
    const handled = handlePrismaError(error);
    if (handled) {
      return handled;
    }
    return ApiResponse.error('Failed to import price data to database');
  }
});

export const PUT = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const productCodeParam = searchParams.get('productCode');
    const productCode = sanitizers.productCode(productCodeParam) || '';

    if (!productCode) {
      return ApiResponse.badRequest('Missing product code', {
        productCode: 'Provide ?productCode=XYZ to target a specific product',
      });
    }

    const body = await request.json();

    if (!Array.isArray(body) || body.length === 0) {
      return ApiResponse.badRequest('Invalid data format', {
        payload: 'Expected array of price tiers',
      });
    }

    const { valid, invalid } = validatePriceRecords(body);
    const matching = valid.filter(
      (entry) => entry['Product Code'] === productCode
    );

    if (matching.length === 0) {
      return ApiResponse.badRequest('No valid price data', {
        tiers: 'No valid tiers found for the specified product code',
      });
    }

    const result = await replaceProductTiers(productCode, matching);

    logger.info('Updated product price tiers', {
      productCode: result.productCode,
      tiersUpdated: result.tiersUpdated,
    });

    return ApiResponse.success({
      productCode: result.productCode,
      tiersUpdated: result.tiersUpdated,
      skipped: invalid.length + (valid.length - matching.length),
      skippedDetails: invalid,
    });
  } catch (error) {
    logger.error('Failed to update prices', { error });
    const handled = handlePrismaError(error);
    if (handled) {
      return handled;
    }
    return ApiResponse.error('Failed to update prices');
  }
});

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const confirmParam = searchParams.get('confirm');

    if (confirmParam !== MASS_DELETE_CONFIRM_TOKEN) {
      return ApiResponse.badRequest('Mass deletion protection', {
        confirm: `Provide ?confirm=${MASS_DELETE_CONFIRM_TOKEN} to acknowledge the operation`,
      });
    }

    logger.warn('Mass deletion requested for prices');

    const alreadyDeleted = await prisma.price.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.price.updateMany({
      where: { deletedAt: null },
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info('Prices soft deleted', {
      deleted: result.count,
      previouslyDeleted: alreadyDeleted,
    });

    return ApiResponse.success(
      {
        deleted: result.count,
        note: 'Records are soft-deleted and can be recovered if needed',
      },
      'Prices soft deleted'
    );
  } catch (error) {
    logger.error('Failed to delete prices', { error });
    return ApiResponse.error('Failed to delete prices');
  }
});
