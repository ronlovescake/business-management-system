import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface ShippingFeeRow {
  productCode: string;
  actualQuantity: number | null;
  multiplier: number | null;
  aproxQuantity: number | null;
  percentage: number | null;
  alibabaShippingCost: number | null;
  forwardersFee: number | null;
  lalamove: number | null;
  packaging: number | null;
}

/**
 * GET - Load shipping fee calculator data for a shipment code
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shipmentCode = searchParams.get('shipmentCode');

    if (!shipmentCode) {
      return NextResponse.json(
        { error: 'Shipment code is required' },
        { status: 400 }
      );
    }

    const data = await prisma.shippingFeeCalculator.findMany({
      where: {
        shipmentCode,
        deletedAt: null,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json({ data });
  } catch (error) {
    logger.error('Error loading shipping fee calculator data:', error);
    return NextResponse.json({ error: 'Failed to load data' }, { status: 500 });
  }
}

/**
 * POST - Save/Overwrite shipping fee calculator data for a shipment code
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { shipmentCode, rows, actualInputs } = body;

    if (!shipmentCode || !rows || !actualInputs) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Delete existing data for this shipment code (overwrite)
    await prisma.shippingFeeCalculator.deleteMany({
      where: {
        shipmentCode,
      },
    });

    // Create new records
    const records = rows.map((row: ShippingFeeRow) => ({
      shipmentCode,
      productCode: row.productCode,
      actualQuantity: row.actualQuantity || 0,
      multiplier: row.multiplier || 1,
      aproxQuantity: row.aproxQuantity || 0,
      percentage: row.percentage || 0,
      alibabaShippingCost: row.alibabaShippingCost || 0,
      forwardersFee: row.forwardersFee || 0,
      lalamove: row.lalamove || 0,
      packaging: row.packaging || 0,
      actualAlibabaShipping: actualInputs.actualAlibabaShipping || 0,
      actualForwardersFee: actualInputs.actualForwardersFee || 0,
      actualLalamove: actualInputs.actualLalamove || 0,
    }));

    await prisma.shippingFeeCalculator.createMany({
      data: records,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error saving shipping fee calculator data:', error);
    return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
  }
}
