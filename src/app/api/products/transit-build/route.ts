import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api/response';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { getDatabaseUrl } from '@/lib/env';
import {
  productService,
  ProductShipmentAccountingConflictError,
  ProductSupplierSettlementError,
} from '@/modules/products/api/service';

function dbNotConfigured(): string | null {
  try {
    const url = getDatabaseUrl();
    if (/postgresql:\/\/username:password@/i.test(url)) {
      return 'DATABASE_URL still has placeholder username/password';
    }
    return null;
  } catch {
    return 'DATABASE_URL is not set';
  }
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const POST = withErrorHandler(async (request: NextRequest) => {
  const misconfig = dbNotConfigured();
  if (misconfig) {
    return ApiResponse.error(
      `Database not configured: ${misconfig}`,
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
  }

  const body = (await request.json().catch(() => null)) as {
    shipmentCode?: unknown;
    fundingSource?: unknown;
    openingBalanceConfirmed?: unknown;
  } | null;

  const shipmentCode = (body?.shipmentCode ?? '').toString().trim();
  if (!shipmentCode) {
    return ApiResponse.badRequest('Invalid payload', {
      shipmentCode: 'Shipment Code is required',
    });
  }

  const fundingSource = body?.fundingSource ?? 'PAYMENT';
  if (fundingSource !== 'PAYMENT' && fundingSource !== 'OPENING_BALANCE') {
    return ApiResponse.badRequest('Invalid transit funding source');
  }
  if (
    fundingSource === 'OPENING_BALANCE' &&
    body?.openingBalanceConfirmed !== true
  ) {
    return ApiResponse.badRequest(
      'Confirm the pre-cutover supplier payment and in-transit opening balance.'
    );
  }

  try {
    const result = await productService.postManualTransitBuildUpByShipmentCode({
      shipmentCode,
      ...(fundingSource === 'OPENING_BALANCE'
        ? { fundingSource, openingBalanceConfirmed: true }
        : {}),
    });
    return ApiResponse.success(result, 'Transit build-up posted');
  } catch (error) {
    if (error instanceof ProductShipmentAccountingConflictError) {
      return ApiResponse.error(error.message, HTTP_STATUS.CONFLICT);
    }
    if (error instanceof ProductSupplierSettlementError) {
      return ApiResponse.error(error.message, error.status);
    }
    throw error;
  }
});
