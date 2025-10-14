import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Price, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type PriceDTO = {
  id?: number;
  'Product Code': string;
  'Lower Limit': number;
  'Upper Limit': number;
  Prices: number;
  'Price Adjustment': number;
};

type PriceImportRow = {
  id?: number;
  'Product Code': string;
  'Lower Limit': number | string;
  'Upper Limit': number | string;
  Prices: number | string;
  'Price Adjustment'?: number | string;
};

function mapToDTO(price: Price): PriceDTO {
  return {
    id: price.id,
    'Product Code': price.productCode,
    'Lower Limit': Math.round(price.lowerLimit / 100),
    'Upper Limit': Math.round(price.upperLimit / 100),
    Prices: Math.round(price.currentPrice / 100),
    'Price Adjustment': Math.round(price.priceAdjustment / 100),
  };
}

function parseNumericField(value: number | string | undefined): number {
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  const cleaned = value.toString().replace(/,/g, '').trim();
  if (cleaned.length === 0) {
    return 0;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function mapFromDTO(dto: PriceImportRow): Prisma.PriceCreateManyInput {
  const adjustment = parseNumericField(dto['Price Adjustment']);
  return {
    productCode: dto['Product Code'].trim(),
    lowerLimit: Math.round(parseNumericField(dto['Lower Limit']) * 100),
    upperLimit: Math.round(parseNumericField(dto['Upper Limit']) * 100),
    currentPrice: Math.round(parseNumericField(dto['Prices']) * 100),
    priceAdjustment: Math.round(adjustment * 100),
    isActive: true,
  };
}

// GET - Fetch all prices
export async function GET() {
  try {
    const prices = await prisma.price.findMany({
      orderBy: { id: 'asc' },
    });

    // Convert database format to UI format
    const formattedPrices = prices.map(mapToDTO);

    return NextResponse.json(formattedPrices);
  } catch (error) {
    logger.error('Failed to fetch prices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prices' },
      { status: 500 }
    );
  }
}

// POST - Create multiple prices (for CSV import)
export async function POST(request: NextRequest) {
  try {
    const rawData = await request.json();

    if (!Array.isArray(rawData) || rawData.length === 0) {
      return NextResponse.json(
        { error: 'Invalid data format. Expected array of price objects.' },
        { status: 400 }
      );
    }

    const pricesData = rawData as PriceImportRow[];

    await prisma.price.deleteMany();

    // Filter out empty rows and invalid data
    const validPricesData = pricesData.filter((priceData) => {
      const code = priceData['Product Code'];
      const lower = priceData['Lower Limit'];
      const upper = priceData['Upper Limit'];
      const price = priceData['Prices'];

      return (
        typeof code === 'string' &&
        code.trim() !== '' &&
        lower !== undefined &&
        upper !== undefined &&
        price !== undefined
      );
    });

    logger.debug(
      `Filtered ${validPricesData.length} valid records from ${pricesData.length} total records`
    );

    // Convert UI format to database format and create records sequentially
    // Use createMany for bulk insert which preserves order
    const dataToInsert = validPricesData.map(mapFromDTO);

    // Use createMany to insert all records in one transaction, preserving order
    const result = await prisma.price.createMany({
      data: dataToInsert,
    });

    return NextResponse.json({
      message: `Successfully imported ${result.count} price records`,
      count: result.count,
      filtered: pricesData.length - validPricesData.length,
    });
  } catch (error) {
    logger.error('Failed to import prices:', error);
    return NextResponse.json(
      { error: 'Failed to import price data to database' },
      { status: 500 }
    );
  }
}

// DELETE - Delete all prices
export async function DELETE() {
  try {
    const result = await prisma.price.deleteMany();

    return NextResponse.json({
      message: `Successfully deleted ${result.count} price records`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Failed to delete prices:', error);
    return NextResponse.json(
      { error: 'Failed to delete prices' },
      { status: 500 }
    );
  }
}
