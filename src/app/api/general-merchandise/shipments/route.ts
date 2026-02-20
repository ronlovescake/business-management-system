import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import type { ShipmentData, ShipmentDB } from '@/types';
import type { ShipmentRecordInput } from '@/modules/shipments/api/schemas';

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

type GeneralMerchandiseShipmentClient = Pick<
  typeof prisma,
  'generalMerchandiseShipment' | 'generalMerchandiseProduct'
>;

const gmPrisma: GeneralMerchandiseShipmentClient = prisma;

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

function convertShipmentDataToDB(
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

type ShipmentDbPayload = ReturnType<typeof convertShipmentDataToDB>;

async function cascadeShipmentDataToProducts(
  client: GeneralMerchandiseShipmentClient,
  shipmentCode: string,
  shipmentData: ShipmentDbPayload
): Promise<void> {
  if (!shipmentCode) {
    return;
  }

  await client.generalMerchandiseProduct.updateMany({
    where: {
      shipmentCode,
    },
    data: {
      cvNumber: shipmentData.cvNumber,
      noOfSacks: shipmentData.noOfSacks,
      totalCBM: shipmentData.totalCBM,
      weight: shipmentData.weight,
      shipmentStatus: shipmentData.shipmentStatus,
    },
  });
}

async function handleSingleShipmentCreation(
  shipment: ShipmentRecordInput
): Promise<ShipmentData> {
  const shipmentData = convertShipmentDataToDB(shipment);
  const createdShipment = await gmPrisma.generalMerchandiseShipment.create({
    data: shipmentData,
  });

  if (shipmentData.shipmentCode) {
    await cascadeShipmentDataToProducts(
      gmPrisma,
      shipmentData.shipmentCode,
      shipmentData
    );
  }

  return convertShipmentDBToData(createdShipment as ShipmentDB);
}

async function handleBulkShipmentImport(
  shipmentPayloads: ShipmentRecordInput[]
): Promise<{ created: number; updated: number; restored: number }> {
  const shipmentsToPersist = shipmentPayloads.map(convertShipmentDataToDB);

  const result = await prisma.$transaction(async (tx) => {
    const gmTx: GeneralMerchandiseShipmentClient = tx;
    let created = 0;
    let updated = 0;
    let restored = 0;

    for (const shipmentData of shipmentsToPersist) {
      if (!shipmentData.shipmentCode) {
        continue;
      }

      const existing = await gmTx.generalMerchandiseShipment.findFirst({
        where: { shipmentCode: shipmentData.shipmentCode },
      });

      if (existing) {
        const wasDeleted = existing.deletedAt !== null;
        await gmTx.generalMerchandiseShipment.update({
          where: { id: existing.id },
          data: {
            ...shipmentData,
            deletedAt: null,
          },
        });

        await cascadeShipmentDataToProducts(
          gmTx,
          shipmentData.shipmentCode,
          shipmentData
        );

        if (wasDeleted) {
          restored += 1;
        } else {
          updated += 1;
        }

        continue;
      }

      await gmTx.generalMerchandiseShipment.create({
        data: shipmentData,
      });

      await cascadeShipmentDataToProducts(
        gmTx,
        shipmentData.shipmentCode,
        shipmentData
      );

      created += 1;
    }

    return { created, updated, restored };
  });

  return result;
}

export const GET = withErrorHandler(async () => {
  const shipments = await gmPrisma.generalMerchandiseShipment.findMany({
    where: { deletedAt: null },
    orderBy: { id: 'asc' },
  });

  const shipmentCodes = Array.from(
    new Set(
      shipments
        .map((shipment) => (shipment.shipmentCode ?? '').trim())
        .filter((code): code is string => Boolean(code))
    )
  );

  const linkedProductAggregates = shipmentCodes.length
    ? await gmPrisma.generalMerchandiseProduct.groupBy({
        by: ['shipmentCode'],
        where: {
          shipmentCode: { in: shipmentCodes },
          deletedAt: null,
        },
        _count: { _all: true },
        _sum: {
          grandTotal: true,
          forwardersFee: true,
          lalamove: true,
          packagingCost: true,
        },
      })
    : [];

  const linkedProductCountByShipmentCode = new Map<string, number>();
  const linkedProductCogsByShipmentCode = new Map<string, number>();
  for (const entry of linkedProductAggregates) {
    const code = (entry.shipmentCode ?? '').trim();
    if (!code) {
      continue;
    }
    linkedProductCountByShipmentCode.set(code, entry._count._all);
    linkedProductCogsByShipmentCode.set(
      code,
      Number(entry._sum.grandTotal ?? 0) +
        Number(entry._sum.forwardersFee ?? 0) +
        Number(entry._sum.lalamove ?? 0) +
        Number(entry._sum.packagingCost ?? 0)
    );
  }

  const payload = shipments.map((shipment) => {
    const shipmentCode = (shipment.shipmentCode ?? '').trim();
    const linkedProductCount = shipmentCode
      ? (linkedProductCountByShipmentCode.get(shipmentCode) ?? 0)
      : 0;
    const linkedProductCogsTotal = shipmentCode
      ? (linkedProductCogsByShipmentCode.get(shipmentCode) ?? 0)
      : 0;

    return {
      ...convertShipmentDBToData(shipment as ShipmentDB),
      linkedProductCount,
      hasLinkedProducts: linkedProductCount > 0,
      linkedProductCogsTotal,
    };
  });

  return ApiResponse.success(payload, 'Shipments fetched');
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();

  if (Array.isArray(body)) {
    const result = await handleBulkShipmentImport(
      body as ShipmentRecordInput[]
    );
    logger.info('GM shipments bulk import completed', result);
    return ApiResponse.success(result, 'Shipments imported');
  }

  const created = await handleSingleShipmentCreation(
    body as ShipmentRecordInput
  );
  return ApiResponse.success(created, 'Shipment created');
});
