import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface ImportStats {
  totalRows: number;
  customersCreated: number;
  customersUpdated: number;
  additionalInfoCreated: number;
  errors: Array<{ row: number; error: string }>;
}

/**
 * Parse CSV line handling quoted fields with commas
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * POST /api/customers/import
 * Import customers from CSV file (Detailed format with numbered columns)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file content
    const content = await file.text();
    const lines = content.split('\n').filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'CSV file is empty or invalid' },
        { status: 400 }
      );
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]);

    // Validate required columns
    const requiredColumns = [
      'Customer Name',
      'Phone Number',
      'Address',
      'Customer Status',
    ];

    const missingColumns = requiredColumns.filter(
      (col) => !headers.includes(col)
    );

    if (missingColumns.length > 0) {
      return NextResponse.json(
        {
          error: `Missing required columns: ${missingColumns.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const stats: ImportStats = {
      totalRows: lines.length - 1,
      customersCreated: 0,
      customersUpdated: 0,
      additionalInfoCreated: 0,
      errors: [],
    };

    // Process each row
    for (let i = 1; i < lines.length; i++) {
      try {
        const values = parseCSVLine(lines[i]);
        const row: Record<string, string> = {};

        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        const customerName = row['Customer Name'];
        const phoneNumber = row['Phone Number'];
        const address = row['Address'];

        if (!customerName) {
          stats.errors.push({
            row: i,
            error: 'Customer Name is required',
          });
          continue;
        }

        // Check if customer exists by name
        const existingCustomer = await prisma.customer.findFirst({
          where: {
            customerName: customerName,
            deletedAt: null,
          },
        });

        let customerId: number;

        if (existingCustomer) {
          // Update existing customer
          await prisma.customer.update({
            where: { id: existingCustomer.id },
            data: {
              phoneNumber: phoneNumber || existingCustomer.phoneNumber,
              address: address || existingCustomer.address,
              facebook: row['Facebook'] || existingCustomer.facebook,
              emailAddress:
                row['Email Address'] || existingCustomer.emailAddress,
              businessName:
                row['Business Name'] || existingCustomer.businessName,
              taxNumber: row['Tax Number'] || existingCustomer.taxNumber,
              businessAddress:
                row['Business Address'] || existingCustomer.businessAddress,
              businessContactNumber:
                row['Business Contact Number'] ||
                existingCustomer.businessContactNumber,
              customerStatus:
                row['Customer Status'] || existingCustomer.customerStatus,
            },
          });

          customerId = existingCustomer.id;
          stats.customersUpdated++;

          // Delete existing additional info to replace with new data
          await prisma.additionalCustomerInfo.deleteMany({
            where: { customerId: existingCustomer.id },
          });
        } else {
          // Create new customer
          const newCustomer = await prisma.customer.create({
            data: {
              date: row['Date'] || new Date().toISOString().slice(0, 10),
              customerName: customerName,
              phoneNumber: phoneNumber || '',
              address: address || '',
              facebook: row['Facebook'] || '',
              emailAddress: row['Email Address'] || '',
              businessName: row['Business Name'] || '',
              taxNumber: row['Tax Number'] || '',
              businessAddress: row['Business Address'] || '',
              businessContactNumber: row['Business Contact Number'] || '',
              customerStatus: row['Customer Status'] || 'Active',
            },
          });

          customerId = newCustomer.id;
          stats.customersCreated++;
        }

        // Process Shopee Usernames (1-5)
        for (let j = 1; j <= 5; j++) {
          const username = row[`Shopee Username ${j}`];
          if (username) {
            await prisma.additionalCustomerInfo.create({
              data: {
                customerId,
                type: 'shopee_username',
                value: username,
              },
            });
            stats.additionalInfoCreated++;
          }
        }

        // Process Additional Addresses (1-5)
        for (let j = 1; j <= 5; j++) {
          const additionalAddress = row[`Additional Address ${j}`];
          if (additionalAddress) {
            await prisma.additionalCustomerInfo.create({
              data: {
                customerId,
                type: 'address',
                value: additionalAddress,
              },
            });
            stats.additionalInfoCreated++;
          }
        }

        // Process Additional Phone Numbers (1-5)
        for (let j = 1; j <= 5; j++) {
          const additionalPhone = row[`Additional Phone ${j}`];
          if (additionalPhone) {
            await prisma.additionalCustomerInfo.create({
              data: {
                customerId,
                type: 'phone',
                value: additionalPhone,
              },
            });
            stats.additionalInfoCreated++;
          }
        }
      } catch (error) {
        stats.errors.push({
          row: i,
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    }

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to import customers',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
