import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// PUT - Update a single price by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const priceData = await request.json();
    const priceId = parseInt(params.id);

    if (isNaN(priceId)) {
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400 }
      );
    }

    // Convert UI format to database format
    const updatedPrice = await (prisma as any).price.update({
      where: { id: priceId },
      data: {
        productCode: priceData['Product Code'],
        lowerLimit: Math.round((priceData['Lower Limit'] || 0) * 100), // Convert to cents
        upperLimit: Math.round((priceData['Upper Limit'] || 0) * 100),
        currentPrice: Math.round((priceData['Prices'] || 0) * 100),
        priceAdjustment: Math.round((priceData['Price Adjustment'] || 0) * 100),
        updatedAt: new Date(),
      },
    });

    // Convert back to UI format
    const formattedPrice = {
      id: updatedPrice.id,
      'Product Code': updatedPrice.productCode,
      'Lower Limit': Math.round(updatedPrice.lowerLimit / 100),
      'Upper Limit': Math.round(updatedPrice.upperLimit / 100),
      'Prices': Math.round(updatedPrice.currentPrice / 100),
      'Price Adjustment': Math.round(updatedPrice.priceAdjustment / 100),
    };

    return NextResponse.json({
      message: 'Price updated successfully',
      price: formattedPrice
    });

  } catch (error) {
    console.error('Failed to update price:', error);
    return NextResponse.json(
      { error: 'Failed to update price' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a single price by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const priceId = parseInt(params.id);

    if (isNaN(priceId)) {
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400 }
      );
    }

    await (prisma as any).price.delete({
      where: { id: priceId },
    });

    return NextResponse.json({
      message: 'Price deleted successfully'
    });

  } catch (error) {
    console.error('Failed to delete price:', error);
    return NextResponse.json(
      { error: 'Failed to delete price' },
      { status: 500 }
    );
  }
}