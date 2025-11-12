import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '../../../lib/db';
import type { ShipmentData, ShipmentDB } from '../../../types';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';

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

/**
 * Helper function to log operations notification directly to database
 * This is server-side only - cannot use the client-side service
 *
 * Creates a new notification entry for each update. The frontend groups
 * notifications by shipment ID to show change history in a dropdown.
 */
async function logOperationNotification(
  category: string,
  changes: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const id = randomUUID();
    const metadataJson = metadata ? JSON.stringify(metadata) : null;

    // Use current time in Philippine timezone
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

// Helper function to convert frontend interface to database model
function convertShipmentDataToDB(data: Partial<ShipmentData>) {
  // Use sanitizers for numeric cleaning
  const cleanNumber = (value: unknown): number => {
    return sanitizers.number(value, { min: 0, decimals: 2 }) ?? 0;
  };

  // Use sanitizers for fee value - handles peso symbol and commas
  const cleanFee = (feeValue: unknown): number => {
    return sanitizers.number(feeValue, { min: 0, decimals: 2 }) ?? 0;
  };

  return {
    shipmentCode: sanitizers.productCode(data['Shipment Code']) || '',
    cvNumber: sanitizers.name(data['CV Number']) || null,
    noOfSacks: Math.round(cleanNumber(data['No. Of Sacks'])), // Must be Int
    totalCBM: cleanNumber(data['Total CBM']),
    weight: cleanNumber(data['Weight']),
    fee: cleanFee(data['Fee']),
    shipmentStatus: sanitizers.name(data['Shipment Status']) || '',
    dateCreated: sanitizers.date(data['Date Created']) || null,
    dateDelivered: sanitizers.date(data['Date Delivered']) || null,
    duration: sanitizers.name(data['Duration']) || null,
    notes: sanitizers.notes(data['Notes']) || null,
  };
}

// GET /api/shipments - Get all shipments (excluding soft-deleted)
export async function GET() {
  try {
    // ========================================================================
    // ⚠️ SOFT DELETE FILTER
    // ========================================================================
    const shipments = await prisma.shipment.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
    });

    const convertedShipments = shipments.map(convertShipmentDBToData);

    return NextResponse.json(convertedShipments);
  } catch (error) {
    logger.error('Error fetching shipments:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch shipments',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// POST /api/shipments - Create new shipment or bulk import
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    logger.debug(
      'Received shipment data, count:',
      Array.isArray(body) ? body.length : 1
    );

    // ========================================================================
    // ⚠️ DATA VALIDATION - Format Check
    // ========================================================================
    if (!Array.isArray(body) && typeof body !== 'object') {
      return NextResponse.json(
        {
          error: 'Invalid data format',
          details: 'Expected an object or array of shipments',
        },
        { status: 400 }
      );
    }

    // Check if it's a single shipment or bulk import
    if (Array.isArray(body)) {
      // ========================================================================
      // ⚠️ BATCH SIZE LIMIT - Maximum records per import
      // ========================================================================
      if (body.length > MAX_QUERY_LIMIT) {
        logger.warn(
          `Batch size limit exceeded: ${body.length} records (max ${MAX_QUERY_LIMIT})`
        );
        return NextResponse.json(
          {
            error: 'Batch size limit exceeded',
            details: `You are trying to import ${body.length} records. Maximum is ${MAX_QUERY_LIMIT.toLocaleString()} records per import.`,
            suggestion: `Please split your import into smaller batches of ${MAX_QUERY_LIMIT.toLocaleString()} records or less.`,
          },
          { status: 413 } // Payload Too Large
        );
      }

      // ========================================================================
      // ⚠️ BULK IMPORT - Clear existing and insert new (legacy behavior)
      // ========================================================================
      const shipmentsToCreate = body.map((item, index) => {
        try {
          return convertShipmentDataToDB(item);
        } catch (err) {
          logger.error(
            `Error converting shipment at index ${index}:`,
            err,
            'Data:',
            item
          );
          throw err;
        }
      });

      logger.debug('Converted shipments, count:', shipmentsToCreate.length);

      // ========================================================================
      // ⚠️ ATOMIC BULK IMPORT - Upsert/Restore Pattern with change tracking
      // ========================================================================
      // Use upsert to maintain stable IDs and restore soft-deleted records
      // Track changes for: Shipment Code, CV Number, No. Of Sacks, Total CBM,
      // Weight, Fee, Shipment Status, Date Created, Date Delivered, Notes
      // ========================================================================
      const result = await prisma.$transaction(async (tx) => {
        let created = 0;
        let updated = 0;
        let restored = 0;

        const changeTracking: Array<{
          shipmentId: number;
          shipmentCode: string;
          cvNumber: string | null;
          changes: string[];
        }> = [];

        const productClient = (tx as typeof prisma).product ?? prisma.product;

        for (const shipmentData of shipmentsToCreate) {
          const shipmentCode = shipmentData.shipmentCode;

          if (!shipmentCode) {
            continue; // Skip records without shipment code
          }

          // Check if shipment exists (including soft-deleted)
          const existing = await tx.shipment.findFirst({
            where: { shipmentCode },
          });

          if (existing) {
            // Track changes for tracked fields only
            const changeDetails: string[] = [];

            // Shipment Code (shouldn't change, but track just in case)
            const normalizedOldShipment = existing.shipmentCode || '';
            const normalizedNewShipment = shipmentData.shipmentCode || '';
            if (normalizedOldShipment !== normalizedNewShipment) {
              changeDetails.push(
                `shipmentCode: ${existing.shipmentCode || 'empty'} → ${shipmentData.shipmentCode || 'empty'}`
              );
            }

            // CV Number
            const normalizedOldCV = existing.cvNumber || '';
            const normalizedNewCV = shipmentData.cvNumber || '';
            if (normalizedOldCV !== normalizedNewCV) {
              changeDetails.push(
                `cvNumber: ${existing.cvNumber || 'empty'} → ${shipmentData.cvNumber || 'empty'}`
              );
            }

            // No. Of Sacks
            const oldSacks = existing.noOfSacks ?? 0;
            const newSacks = shipmentData.noOfSacks ?? 0;
            if (oldSacks !== newSacks) {
              changeDetails.push(`noOfSacks: ${oldSacks} → ${newSacks}`);
            }

            // Total CBM
            const oldCBM = existing.totalCBM ?? 0;
            const newCBM = shipmentData.totalCBM ?? 0;
            if (oldCBM !== newCBM) {
              changeDetails.push(`totalCBM: ${oldCBM} → ${newCBM}`);
            }

            // Weight
            const oldWeight = existing.weight ?? 0;
            const newWeight = shipmentData.weight ?? 0;
            if (oldWeight !== newWeight) {
              changeDetails.push(`weight: ${oldWeight} → ${newWeight}`);
            }

            // Fee
            const oldFee = existing.fee ?? 0;
            const newFee = shipmentData.fee ?? 0;
            if (oldFee !== newFee) {
              changeDetails.push(`fee: ${oldFee} → ${newFee}`);
            }

            // Shipment Status
            const normalizedOldStatus = existing.shipmentStatus || '';
            const normalizedNewStatus = shipmentData.shipmentStatus || '';
            if (normalizedOldStatus !== normalizedNewStatus) {
              changeDetails.push(
                `shipmentStatus: ${existing.shipmentStatus || 'empty'} → ${shipmentData.shipmentStatus || 'empty'}`
              );
            }

            // Date Created
            const normalizedOldCreated = existing.dateCreated || null;
            const normalizedNewCreated = shipmentData.dateCreated || null;
            if (normalizedOldCreated !== normalizedNewCreated) {
              changeDetails.push(
                `dateCreated: ${existing.dateCreated || 'empty'} → ${shipmentData.dateCreated || 'empty'}`
              );
            }

            // Date Delivered
            const normalizedOldDelivered = existing.dateDelivered || null;
            const normalizedNewDelivered = shipmentData.dateDelivered || null;
            if (normalizedOldDelivered !== normalizedNewDelivered) {
              changeDetails.push(
                `dateDelivered: ${existing.dateDelivered || 'empty'} → ${shipmentData.dateDelivered || 'empty'}`
              );
            }

            // Notes
            const normalizedOldNotes = existing.notes || null;
            const normalizedNewNotes = shipmentData.notes || null;
            if (normalizedOldNotes !== normalizedNewNotes) {
              changeDetails.push(
                `notes: ${existing.notes || 'empty'} → ${shipmentData.notes || 'empty'}`
              );
            }

            // Update existing shipment and restore if soft-deleted
            const wasDeleted = existing.deletedAt !== null;
            await tx.shipment.update({
              where: { id: existing.id },
              data: {
                ...shipmentData,
                deletedAt: null, // Auto-restore if previously soft-deleted
              },
            });

            // Cascade update to products with this shipment code
            await productClient.updateMany({
              where: {
                shipmentCode: shipmentCode,
              },
              data: {
                cvNumber: shipmentData.cvNumber,
                noOfSacks: shipmentData.noOfSacks,
                totalCBM: shipmentData.totalCBM,
                weight: shipmentData.weight,
                shipmentStatus: shipmentData.shipmentStatus,
              },
            });

            // Track changes if any fields actually changed
            if (changeDetails.length > 0) {
              changeTracking.push({
                shipmentId: existing.id,
                shipmentCode: shipmentCode,
                cvNumber: shipmentData.cvNumber,
                changes: changeDetails,
              });
            }

            if (wasDeleted) {
              restored++;
            } else {
              updated++;
            }
          } else {
            // Create new shipment
            const newShipment = await tx.shipment.create({
              data: shipmentData,
            });

            // Cascade create to products with this shipment code
            await productClient.updateMany({
              where: {
                shipmentCode: shipmentCode,
              },
              data: {
                cvNumber: shipmentData.cvNumber,
                noOfSacks: shipmentData.noOfSacks,
                totalCBM: shipmentData.totalCBM,
                weight: shipmentData.weight,
                shipmentStatus: shipmentData.shipmentStatus,
              },
            });

            // Track new shipment creation with initial values
            const changeDetails: string[] = [];
            if (shipmentData.shipmentCode) {
              changeDetails.push(
                `shipmentCode: empty → ${shipmentData.shipmentCode}`
              );
            }
            if (shipmentData.cvNumber) {
              changeDetails.push(`cvNumber: empty → ${shipmentData.cvNumber}`);
            }
            if (shipmentData.noOfSacks) {
              changeDetails.push(`noOfSacks: 0 → ${shipmentData.noOfSacks}`);
            }
            if (shipmentData.totalCBM) {
              changeDetails.push(`totalCBM: 0 → ${shipmentData.totalCBM}`);
            }
            if (shipmentData.weight) {
              changeDetails.push(`weight: 0 → ${shipmentData.weight}`);
            }
            if (shipmentData.fee) {
              changeDetails.push(`fee: 0 → ${shipmentData.fee}`);
            }
            if (shipmentData.shipmentStatus) {
              changeDetails.push(
                `shipmentStatus: empty → ${shipmentData.shipmentStatus}`
              );
            }
            if (shipmentData.dateCreated) {
              changeDetails.push(
                `dateCreated: empty → ${shipmentData.dateCreated}`
              );
            }
            if (shipmentData.dateDelivered) {
              changeDetails.push(
                `dateDelivered: empty → ${shipmentData.dateDelivered}`
              );
            }
            if (shipmentData.notes) {
              changeDetails.push(`notes: empty → ${shipmentData.notes}`);
            }

            if (changeDetails.length > 0) {
              changeTracking.push({
                shipmentId: newShipment.id,
                shipmentCode: shipmentCode,
                cvNumber: shipmentData.cvNumber,
                changes: changeDetails,
              });
            }

            created++;
          }
        }

        return { created, updated, restored, changeTracking };
      });

      logger.info(
        `✅ Imported shipments: ${result.created} created, ${result.updated} updated, ${result.restored} restored`
      );

      // ========================================================================
      // ⚠️ LOG NOTIFICATIONS - One notification per unique shipment with change details
      // ========================================================================
      try {
        // Create notifications for all shipments with changes
        const notificationPromises = result.changeTracking.map(
          async (tracked) => {
            // Build notification message
            // Format: "Updated shipment #123 - ShipmentCode (CVNumber) - Modified: field: old → new"
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
          }
        );

        await Promise.all(notificationPromises);
        logger.info(
          `✅ Created ${notificationPromises.length} shipment notifications`
        );
      } catch (notifError) {
        // Don't fail the request if notification logging fails
        logger.warn('Failed to log shipment notifications:', notifError);
      }

      return NextResponse.json({
        message: 'Shipments imported successfully',
        created: result.created,
        updated: result.updated,
        restored: result.restored,
        total: result.created + result.updated + result.restored,
      });
    } else {
      // Single shipment creation
      const shipmentData = convertShipmentDataToDB(body);
      const createdShipment = await prisma.shipment.create({
        data: shipmentData,
      });

      // Cascade update to products with this shipment code
      if (shipmentData.shipmentCode) {
        await prisma.product.updateMany({
          where: {
            shipmentCode: shipmentData.shipmentCode,
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
          `Cascaded shipment data to products with code: ${shipmentData.shipmentCode}`
        );
      }

      const convertedShipment = convertShipmentDBToData(
        createdShipment as ShipmentDB
      );

      logger.info('✅ Created single shipment');

      return NextResponse.json(convertedShipment, { status: 201 });
    }
  } catch (error) {
    logger.error('Error creating shipment(s):', error);

    // Enhanced error handling
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            error: 'Duplicate shipment',
            details: 'A shipment with this code already exists',
            code: error.code,
          },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to create shipment(s)',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete all shipments (with safety protection)
export async function DELETE(request: NextRequest) {
  try {
    // ========================================================================
    // ⚠️ MASS DELETION PROTECTION
    // ========================================================================
    const { searchParams } = new URL(request.url);
    const confirmParam = searchParams.get('confirm');

    if (confirmParam !== 'DELETE_ALL_SHIPMENTS') {
      return NextResponse.json(
        {
          error: 'Mass deletion protection',
          details:
            'You must provide confirmation query parameter to delete all shipments',
          required: '?confirm=DELETE_ALL_SHIPMENTS',
          example: '/api/shipments?confirm=DELETE_ALL_SHIPMENTS',
          suggestion:
            'This safety measure prevents accidental deletion of all records.',
        },
        { status: 400 } // Bad Request
      );
    }

    logger.warn('⚠️ Mass deletion requested with confirmation');

    // ========================================================================
    // ⚠️ SOFT DELETE - Mark as deleted instead of hard delete
    // ========================================================================

    // Check how many are already soft-deleted for observability
    const alreadyDeleted = await prisma.shipment.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.shipment.updateMany({
      where: { deletedAt: null }, // Only soft-delete active records
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info(
      `✅ Soft deleted ${result.count} shipments (${alreadyDeleted} were already deleted)`
    );

    return NextResponse.json({
      message: `Successfully deleted ${result.count} shipment records`,
      count: result.count,
      note: 'Records are soft-deleted and can be recovered if needed',
    });
  } catch (error) {
    logger.error('Failed to delete shipments:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete shipments',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
