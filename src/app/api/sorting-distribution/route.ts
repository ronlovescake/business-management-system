import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

const prisma = new PrismaClient();

// GET: Fetch sorting distribution data for a product
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('productCode');

    logger.debug(
      '🔍 GET /api/sorting-distribution - Product Code:',
      productCode
    );

    if (!productCode) {
      logger.debug('❌ GET - No product code provided');
      return NextResponse.json(
        { error: 'Product code is required' },
        { status: 400 }
      );
    }

    // Use raw query until Prisma client recognizes the new model
    const data = await prisma.$queryRaw`
      SELECT * FROM sorting_distributions 
      WHERE product_code = ${productCode}
      ORDER BY row_number ASC
    `;

    interface SortingDistributionRow {
      id: number;
      product_code: string;
      selected_quantity: number | null;
      row_number: number;
      quantity: number;
      percentage: number;
      group_number: string;
      distribution: number;
      checked: boolean;
      created_at: Date;
      updated_at: Date;
    }

    const sortingData = data as SortingDistributionRow[];

    logger.debug('📊 GET - Found rows:', sortingData.length);
    logger.debug(
      '📊 GET - Selected quantity:',
      sortingData[0]?.selected_quantity
    );
    logger.debug('📊 GET - Sample data:', sortingData.slice(0, 3));

    return NextResponse.json({
      data: sortingData,
      selectedQuantity: sortingData[0]?.selected_quantity || null,
    });
  } catch (error) {
    logger.error('❌ GET - Error fetching sorting distribution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sorting distribution data' },
      { status: 500 }
    );
  }
}

// POST: Save or update sorting distribution data
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { productCode, selectedQuantity, rows } = body;

    logger.debug('💾 POST /api/sorting-distribution - Starting save...');
    logger.debug('💾 POST - Product Code:', productCode);
    logger.debug('💾 POST - Selected Quantity:', selectedQuantity);
    logger.debug('💾 POST - Total rows received:', rows?.length || 0);

    if (!productCode) {
      logger.debug('❌ POST - No product code provided');
      return NextResponse.json(
        { error: 'Product code is required' },
        { status: 400 }
      );
    }

    // First, delete all existing rows for this product
    logger.debug('🗑️ POST - Deleting existing rows...');
    const deleteResult = await prisma.$executeRaw`
      DELETE FROM sorting_distributions 
      WHERE product_code = ${productCode}
    `;
    logger.debug('🗑️ POST - Delete result:', deleteResult);

    // Prepare rows data
    interface RowData {
      quantity: number;
      percentage: number;
      groupNumber: string;
      distribution: number;
      checked: boolean;
    }

    const rowsToInsert = (rows as RowData[])
      .map((row, index) => ({
        productCode,
        selectedQuantity,
        rowNumber: index + 1,
        quantity: row.quantity || 0,
        percentage: row.percentage || 0,
        groupNumber: row.groupNumber || '',
        distribution: row.distribution || 0,
        checked: row.checked || false,
      }))
      .filter(
        (row) =>
          row.quantity > 0 ||
          row.percentage > 0 ||
          row.groupNumber ||
          row.distribution > 0 ||
          row.checked
      );

    logger.debug(
      `💾 POST - Filtered ${rowsToInsert.length} non-empty rows from ${rows?.length || 0} total rows`
    );
    logger.debug('💾 POST - Sample filtered rows:', rowsToInsert.slice(0, 3));

    // Insert new data
    if (rowsToInsert.length > 0) {
      logger.debug('📝 POST - Inserting rows...');
      for (let i = 0; i < rowsToInsert.length; i++) {
        const row = rowsToInsert[i];
        try {
          await prisma.$executeRaw`
            INSERT INTO sorting_distributions 
            (product_code, selected_quantity, row_number, quantity, percentage, group_number, distribution, checked, created_at, updated_at)
            VALUES (${row.productCode}, ${row.selectedQuantity}, ${row.rowNumber}, ${row.quantity}, ${row.percentage}, ${row.groupNumber}, ${row.distribution}, ${row.checked}, NOW(), NOW())
          `;
          if (i < 3) {
            logger.debug(`📝 POST - Inserted row ${i + 1}:`, row);
          }
        } catch (insertError) {
          logger.error(`❌ POST - Error inserting row ${i + 1}:`, insertError);
          throw insertError;
        }
      }
      logger.debug('✅ POST - All rows inserted successfully');
    } else {
      logger.debug('📝 POST - No rows to insert (all empty)');
    }

    logger.debug('✅ POST - Save operation completed successfully');
    return NextResponse.json({
      success: true,
      message: 'Sorting distribution saved successfully',
      rowsSaved: rowsToInsert.length,
    });
  } catch (error) {
    logger.error('❌ POST - Error saving sorting distribution:', error);
    return NextResponse.json(
      { error: 'Failed to save sorting distribution data' },
      { status: 500 }
    );
  }
}

// DELETE: Delete sorting distribution data for a product
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('productCode');

    if (!productCode) {
      return NextResponse.json(
        { error: 'Product code is required' },
        { status: 400 }
      );
    }

    await prisma.$executeRaw`
      DELETE FROM sorting_distributions 
      WHERE product_code = ${productCode}
    `;

    return NextResponse.json({
      success: true,
      message: 'Sorting distribution deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting sorting distribution:', error);
    return NextResponse.json(
      { error: 'Failed to delete sorting distribution data' },
      { status: 500 }
    );
  }
}
