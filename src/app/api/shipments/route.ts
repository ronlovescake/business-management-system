import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/db';
import type { ShipmentData, ShipmentDB } from '../../../types';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';

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
    'Date Created': shipment.dateCreated || '',
    'Date Delivered': shipment.dateDelivered || '',
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
      // ⚠️ BATCH SIZE LIMIT - Maximum 10000 records per import
      // ========================================================================
      if (body.length > 10000) {
        logger.warn(
          `Batch size limit exceeded: ${body.length} records (max 10000)`
        );
        return NextResponse.json(
          {
            error: 'Batch size limit exceeded',
            details: `You are trying to import ${body.length} records. Maximum is 10,000 records per import.`,
            suggestion:
              'Please split your import into smaller batches of 10,000 records or less.',
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
      // ⚠️ ATOMIC BULK IMPORT - Upsert/Restore Pattern
      // ========================================================================
      // Use upsert to maintain stable IDs and restore soft-deleted records
      // ========================================================================
      const result = await prisma.$transaction(async (tx) => {
        let created = 0;
        let updated = 0;
        let restored = 0;

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
            // Update existing shipment and restore if soft-deleted
            const wasDeleted = existing.deletedAt !== null;
            await tx.shipment.update({
              where: { id: existing.id },
              data: {
                ...shipmentData,
                deletedAt: null, // Auto-restore if previously soft-deleted
              },
            });

            if (wasDeleted) {
              restored++;
            } else {
              updated++;
            }
          } else {
            // Create new shipment
            await tx.shipment.create({
              data: shipmentData,
            });
            created++;
          }
        }

        return { created, updated, restored };
      });

      logger.info(
        `✅ Imported shipments: ${result.created} created, ${result.updated} updated, ${result.restored} restored`
      );

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
