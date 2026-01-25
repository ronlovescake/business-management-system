import type { NextRequest } from 'next/server';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

type CsvRow = Record<string, string>;

interface ImportStats {
  totalRows: number;
  customersCreated: number;
  customersUpdated: number;
  additionalInfoCreated: number;
  errors: Array<{ row: number; error: string }>;
}

const REQUIRED_COLUMNS = [
  'Customer Name',
  'Phone Number',
  'Address',
  'Customer Status',
] as const;

const MAX_ADDITIONAL_COLUMNS = 5;

const ADDITIONAL_INFO_FIELDS = [
  { prefix: 'Shopee Username', type: 'shopee_username' },
  { prefix: 'Additional Address', type: 'address' },
  { prefix: 'Additional Phone', type: 'phone' },
] as const;

const gmPrisma = prisma as unknown as {
  generalMerchandiseCustomer: typeof prisma.customer;
  generalMerchandiseAdditionalCustomerInfo: typeof prisma.additionalCustomerInfo;
};

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

export const POST = withErrorHandler(async (request: NextRequest) => {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!isFileLike(file)) {
    return ApiResponse.badRequest('No file provided');
  }

  const content = await file.text();
  const lines = content.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    return ApiResponse.badRequest('CSV file is empty or invalid');
  }

  const headers = parseCSVLine(lines[0]);
  const missingColumns = REQUIRED_COLUMNS.filter(
    (column) => !headers.includes(column)
  );

  if (missingColumns.length > 0) {
    return ApiResponse.badRequest(
      `Missing required columns: ${missingColumns.join(', ')}`
    );
  }

  const stats: ImportStats = {
    totalRows: lines.length - 1,
    customersCreated: 0,
    customersUpdated: 0,
    additionalInfoCreated: 0,
    errors: [],
  };

  for (let rowIndex = 1; rowIndex < lines.length; rowIndex++) {
    try {
      const values = parseCSVLine(lines[rowIndex]);
      const row = buildRow(headers, values);

      await processRow(row, stats);
    } catch (error) {
      stats.errors.push({
        row: rowIndex,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  }

  logger.info('GM customers import completed', {
    totalRows: stats.totalRows,
    customersCreated: stats.customersCreated,
    customersUpdated: stats.customersUpdated,
    additionalInfoCreated: stats.additionalInfoCreated,
    errors: stats.errors.length,
  });

  return ApiResponse.success({ stats }, 'Customers imported successfully');
});

function isFileLike(value: unknown): value is Blob {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { text?: unknown }).text === 'function'
  );
}

function buildRow(headers: string[], values: string[]): CsvRow {
  return headers.reduce<CsvRow>((row, header, index) => {
    row[header] = values[index]?.trim() ?? '';
    return row;
  }, {} as CsvRow);
}

async function processRow(row: CsvRow, stats: ImportStats): Promise<void> {
  const customerName = row['Customer Name'];

  if (!customerName) {
    throw new Error('Customer Name is required');
  }

  const { customerId, wasUpdate } = await upsertCustomer(row);
  stats.customersCreated += wasUpdate ? 0 : 1;
  stats.customersUpdated += wasUpdate ? 1 : 0;

  const additionalInfoCount = await createAdditionalInfoRecords(
    customerId,
    row
  );
  stats.additionalInfoCreated += additionalInfoCount;
}

async function upsertCustomer(
  row: CsvRow
): Promise<{ customerId: number; wasUpdate: boolean }> {
  const existingCustomer = await gmPrisma.generalMerchandiseCustomer.findFirst({
    where: {
      customerName: row['Customer Name'],
      deletedAt: null,
    },
  });

  if (existingCustomer) {
    await gmPrisma.generalMerchandiseCustomer.update({
      where: { id: existingCustomer.id },
      data: {
        phoneNumber: row['Phone Number'] || existingCustomer.phoneNumber,
        address: row['Address'] || existingCustomer.address,
        facebook: row['Facebook'] || existingCustomer.facebook,
        emailAddress: row['Email Address'] || existingCustomer.emailAddress,
        businessName: row['Business Name'] || existingCustomer.businessName,
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

    await gmPrisma.generalMerchandiseAdditionalCustomerInfo.deleteMany({
      where: { customerId: existingCustomer.id },
    });

    return { customerId: existingCustomer.id, wasUpdate: true };
  }

  const newCustomer = await gmPrisma.generalMerchandiseCustomer.create({
    data: {
      date: row['Date'] || new Date().toISOString().slice(0, 10),
      customerName: row['Customer Name'],
      phoneNumber: row['Phone Number'] || '',
      address: row['Address'] || '',
      facebook: row['Facebook'] || '',
      emailAddress: row['Email Address'] || '',
      businessName: row['Business Name'] || '',
      taxNumber: row['Tax Number'] || '',
      businessAddress: row['Business Address'] || '',
      businessContactNumber: row['Business Contact Number'] || '',
      customerStatus: row['Customer Status'] || 'Active',
    },
  });

  return { customerId: newCustomer.id, wasUpdate: false };
}

async function createAdditionalInfoRecords(
  customerId: number,
  row: CsvRow
): Promise<number> {
  let count = 0;

  for (const { prefix, type } of ADDITIONAL_INFO_FIELDS) {
    for (let i = 1; i <= MAX_ADDITIONAL_COLUMNS; i++) {
      const key = `${prefix} ${i}`;
      const value = row[key];

      if (value) {
        await gmPrisma.generalMerchandiseAdditionalCustomerInfo.create({
          data: {
            customerId,
            type,
            value: value.trim(),
          },
        });
        count++;
      }
    }
  }

  return count;
}
