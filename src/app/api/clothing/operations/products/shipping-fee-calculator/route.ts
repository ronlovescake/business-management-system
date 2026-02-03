import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/core/api/response';

type MultipliersPayload = Record<string, number>;

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
    const { shipmentCode, multipliers, actualInputs } = body ?? {};

    if (!shipmentCode || !actualInputs) {
      return ApiResponseUtil.error('Missing required fields', 400);
    }

    const trimmedShipmentCode = String(shipmentCode).trim();

    if (!trimmedShipmentCode) {
      return ApiResponseUtil.error('Shipment code is required', 400);
    }

    const toNumber = (value: unknown): number => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value.replace(/,/g, ''));
        return Number.isFinite(parsed) ? parsed : 0;
      }
      return 0;
    };

    const normalizedMultipliers = Object.entries(
      (multipliers as Record<string, unknown>) || {}
    ).reduce<Record<string, number>>((acc, [productCode, value]) => {
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
      shipmentCode: trimmedShipmentCode,
      actualAlibabaShipping: toNumber(actualInputs.actualAlibabaShipping),
      actualForwardersFee: toNumber(actualInputs.actualForwardersFee),
      actualLalamove: toNumber(actualInputs.actualLalamove),
      multipliers: normalizedMultipliers,
      deletedAt: null,
    };

    await prisma.shippingFeeCalculatorState.upsert({
      where: {
        shipmentCode: trimmedShipmentCode,
      },
      create: payload,
      update: payload,
    });

    return ApiResponseUtil.ok();
  } catch (error) {
    logger.error('Error saving shipping fee calculator data:', error);
    return ApiResponseUtil.error('Failed to save data', 500);
  }
}
