import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api/response';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { getDatabaseUrl } from '@/lib/env';
import { generalMerchandiseProductService } from '@/modules/general-merchandise/products/api/service';

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
  } | null;

  const shipmentCode = (body?.shipmentCode ?? '').toString().trim();
  if (!shipmentCode) {
    return ApiResponse.badRequest('Invalid payload', {
      shipmentCode: 'Shipment Code is required',
    });
  }

  const result =
    await generalMerchandiseProductService.postManualTransitBuildUpByShipmentCode(
      {
        shipmentCode,
      }
    );

  return ApiResponse.success(result, 'Transit build-up posted');
});
