import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import type { ShipmentRecordInput } from '@/modules/shipments/api/schemas';
import {
  validateShipmentRecords,
  validateSingleShipment,
} from '@/modules/shipments/api/utils';
import { HTTP_STATUS } from '@/shared/constants/api';
import type { ShipmentData, ShipmentDB } from '@/types';

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

const MASS_DELETE_CONFIRM_TOKEN = 'DELETE_ALL_SHIPMENTS';

interface ShipmentChangeTracking {
  shipmentId: number;
  shipmentCode: string;
  cvNumber: string | null | undefined;
  changes: string[];
}

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

/**
 * Helper function to log operations notification directly to database
 * This is server-side only - cannot use the client-side service
 *
 * Creates a new notification entry for each update. The frontend groups
 * notifications by shipment ID to show change history in a dropdown.
 */
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

function compareValues(
  label: string,
  previous: string | number | null,
  next: string | number | null
): string | null {
  const normalize = (value: string | number | null) => {
    if (value === null || value === undefined || value === '') {
      return 'empty';
    }
    return value;
  };

  const oldValue = normalize(previous);
  const newValue = normalize(next);

  if (oldValue === newValue) {
    return null;
  }

  return `${label}: ${oldValue} → ${newValue}`;
}

function buildUpdateChangeDetails(
  existing: ShipmentDB,
  incoming: ShipmentDbPayload
): string[] {
  const changes: string[] = [];

  const comparisons: Array<
    [string, string | number | null, string | number | null]
  > = [
    ['shipmentCode', existing.shipmentCode, incoming.shipmentCode],
    ['cvNumber', existing.cvNumber, incoming.cvNumber],
    ['noOfSacks', existing.noOfSacks, incoming.noOfSacks],
    ['totalCBM', existing.totalCBM, incoming.totalCBM],
    ['weight', existing.weight, incoming.weight],
    ['fee', existing.fee, incoming.fee],
    ['shipmentStatus', existing.shipmentStatus, incoming.shipmentStatus],
    ['dateCreated', existing.dateCreated, incoming.dateCreated],
    ['dateDelivered', existing.dateDelivered, incoming.dateDelivered],
    ['notes', existing.notes, incoming.notes],
  ];

  comparisons.forEach(([label, prev, next]) => {
    const diff = compareValues(label, prev, next);
    if (diff) {
      changes.push(diff);
    }
  });

  return changes;
}

function buildCreationChangeDetails(incoming: ShipmentDbPayload): string[] {
  const changes: string[] = [];

  const fields: Array<[string, string | number | null]> = [
    ['shipmentCode', incoming.shipmentCode],
    ['cvNumber', incoming.cvNumber],
    ['noOfSacks', incoming.noOfSacks],
    ['totalCBM', incoming.totalCBM],
    ['weight', incoming.weight],
    ['fee', incoming.fee],
    ['shipmentStatus', incoming.shipmentStatus],
    ['dateCreated', incoming.dateCreated],
    ['dateDelivered', incoming.dateDelivered],
    ['notes', incoming.notes],
  ];

  fields.forEach(([label, value]) => {
    if (value !== null && value !== undefined && value !== '' && value !== 0) {
      changes.push(`${label}: empty → ${value}`);
    }
  });

  return changes;
}

