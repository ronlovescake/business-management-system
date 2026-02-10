import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/core/api/response';

type MultipliersPayload = Record<string, number>;

/**
 * Coerce a value to a finite number, falling back to 0.
 * Handles strings with commas (e.g. "1,234.56").
 */
function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Zod schema for the POST body of the shipping fee calculator.
 * Validates required fields and coerces numeric inputs.
 */
const ShippingFeeCalculatorSchema = z.object({
  shipmentCode: z.string().trim().min(1, 'Shipment code is required'),
  multipliers: z.preprocess(
    (value) => (value === null || value === undefined ? {} : value),
    z.record(z.string(), z.unknown())
  ),
  actualInputs: z.object({
    actualAlibabaShipping: z.unknown(),
    actualForwardersFee: z.unknown(),
    actualLalamove: z.unknown(),
  }),
});

/**
 * Shipping Fee Calculator state (Products page).
 *
 * Business context:
 * - We treat each shipment code as a "lot" containing multiple product codes.
 * - Shipment-level costs (Alibaba shipping, forwarder's fee, lalamove, packaging)
 *   are allocated across those product codes using multiplier-based weighting.
 * - This endpoint only persists calculator inputs/state per shipmentCode so the UI can
 *   reload and re-run the allocation. The allocated per-product costs are then recorded
 *   on the Product rows (e.g., `forwardersFee`, `lalamove`, `packagingCost`) via the
 *   Products workflow.
 */

/**
 * GET - Load shipping fee calculator data for a shipment code
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shipmentCode = searchParams.get('shipmentCode');

    if (!shipmentCode) {
      return ApiResponseUtil.error('Shipment code is required', 400);
    }

    const record = await prisma.shippingFeeCalculatorState.findUnique({
      where: {
        shipmentCode,
      },
    });

    if (!record || record.deletedAt) {
      return ApiResponseUtil.success(null);
    }

    return ApiResponseUtil.success({
      id: record.id,
      shipmentCode: record.shipmentCode,
      actualAlibabaShipping: record.actualAlibabaShipping,
      actualForwardersFee: record.actualForwardersFee,
      actualLalamove: record.actualLalamove,
      multipliers: (record.multipliers as MultipliersPayload) || {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    logger.error('Error loading shipping fee calculator data:', error);
    return ApiResponseUtil.error('Failed to load data', 500);
  }
}

/**
 * POST - Save/Overwrite shipping fee calculator data for a shipment code
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = ShippingFeeCalculatorSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.errors.map((e) => e.message).join('; ');
      return ApiResponseUtil.error(message, 400);
    }

    const { shipmentCode, multipliers, actualInputs } = parsed.data;

    const normalizedMultipliers = Object.entries(multipliers).reduce<
      Record<string, number>
    >((acc, [productCode, value]) => {
      const code = String(productCode).trim();
      if (!code) {
        return acc;
      }

      const numericValue = toNumber(value);
      if (Number.isFinite(numericValue)) {
        acc[code] = numericValue;
      }
      return acc;
    }, {});

    const payload = {
      shipmentCode,
      actualAlibabaShipping: toNumber(actualInputs.actualAlibabaShipping),
      actualForwardersFee: toNumber(actualInputs.actualForwardersFee),
      actualLalamove: toNumber(actualInputs.actualLalamove),
      multipliers: normalizedMultipliers,
      deletedAt: null,
    };

    await prisma.shippingFeeCalculatorState.upsert({
      where: { shipmentCode },
      create: payload,
      update: payload,
    });

    return ApiResponseUtil.ok();
  } catch (error) {
    logger.error('Error saving shipping fee calculator data:', error);
    return ApiResponseUtil.error('Failed to save data', 500);
  }
}
