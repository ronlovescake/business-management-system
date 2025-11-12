import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { prisma } from '../../../../lib/db';
import type { ShipmentData, ShipmentDB } from '../../../../types';
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

// GET /api/shipments/[id] - Get specific shipment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid shipment ID' },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id },
    });

    if (!shipment) {
      return NextResponse.json(
        { error: 'Shipment not found' },
        { status: 404 }
      );
    }

    const convertedShipment = convertShipmentDBToData(shipment as ShipmentDB);
    return NextResponse.json(convertedShipment);
  } catch (error) {
    logger.error('Error fetching shipment:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shipment' },
      { status: 500 }
    );
  }
}

// PUT /api/shipments/[id] - Update specific shipment
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid shipment ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const shipmentData = convertShipmentDataToDB(body);

    // Get the current shipment to access the shipmentCode
    const currentShipment = await prisma.shipment.findUnique({
      where: { id },
    });

    if (!currentShipment) {
      return NextResponse.json(
        { error: 'Shipment not found' },
        { status: 404 }
      );
    }

    // Update the shipment
    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: shipmentData,
    });

    // Update all products that belong to this shipment
    // Match products by shipmentCode and update their shipment-related fields
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
    }

    const convertedShipment = convertShipmentDBToData(
      updatedShipment as ShipmentDB
    );
    return NextResponse.json(convertedShipment);
  } catch (error) {
    logger.error('Error updating shipment:', error);
    return NextResponse.json(
      { error: 'Failed to update shipment' },
      { status: 500 }
    );
  }
}

// DELETE /api/shipments/[id] - Delete specific shipment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid shipment ID' },
        { status: 400 }
      );
    }

    await prisma.shipment.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Shipment deleted successfully' });
  } catch (error) {
    logger.error('Error deleting shipment:', error);
    return NextResponse.json(
      { error: 'Failed to delete shipment' },
      { status: 500 }
    );
  }
}
