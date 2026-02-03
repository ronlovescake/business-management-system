import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '../../../../lib/db';
import type { ShipmentData, ShipmentDB } from '../../../../types';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import { postExpenseForShipment } from '@/modules/shipments/api/expenses';

function getOrderStatusFromShipmentStatus(
  shipmentStatus: string
): 'In Transit' | 'Warehouse' {
  // IMPORTANT: For Pickup / Sorting / Delivered MUST map to "Warehouse".
  // Do not change this mapping without explicit business approval.
  const normalized = (shipmentStatus ?? '').trim().toLowerCase();

  if (!normalized) {
    return 'In Transit';
  }

  const inTransitStatuses = new Set([
    'in transit',
    'manila port',
    'with pier gatepass',
    'ph warehouse',
  ]);

  const warehouseStatuses = new Set([
    'for pickup',
    'pickup',
    'sorting',
    'delivered',
  ]);

  if (warehouseStatuses.has(normalized)) {
    return 'Warehouse';
  }

  if (inTransitStatuses.has(normalized)) {
    return 'In Transit';
  }

  // Preserve existing ops behavior: unknown shipment statuses treated as in-transit.
  logger.warn(
    'Unknown shipment status; defaulting transaction status to In Transit',
    {
      shipmentStatus,
    }
  );

  return 'In Transit';
}

// Helper function to convert database model to frontend interface
function convertShipmentDBToData(shipment: ShipmentDB): ShipmentData {
  return {
    id: shipment.id,
    'Shipment Code': shipment.shipmentCode,
    'CV Number': shipment.cvNumber || '',
    'No. Of Sacks': shipment.noOfSacks,
    'Total CBM': shipment.totalCBM,
    Weight: shipment.weight,
    Fee: shipment.fee,
    'Shipment Status': shipment.shipmentStatus,
    'Date Created': formatDateValue(shipment.dateCreated),
    'Date Delivered': formatDateValue(shipment.dateDelivered),
    Duration: shipment.duration || '',
    Notes: shipment.notes || '',
  };
}
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function formatDateValue(date: string | Date | null | undefined): string {
  if (!date) {
    return '';
  }

  if (date instanceof Date) {
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    return `${MONTH_NAMES[month]} ${day}, ${year}`;
  }

  const isoMatch = date.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoMatch) {
    const [year, month, day] = date.split('-');
    const monthIndex = Number(month) - 1;
    const dayNumber = Number(day);
    if (
      Number.isInteger(monthIndex) &&
      monthIndex >= 0 &&
      monthIndex < MONTH_NAMES.length &&
      Number.isInteger(dayNumber)
    ) {
      return `${MONTH_NAMES[monthIndex]} ${dayNumber}, ${year}`;
    }
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return formatDateValue(parsed);
}

// Helper function to convert frontend interface to database model
function convertShipmentDataToDB(data: Partial<ShipmentData>) {
  return {
    shipmentCode: sanitizers.productCode(data['Shipment Code'] || ''),
    cvNumber: data['CV Number'] ? sanitizers.name(data['CV Number']) : null,
    noOfSacks: sanitizers.number(data['No. Of Sacks'], { min: 0 }) ?? 0,
    totalCBM:
      sanitizers.number(data['Total CBM'], { min: 0, decimals: 2 }) ?? 0,
    weight: sanitizers.number(data['Weight'], { min: 0, decimals: 2 }) ?? 0,
    fee: sanitizers.number(data['Fee'], { min: 0, decimals: 2 }) ?? 0,
    shipmentStatus: sanitizers.name(data['Shipment Status'] || ''),
    dateCreated: data['Date Created']
      ? sanitizers.date(data['Date Created'])
      : null,
    dateDelivered: data['Date Delivered']
      ? sanitizers.date(data['Date Delivered'])
      : null,
    duration: data['Duration'] ? sanitizers.name(data['Duration']) : null,
    notes: data['Notes'] ? sanitizers.notes(data['Notes']) : null,
  };
}

type RouteContext = { params: { id: string } };

