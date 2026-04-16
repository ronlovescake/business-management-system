import { ApiResponse } from '@/core/api';
import { sanitizers } from '@/lib/security/sanitize';
import { logger } from '@/lib/logger';
import type { ShipmentData, ShipmentDB } from '@/types';
import type { ShipmentRecordInput } from './schemas';

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

export function formatShipmentDateValue(
  date: string | Date | null | undefined
): string {
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
    const [year, month, dayStr] = date.split('-');
    const monthIndex = Number(month) - 1;
    const dayNumber = Number(dayStr);
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

  return formatShipmentDateValue(parsed);
}

export function convertShipmentDBToData(shipment: ShipmentDB): ShipmentData {
  return {
    id: shipment.id,
    'Shipment Code': shipment.shipmentCode,
    'CV Number': shipment.cvNumber || '',
    'No. Of Sacks': shipment.noOfSacks,
    'Total CBM': shipment.totalCBM,
    Weight: shipment.weight,
    Fee: shipment.fee,
    'Shipment Status': shipment.shipmentStatus,
    'Date Created': formatShipmentDateValue(shipment.dateCreated),
    'Date Delivered': formatShipmentDateValue(shipment.dateDelivered),
    Duration: shipment.duration || '',
    Notes: shipment.notes || '',
  };
}

export function convertShipmentDataToDB(
  data: Partial<ShipmentData> | ShipmentRecordInput
) {
  const cleanNumber = (value: unknown, decimals = 2): number => {
    return sanitizers.number(value, { min: 0, decimals }) ?? 0;
  };

  return {
    shipmentCode: sanitizers.productCode(data['Shipment Code']) || '',
    cvNumber: sanitizers.name(data['CV Number']) || null,
    noOfSacks: Math.round(cleanNumber(data['No. Of Sacks'], 0)),
    totalCBM: cleanNumber(data['Total CBM']),
    weight: cleanNumber(data['Weight']),
    fee: cleanNumber(data['Fee']),
    shipmentStatus: sanitizers.name(data['Shipment Status']) || '',
    dateCreated: sanitizers.date(data['Date Created']) || null,
    dateDelivered: sanitizers.date(data['Date Delivered']) || null,
    duration: sanitizers.name(data['Duration']) || null,
    notes: sanitizers.notes(data['Notes']) || null,
  };
}

export type ShipmentDbPayload = ReturnType<typeof convertShipmentDataToDB>;

export function getOrderStatusFromShipmentStatus(
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

  logger.warn(
    'Unknown shipment status; defaulting transaction status to In Transit',
    { shipmentStatus }
  );

  return 'In Transit';
}

export function parseShipmentId(context?: {
  params: { id: string };
}): { id: number } | { error: ReturnType<typeof ApiResponse.badRequest> } {
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

export interface ProductCostFields {
  cogs: unknown;
  grandTotal: unknown;
  forwardersFee: unknown;
  lalamove: unknown;
  packagingCost: unknown;
}

export const PRODUCT_TRANSIT_BUILD_PREFIX = 'PRODUCT_TRANSIT_BUILD:';
export const SHIPMENT_TRANSIT_BUILD_PREFIX = 'SHIPMENT_TRANSIT_BUILD:';

export function getTransitBuildEntrySource(
  idempotencyKey: string
): 'product' | 'shipment' | 'unknown' {
  const normalized = (idempotencyKey ?? '').trim();

  if (normalized.startsWith(PRODUCT_TRANSIT_BUILD_PREFIX)) {
    return 'product';
  }

  if (normalized.startsWith(SHIPMENT_TRANSIT_BUILD_PREFIX)) {
    return 'shipment';
  }

  return 'unknown';
}

export function parseProductIdFromTransitBuildKey(
  idempotencyKey: string
): number | null {
  const normalized = (idempotencyKey ?? '').trim();
  if (!normalized.startsWith(PRODUCT_TRANSIT_BUILD_PREFIX)) {
    return null;
  }

  const [, rawProductId] = normalized.split(':');
  const productId = Number(rawProductId);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
}

export function computeExpectedAmount(products: ProductCostFields[]): number {
  return products.reduce((sum, product) => {
    const rawCogs = Number(product.cogs ?? 0);
    const derivedCogs =
      Number(product.grandTotal ?? 0) +
      Number(product.forwardersFee ?? 0) +
      Number(product.lalamove ?? 0) +
      Number(product.packagingCost ?? 0);

    const value = rawCogs > 0 ? rawCogs : derivedCogs;
    if (!Number.isFinite(value) || value <= 0) {
      return sum;
    }
    return sum + value;
  }, 0);
}
