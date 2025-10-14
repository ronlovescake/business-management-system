import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { ShipmentData, ShipmentDB } from '../../../types';

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
  // Clean numeric value - remove commas and convert to number
  const cleanNumber = (value: unknown): number => {
    if (value === undefined || value === null || value === '') return 0;
    const str = String(value);
    const cleaned = str.replace(/,/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  // Clean fee value - remove peso symbol and commas, then parse as number
  const cleanFee = (feeValue: unknown): number => {
    if (feeValue === undefined || feeValue === null || feeValue === '')
      return 0;
    const feeStr = String(feeValue);
    // Remove peso symbol, commas, and any other non-numeric characters except decimal point
    const cleaned = feeStr.replace(/[₱,\s]/g, '');
    const parsed = Number.parseFloat(cleaned);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  return {
    shipmentCode: data['Shipment Code'] || '',
    cvNumber: data['CV Number'] || null,
    noOfSacks: Math.round(cleanNumber(data['No. Of Sacks'])), // Must be Int
    totalCBM: cleanNumber(data['Total CBM']),
    weight: cleanNumber(data['Weight']),
    fee: cleanFee(data['Fee']),
    shipmentStatus: data['Shipment Status'] || '',
    dateCreated: data['Date Created'] || null,
    dateDelivered: data['Date Delivered'] || null,
    duration: data['Duration'] || null,
    notes: data['Notes'] || null,
  };
}

// GET /api/shipments - Get all shipments
export async function GET() {
  try {
    const shipments = await prisma.shipment.findMany({
      orderBy: { id: 'asc' },
    });

    const convertedShipments = shipments.map(convertShipmentDBToData);

    return NextResponse.json(convertedShipments);
  } catch (error) {
    logger.error('Error fetching shipments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shipments' },
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

    // Check if it's a single shipment or bulk import
    if (Array.isArray(body)) {
      // Bulk import - delete all existing and create new ones
      await prisma.shipment.deleteMany({});

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

      const createdShipments = await prisma.shipment.createMany({
        data: shipmentsToCreate,
      });

      return NextResponse.json({
        message: 'Shipments imported successfully',
        count: createdShipments.count,
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

      return NextResponse.json(convertedShipment, { status: 201 });
    }
  } catch (error) {
    logger.error('Error creating shipment(s):', error);
    return NextResponse.json(
      { error: 'Failed to create shipment(s)' },
      { status: 500 }
    );
  }
}

// DELETE - Clear all shipments
export async function DELETE() {
  try {
    const result = await prisma.shipment.deleteMany({});

    return NextResponse.json({
      message: `Successfully deleted ${result.count} shipment records`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Failed to delete shipments:', error);
    return NextResponse.json(
      { error: 'Failed to delete shipments' },
      { status: 500 }
    );
  }
}