export const GET = withErrorHandler<RouteContext>(
  async (_request: NextRequest, context) => {
    const idResult = parseShipmentId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: idResult.id },
    });

    if (!shipment) {
      return ApiResponse.notFound('Shipment');
    }

    const convertedShipment = convertShipmentDBToData(shipment as ShipmentDB);
    return ApiResponse.success(convertedShipment, 'Shipment fetched');
  }
);

export const PUT = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const idResult = parseShipmentId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const body = await request.json();
    const shipmentData = convertShipmentDataToDB(body);

    const currentShipment = await prisma.shipment.findUnique({
      where: { id: idResult.id },
    });

    if (!currentShipment) {
      return ApiResponse.notFound('Shipment');
    }

    const updatedShipment = await prisma.shipment.update({
      where: { id: idResult.id },
      data: shipmentData,
    });

    if (currentShipment.shipmentCode) {
      await prisma.product.updateMany({
        where: {
          shipmentCode: currentShipment.shipmentCode,
        },
        data: {
          cvNumber: shipmentData.cvNumber,
          noOfSacks: shipmentData.noOfSacks,
          totalCBM: shipmentData.totalCBM,
          weight: shipmentData.weight,
          shipmentStatus: shipmentData.shipmentStatus,
        },
      });

      logger.debug(
        `Updated products with shipment code: ${currentShipment.shipmentCode}`,
        `Updated fields: cvNumber, noOfSacks, totalCBM, weight, shipmentStatus`
      );

      // Keep Transactions order status in sync with Shipment status.
      // Only update auto-managed statuses (blank / In Transit / Warehouse) to avoid overriding manual progress.
      const nextOrderStatus = getOrderStatusFromShipmentStatus(
        shipmentData.shipmentStatus
      );

      const productsForShipment = await prisma.product.findMany({
        where: {
          shipmentCode: currentShipment.shipmentCode,
        },
        select: {
          productCode: true,
        },
      });

      const productCodes = productsForShipment
        .map((product) => product.productCode)
        .filter((code): code is string => Boolean(code));

      const updateResult = await prisma.transaction.updateMany({
        where: {
          deletedAt: null,
          AND: [
            {
              OR: [
                { shipmentCode: currentShipment.shipmentCode },
                ...(productCodes.length > 0
                  ? [{ productCode: { in: productCodes } }]
                  : []),
              ],
            },
            {
              OR: [
                { orderStatus: null },
                { orderStatus: '' },
                { orderStatus: { equals: 'In Transit', mode: 'insensitive' } },
                { orderStatus: { equals: 'Warehouse', mode: 'insensitive' } },
              ],
            },
          ],
        },
        data: {
          orderStatus: nextOrderStatus,
        },
      });

      if (updateResult.count > 0) {
        logger.info('Synced transaction orderStatus from shipment status', {
          shipmentCode: currentShipment.shipmentCode,
          shipmentStatus: shipmentData.shipmentStatus,
          orderStatus: nextOrderStatus,
          updatedCount: updateResult.count,
        });
      }
    }

    await postExpenseForShipment(updatedShipment as ShipmentDB);

    const convertedShipment = convertShipmentDBToData(
      updatedShipment as ShipmentDB
    );
    return ApiResponse.success(convertedShipment, 'Shipment updated');
  }
);

export const DELETE = withErrorHandler<RouteContext>(
  async (_request: NextRequest, context) => {
    const idResult = parseShipmentId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    await prisma.shipment.delete({
      where: { id: idResult.id },
    });

    return ApiResponse.success(
      { id: idResult.id },
      'Shipment deleted successfully'
    );
  }
);

function parseShipmentId(
  context?: RouteContext
): { id: number } | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const idParam = context?.params?.id ?? '';
  const id = Number(idParam);

  if (!idParam || Number.isNaN(id)) {
    return {
      error: ApiResponse.badRequest('Invalid shipment ID', {
        id: 'Provide a numeric shipment ID in the URL path.',
      }),
    };
  }

  return { id };
}
