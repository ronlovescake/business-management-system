import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Fetch sorting distribution data for a product
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productCode = searchParams.get('productCode');

    console.log('🔍 GET /api/sorting-distribution - Product Code:', productCode);

    if (!productCode) {
      console.log('❌ GET - No product code provided');
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

    console.log('📊 GET - Found rows:', sortingData.length);
    console.log('📊 GET - Selected quantity:', sortingData[0]?.selected_quantity);
    console.log('📊 GET - Sample data:', sortingData.slice(0, 3));

    return NextResponse.json({
      data: sortingData,
      selectedQuantity: sortingData[0]?.selected_quantity || null,
    });
  } catch (error) {
    console.error('❌ GET - Error fetching sorting distribution:', error);
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

    console.log('💾 POST /api/sorting-distribution - Starting save...');
    console.log('💾 POST - Product Code:', productCode);
    console.log('💾 POST - Selected Quantity:', selectedQuantity);
    console.log('💾 POST - Total rows received:', rows?.length || 0);

    if (!productCode) {
      console.log('❌ POST - No product code provided');
      return NextResponse.json(
        { error: 'Product code is required' },
        { status: 400 }
      );
    }

    // First, delete all existing rows for this product
    console.log('🗑️ POST - Deleting existing rows...');
    const deleteResult = await prisma.$executeRaw`
      DELETE FROM sorting_distributions 
      WHERE product_code = ${productCode}
    `;
    console.log('🗑️ POST - Delete result:', deleteResult);

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

    console.log(`💾 POST - Filtered ${rowsToInsert.length} non-empty rows from ${rows?.length || 0} total rows`);
    console.log('💾 POST - Sample filtered rows:', rowsToInsert.slice(0, 3));

    // Insert new data
    if (rowsToInsert.length > 0) {
      console.log('📝 POST - Inserting rows...');
      for (let i = 0; i < rowsToInsert.length; i++) {
        const row = rowsToInsert[i];
        try {
          await prisma.$executeRaw`
            INSERT INTO sorting_distributions 
            (product_code, selected_quantity, row_number, quantity, percentage, group_number, distribution, checked, created_at, updated_at)
            VALUES (${row.productCode}, ${row.selectedQuantity}, ${row.rowNumber}, ${row.quantity}, ${row.percentage}, ${row.groupNumber}, ${row.distribution}, ${row.checked}, NOW(), NOW())
          `;
          if (i < 3) {
            console.log(`📝 POST - Inserted row ${i + 1}:`, row);
          }
        } catch (insertError) {
          console.error(`❌ POST - Error inserting row ${i + 1}:`, insertError);
          throw insertError;
        }
      }
      console.log('✅ POST - All rows inserted successfully');
    } else {
      console.log('📝 POST - No rows to insert (all empty)');
    }

    console.log('✅ POST - Save operation completed successfully');
    return NextResponse.json({
      success: true,
      message: 'Sorting distribution saved successfully',
      rowsSaved: rowsToInsert.length,
    });
  } catch (error) {
    console.error('❌ POST - Error saving sorting distribution:', error);
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
    console.error('Error deleting sorting distribution:', error);
    return NextResponse.json(
      { error: 'Failed to delete sorting distribution data' },
      { status: 500 }
    );
  }
}
