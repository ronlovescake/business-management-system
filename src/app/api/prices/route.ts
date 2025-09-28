import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Fetch all prices
export async function GET() {
  try {
    const prices = await (prisma as any).price.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Convert database format to UI format
    const formattedPrices = prices.map((price: any) => ({
      id: price.id,
      'Product Code': price.productCode,
      'Lower Limit': Math.round(price.lowerLimit / 100), // Convert from cents to whole numbers
      'Upper Limit': Math.round(price.upperLimit / 100),
      'Prices': Math.round(price.currentPrice / 100),
      'Price Adjustment': Math.round(price.priceAdjustment / 100),
    }));

    return NextResponse.json(formattedPrices);
  } catch (error) {
    console.error('Failed to fetch prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}

// POST - Create multiple prices (for CSV import)
export async function POST(request: NextRequest) {
  try {
    const pricesData = await request.json();

    if (!Array.isArray(pricesData) || pricesData.length === 0) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected array of price objects.' },
        { status: 400 }
      );
    }

    // Clear existing prices first (optional - remove this if you want to append)
    await (prisma as any).price.deleteMany();

    // Filter out empty rows and invalid data
    const validPricesData = pricesData.filter((priceData: any) => {
      return priceData['Product Code'] && 
             priceData['Product Code'].trim() !== '' &&
             priceData['Lower Limit'] !== undefined &&
             priceData['Upper Limit'] !== undefined &&
             priceData['Prices'] !== undefined;
    });

    console.log(`Filtered ${validPricesData.length} valid records from ${pricesData.length} total records`);

    // Convert UI format to database format and create records
    const createPromises = validPricesData.map((priceData: any) => {
      // Convert whole numbers to cents for database storage
      // Handle cases where Price Adjustment might be empty string or undefined
      const priceAdjustment = priceData['Price Adjustment'];
      const priceAdjustmentValue = (priceAdjustment === '' || priceAdjustment === undefined) 
        ? 0 
        : parseFloat(priceAdjustment.toString().replace(/,/g, '')) || 0;

      return (prisma as any).price.create({
        data: {
          productCode: priceData['Product Code'].trim(),
          lowerLimit: Math.round((parseFloat(priceData['Lower Limit'].toString().replace(/,/g, '')) || 0) * 100), // Convert to cents
          upperLimit: Math.round((parseFloat(priceData['Upper Limit'].toString().replace(/,/g, '')) || 0) * 100),
          currentPrice: Math.round((parseFloat(priceData['Prices'].toString().replace(/,/g, '')) || 0) * 100),
          priceAdjustment: Math.round(priceAdjustmentValue * 100),
          isActive: true,
        },
      });
    });

    const results = await Promise.all(createPromises);

    return NextResponse.json({
      message: `Successfully imported ${results.length} price records`,
      count: results.length,
      filtered: pricesData.length - validPricesData.length
    });

  } catch (error) {
    console.error('Failed to import prices:', error);
    return NextResponse.json(
      { error: 'Failed to import price data to database' },
      { status: 500 }
    );
  }
}

// DELETE - Delete all prices
export async function DELETE() {
  try {
    const result = await (prisma as any).price.deleteMany();
    
    return NextResponse.json({
      message: `Successfully deleted ${result.count} price records`,
      count: result.count
    });
  } catch (error) {
    console.error('Failed to delete prices:', error);
    return NextResponse.json(
      { error: 'Failed to delete prices' },
      { status: 500 }
    );
  }
}