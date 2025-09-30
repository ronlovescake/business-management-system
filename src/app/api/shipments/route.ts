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
  return {
    shipmentCode: data['Shipment Code'] || '',
    cvNumber: data['CV Number'] || null,
    noOfSacks: data['No. Of Sacks'] || 0,
    totalCBM: data['Total CBM'] || 0,
    weight: data['Weight'] || 0,
    fee: data['Fee'] || 0,
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
      orderBy: { updatedAt: 'desc' },
    });

    const convertedShipments = shipments.map(convertShipmentDBToData);

    return NextResponse.json(convertedShipments);
  } catch (error) {
    console.error('Error fetching shipments:', error);
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

    // Check if it's a single shipment or bulk import
    if (Array.isArray(body)) {
      // Bulk import - delete all existing and create new ones
      await prisma.shipment.deleteMany({});

      const shipmentsToCreate = body.map(convertShipmentDataToDB);
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
    console.error('Error creating shipment(s):', error);
    return NextResponse.json(
      { error: 'Failed to create shipment(s)' },
      { status: 500 }
    );
  }
}