async function cascadeShipmentDataToProducts(
  client: Prisma.TransactionClient | typeof prisma,
  shipmentCode: string,
  shipmentData: ShipmentDbPayload
): Promise<void> {
  if (!shipmentCode) {
    return;
  }

  await client.product.updateMany({
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

async function createShipmentNotifications(
  changeTracking: ShipmentChangeTracking[]
): Promise<void> {
  if (changeTracking.length === 0) {
    return;
  }

  const notificationPromises = changeTracking.map(async (tracked) => {
    let changeMessage = `Updated shipment #${tracked.shipmentId}`;

    if (tracked.shipmentCode && tracked.cvNumber) {
      changeMessage += ` - ${tracked.shipmentCode} (${tracked.cvNumber})`;
    } else if (tracked.shipmentCode) {
      changeMessage += ` - ${tracked.shipmentCode}`;
    } else if (tracked.cvNumber) {
      changeMessage += ` - (${tracked.cvNumber})`;
    }

    if (tracked.changes.length > 0) {
      changeMessage += ` - Modified: ${tracked.changes.join(', ')}`;
    }

    await logOperationNotification('shipments', changeMessage, {
      shipmentId: tracked.shipmentId,
    });
  });

  await Promise.all(notificationPromises);
  logger.info(
    `✅ Created ${notificationPromises.length} shipment notifications`
  );
}

async function logOperationNotification(
  category: string,
  changes: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const id = randomUUID();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;
    const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    const philippineTime = new Date(now);

    await prisma.$executeRaw`
      INSERT INTO "operations_notifications" (id, category, "user", changes, metadata, "createdAt")
      VALUES (${id}, ${category}, ${'Operations'}, ${changes}, ${metadataJson}::jsonb, ${philippineTime})
    `;
  } catch (error) {
    logger.warn('Failed to log operations notification:', error);
  }
}

async function handleSingleShipmentCreation(
  shipment: ShipmentRecordInput
): Promise<ShipmentData> {
  const shipmentData = convertShipmentDataToDB(shipment);
  const createdShipment = await prisma.shipment.create({
    data: shipmentData,
  });

  if (shipmentData.shipmentCode) {
    await cascadeShipmentDataToProducts(
      prisma,
      shipmentData.shipmentCode,
      shipmentData
    );
  }

  return convertShipmentDBToData(createdShipment as ShipmentDB);
}

async function handleBulkShipmentImport(
  shipmentPayloads: ShipmentRecordInput[]
) {
  const shipmentsToPersist = shipmentPayloads.map(convertShipmentDataToDB);

  const result = await prisma.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    let restored = 0;
    const changeTracking: ShipmentChangeTracking[] = [];

    for (const shipmentData of shipmentsToPersist) {
      if (!shipmentData.shipmentCode) {
        continue;
      }

      const existing = await tx.shipment.findFirst({
        where: { shipmentCode: shipmentData.shipmentCode },
      });

      if (existing) {
        const wasDeleted = existing.deletedAt !== null;
        const changeDetails = buildUpdateChangeDetails(existing, shipmentData);

        await tx.shipment.update({
          where: { id: existing.id },
          data: {
            ...shipmentData,
            deletedAt: null,
          },
        });

        await cascadeShipmentDataToProducts(
          tx,
          shipmentData.shipmentCode,
          shipmentData
        );

        if (changeDetails.length > 0) {
          changeTracking.push({
            shipmentId: existing.id,
            shipmentCode: shipmentData.shipmentCode,
            cvNumber: shipmentData.cvNumber,
            changes: changeDetails,
          });
        }

        if (wasDeleted) {
          restored++;
        } else {
          updated++;
        }

        continue;
      }

      const newShipment = await tx.shipment.create({ data: shipmentData });

      await cascadeShipmentDataToProducts(
        tx,
        shipmentData.shipmentCode,
        shipmentData
      );

      const creationChanges = buildCreationChangeDetails(shipmentData);
      if (creationChanges.length > 0) {
        changeTracking.push({
          shipmentId: newShipment.id,
          shipmentCode: shipmentData.shipmentCode,
          cvNumber: shipmentData.cvNumber,
          changes: creationChanges,
        });
      }

      created++;
    }

    return { created, updated, restored, changeTracking };
  });

  await createShipmentNotifications(result.changeTracking);

  return result;
}

export const GET = withErrorHandler(async () => {
  try {
    const shipments = await prisma.shipment.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
    });

    const convertedShipments = shipments.map(convertShipmentDBToData);
    logger.info('Shipments fetched', { count: convertedShipments.length });
    return ApiResponse.success(convertedShipments, 'Shipments fetched');
  } catch (error) {
    logger.error('Error fetching shipments', { error });
    return ApiResponse.error('Failed to fetch shipments');
  }
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const payloadSize = Array.isArray(body) ? body.length : 1;
    logger.debug('Received shipment payload', { count: payloadSize });

    if (!Array.isArray(body) && (typeof body !== 'object' || body === null)) {
      return ApiResponse.badRequest('Invalid data format', {
        payload: 'Expected an object or array of shipments',
      });
    }

    if (Array.isArray(body)) {
      if (body.length === 0) {
        return ApiResponse.badRequest('Invalid data format', {
          payload: 'Shipment array cannot be empty',
        });
      }

      if (body.length > MAX_QUERY_LIMIT) {
        logger.warn(
          `Batch size limit exceeded: ${body.length} records (max ${MAX_QUERY_LIMIT})`
        );
        return ApiResponse.payloadTooLarge(body.length, MAX_QUERY_LIMIT);
      }

      const { valid, invalid } = validateShipmentRecords(body);

      if (valid.length === 0) {
        return ApiResponse.badRequest('Validation failed', {
          shipments:
            'All rows failed validation. Please review and fix the import file.',
        });
      }

      const summary = await handleBulkShipmentImport(valid);

      const { created, updated, restored } = summary;

      logger.info('Shipments import completed', {
        created,
        updated,
        restored,
        skipped: invalid.length,
      });

      return ApiResponse.success(
        {
          created,
          updated,
          restored,
          skipped: invalid.length,
          skippedDetails: invalid,
          total: created + updated + restored,
        },
        'Shipments imported successfully'
      );
    }

    const validation = validateSingleShipment(body);
    if (!validation.success) {
      return ApiResponse.badRequest('Validation failed', validation.errors);
    }

    const shipment = await handleSingleShipmentCreation(validation.shipment);
    logger.info('Created single shipment', {
      shipmentCode: validation.shipment['Shipment Code'],
    });

    return ApiResponse.success(
      shipment,
      'Shipment created',
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('Error creating shipment(s)', { error });

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return ApiResponse.conflict(
          'Duplicate shipment',
          'A shipment with this code already exists',
          'Shipment Code'
        );
      }
    }

    return ApiResponse.error('Failed to create shipment(s)');
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

    logger.warn('Mass deletion requested for shipments');

    const alreadyDeleted = await prisma.shipment.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.shipment.updateMany({
      where: { deletedAt: null },
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info('Shipments soft deleted', {
      deleted: result.count,
      previouslyDeleted: alreadyDeleted,
    });

    return ApiResponse.success(
      {
        deleted: result.count,
        note: 'Records are soft-deleted and can be recovered if needed',
      },
      'Shipments soft deleted'
    );
  } catch (error) {
    logger.error('Failed to delete shipments', { error });
    return ApiResponse.error('Failed to delete shipments');
  }
});
