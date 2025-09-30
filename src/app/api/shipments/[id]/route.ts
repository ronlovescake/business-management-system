import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { ShipmentData, ShipmentDB } from '../../../../types';

// Helper function to convert database model to frontend interface
function convertShipmentDBToData(shipment: ShipmentDB): ShipmentData {
  return {
    id: shipment.id,
    'Shipment Code': shipment.shipmentCode,
    'CV Number': shipment.cvNumber || '',
    'No. Of Sacks': shipment.noOfSacks,
    'Total CBM': shipment.totalCBM,
    'Weight': shipment.weight,
    'Fee': shipment.fee,
    'Shipment Status': shipment.shipmentStatus,
    'Date Created': shipment.dateCreated || '',
    'Date Delivered': shipment.dateDelivered || '',
    'Duration': shipment.duration || '',
    'Notes': shipment.notes || '',
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
    console.error('Error fetching shipment:', error);
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

    const updatedShipment = await prisma.shipment.update({
      where: { id },
      data: shipmentData,
    });

    const convertedShipment = convertShipmentDBToData(updatedShipment as ShipmentDB);
    return NextResponse.json(convertedShipment);
  } catch (error) {
    console.error('Error updating shipment:', error);
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
    console.error('Error deleting shipment:', error);
    return NextResponse.json(
      { error: 'Failed to delete shipment' },
      { status: 500 }
    );
  }
}