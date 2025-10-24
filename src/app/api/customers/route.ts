import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Customer } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  customerDataSchema,
  formatValidationErrors,
} from '@/lib/validations/customer.validation';
import { logger } from '@/lib/logger';

const STATUS_LOOKUP: Record<string, CustomerDTO['Customer Status']> = {
  active: 'Active',
  inactive: 'Inactive',
  prospect: 'Prospect',
  vip: 'VIP',
  banned: 'Banned',
  '🚫 banned': 'Banned',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HOSTNAME_REGEX = /^[a-z0-9.-]+\.[a-z]{2,}$/i;

function normalizeUrl(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  let trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    if (HOSTNAME_REGEX.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    } else {
      logger.warn('Invalid URL supplied for customer, dropping value', {
        url: trimmed,
      });
      return '';
    }
  }

  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return trimmed;
  } catch (error) {
    logger.warn('Failed to parse URL for customer, dropping value', {
      url: trimmed,
      error: error instanceof Error ? error.message : String(error),
    });
    return '';
  }
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (EMAIL_REGEX.test(trimmed)) {
    return trimmed;
  }

  logger.warn('Invalid email supplied for customer, dropping value', {
    email: trimmed,
  });
  return '';
}

function normalizeStatus(value: unknown): CustomerDTO['Customer Status'] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Active';
    }

    const mapped = STATUS_LOOKUP[trimmed.toLowerCase()];
    if (mapped) {
      return mapped;
    }

    logger.warn('Unknown customer status supplied, defaulting to Active', {
      status: value,
    });
    return 'Active';
  }

  return 'Active';
}

function normalizeDate(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return new Date().toISOString().slice(0, 10);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }

  return new Date().toISOString().slice(0, 10);
}

function sanitizeCustomerRecord(entry: unknown): Record<string, unknown> {
  if (typeof entry !== 'object' || entry === null) {
    return {};
  }

  const record = { ...(entry as Record<string, unknown>) };

  record.Date = normalizeDate(record.Date);
  record['Customer Status'] = normalizeStatus(record['Customer Status']);

  if (typeof record['Customer Name'] === 'string') {
    // Remove all control characters, newlines, and extra whitespace
    record['Customer Name'] = record['Customer Name']
      .replace(/[\r\n\t\u0000-\u001F\u007F-\u009F]/g, ' ') // Replace control chars with space
      .replace(/\s+/g, ' ') // Collapse multiple spaces to single space
      .trim();
  }

  if (typeof record['Phone Number'] === 'string') {
    record['Phone Number'] = record['Phone Number']
      .replace(/[\r\n\t\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (typeof record.Address === 'string') {
    record.Address = record.Address.replace(
      /[\r\n\t\u0000-\u001F\u007F-\u009F]/g,
      ' '
    )
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (typeof record['Business Name'] === 'string') {
    record['Business Name'] = record['Business Name']
      .replace(/[\r\n\t\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (typeof record['Business Address'] === 'string') {
    record['Business Address'] = record['Business Address']
      .replace(/[\r\n\t\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (typeof record['Business Contact Number'] === 'string') {
    record['Business Contact Number'] = record['Business Contact Number']
      .replace(/[\r\n\t\u0000-\u001F\u007F-\u009F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  record['Email Address'] = normalizeEmail(record['Email Address']);
  record.Facebook = normalizeUrl(record.Facebook);

  return record;
}

// Shape used by the UI grid
export type CustomerDTO = {
  id?: number;
  Date: string;
  'Customer Name': string;
  'Phone Number': string;
  Address: string;
  Facebook: string;
  'Email Address': string;
  'Business Name': string;
  'Tax Number': string;
  'Business Address': string;
  'Business Contact Number': string;
  'Customer Status': string;
};

function mapToDTO(c: Customer): CustomerDTO {
  return {
    id: c.id,
    Date: c.date ?? '',
    'Customer Name': c.customerName ?? '',
    'Phone Number': c.phoneNumber ?? '',
    Address: c.address ?? '',
    Facebook: c.facebook ?? '',
    'Email Address': c.emailAddress ?? '',
    'Business Name': c.businessName ?? '',
    'Tax Number': c.taxNumber ?? '',
    'Business Address': c.businessAddress ?? '',
    'Business Contact Number': c.businessContactNumber ?? '',
    'Customer Status': c.customerStatus ?? '',
  };
}

function mapFromDTO(d: CustomerDTO): Prisma.CustomerCreateInput {
  return {
    date: d.Date ?? '',
    customerName: d['Customer Name'] ?? '',
    phoneNumber: d['Phone Number'] ?? '',
    address: d.Address ?? '',
    facebook: d.Facebook ?? '',
    emailAddress: d['Email Address'] ?? '',
    businessName: d['Business Name'] ?? '',
    taxNumber: d['Tax Number'] ?? '',
    businessAddress: d['Business Address'] ?? '',
    businessContactNumber: d['Business Contact Number'] ?? '',
    customerStatus: d['Customer Status'] ?? '',
  };
}

function dbNotConfigured(): string | null {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    return 'DATABASE_URL is not set';
  }
  if (/postgresql:\/\/username:password@/i.test(url)) {
    return 'DATABASE_URL still has placeholder username/password';
  }
  return null;
}

// GET - Fetch all customers (excluding soft-deleted)
export async function GET() {
  try {
    // ========================================================================
    // ⚠️ SOFT DELETE FILTER
    // ========================================================================
    // Exclude soft-deleted records by filtering where deletedAt is null
    // ========================================================================
    const items = await prisma.customer.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: { id: 'asc' },
    });
    logger.info(`Successfully fetched ${items.length} customers from database`);
    return NextResponse.json(items.map(mapToDTO));
  } catch (err) {
    logger.error('GET /api/customers error', err);
    // Return error with status code instead of empty array to help debugging
    return NextResponse.json(
      {
        error: 'Failed to fetch customers',
        details: err instanceof Error ? err.message : 'Unknown error',
        note: 'Check server logs for more details',
      },
      { status: 500 }
    );
  }
}

// Upsert-like bulk sync: replace all customer rows with provided list
export async function PUT(req: NextRequest) {
  try {
    const misconfig = dbNotConfigured();
    if (misconfig) {
      return NextResponse.json(
        { error: `Database not configured: ${misconfig}` },
        { status: 503 }
      );
    }
    const body = await req.json();

    // ========================================================================
    // ⚠️ DATA VALIDATION - Array Format
    // ========================================================================
    if (!Array.isArray(body)) {
      return NextResponse.json(
        {
          error: 'Invalid data format',
          details: 'Expected an array of customers',
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // ⚠️ BATCH SIZE LIMIT - Maximum 10000 records per update
    // ========================================================================
    if (body.length > 10000) {
      logger.warn(
        `Batch size limit exceeded: ${body.length} records (max 10000)`
      );
      return NextResponse.json(
        {
          error: 'Batch size limit exceeded',
          details: `You are trying to update ${body.length} records. Maximum is 10,000 records per update.`,
          suggestion:
            'Please split your update into smaller batches of 10,000 records or less.',
        },
        { status: 413 } // Payload Too Large
      );
    }

    const normalizedPayload = body.map((entry) =>
      sanitizeCustomerRecord(entry)
    );

    const validCustomers: CustomerDTO[] = [];
    const invalidCustomers: Array<{
      index: number;
      issues: Record<string, string>;
    }> = [];

    normalizedPayload.forEach((record, index) => {
      const result = customerDataSchema.safeParse(record);
      if (result.success) {
        validCustomers.push(result.data as CustomerDTO);
      } else {
        const issues = formatValidationErrors(result.error);
        invalidCustomers.push({
          index,
          issues,
        });

        // Detailed console logging for skipped customers
        logger.warn(`❌ Customer #${index + 1} SKIPPED - Validation failed:`, {
          customerName: record['Customer Name'] || '(no name)',
          row: index + 1,
          issues: issues,
          rawData: record,
        });
      }
    });

    // Log summary of validation
    logger.info('📊 Customer Import Validation Summary:', {
      total: normalizedPayload.length,
      valid: validCustomers.length,
      skipped: invalidCustomers.length,
      successRate: `${((validCustomers.length / normalizedPayload.length) * 100).toFixed(1)}%`,
    });

    // If there are skipped customers, log them in detail
    if (invalidCustomers.length > 0) {
      logger.warn(
        `⚠️  ${invalidCustomers.length} customers will be SKIPPED due to validation errors`
      );
      invalidCustomers.forEach(({ index, issues }) => {
        const customer = normalizedPayload[index];
        logger.warn(
          `  → Row ${index + 1}: ${customer['Customer Name'] || '(no name)'} - Issues:`,
          issues
        );
      });
    }

    if (validCustomers.length === 0) {
      logger.error('❌ Bulk customer validation rejected ALL rows', {
        total: normalizedPayload.length,
        invalidCount: invalidCustomers.length,
      });
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: invalidCustomers,
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // ⚠️ ATOMIC BULK UPDATES - Using prisma.$transaction
    // ========================================================================
    // All updates succeed or all fail together
    // Increased timeout for large imports (30 seconds)
    // ========================================================================
    logger.info('🔄 Starting database transaction for customer import...');

    const { created, updated } = await prisma.$transaction(
      async (tx) => {
        let createdCount = 0;
        let updatedCount = 0;

        for (const customer of validCustomers) {
          const createData = mapFromDTO(customer);
          const updateData: Prisma.CustomerUpdateInput = {
            ...createData,
            deletedAt: null, // Auto-restore if previously soft-deleted
          };

          if (customer.id) {
            await tx.customer.upsert({
              where: { id: customer.id },
              create: createData,
              update: updateData,
            });
            updatedCount++;
            continue;
          }

          // Check for existing customer (including soft-deleted ones)
          const existing = await tx.customer.findFirst({
            where: { customerName: createData.customerName },
          });

          if (existing) {
            await tx.customer.update({
              where: { id: existing.id },
              data: updateData, // Will restore if deletedAt was set
            });
            updatedCount++;
          } else {
            await tx.customer.create({ data: createData });
            createdCount++;
          }
        }

        return { created: createdCount, updated: updatedCount };
      },
      {
        maxWait: 30000, // Maximum time to wait to acquire a transaction (30s)
        timeout: 30000, // Maximum transaction execution time (30s)
      }
    );

    logger.info('✅ Atomically processed customers:', {
      created,
      updated,
      total: created + updated,
      skipped: invalidCustomers.length,
    });

    // Prepare detailed error information for response
    const skippedDetails = invalidCustomers.map(({ index, issues }) => ({
      row: index + 1,
      customerName: normalizedPayload[index]['Customer Name'] || '(no name)',
      issues,
    }));

    return NextResponse.json({
      ok: true,
      created,
      updated,
      skipped: invalidCustomers.length,
      errors: invalidCustomers,
      skippedDetails, // Include detailed information about skipped customers
    });
  } catch (err) {
    logger.error('PUT /api/customers error', err);

    // Enhanced error handling with specific error types
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      // P2025 = Record to update not found
      if (err.code === 'P2025') {
        return NextResponse.json(
          {
            error: 'Customer not found',
            details: 'One or more customers do not exist',
            code: err.code,
          },
          { status: 404 }
        );
      }
      // P2002 = Unique constraint failed
      if (err.code === 'P2002') {
        return NextResponse.json(
          {
            error: 'Duplicate customer',
            details: 'A customer with this information already exists',
            code: err.code,
          },
          { status: 409 }
        );
      }
    }

    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('authentication failed')) {
      return NextResponse.json(
        {
          error:
            'Database authentication failed. Check DATABASE_URL credentials.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      {
        error: 'Failed to save customers',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

// Create a single customer (used by the modal)
export async function POST(req: NextRequest) {
  try {
    const misconfig = dbNotConfigured();
    if (misconfig) {
      return NextResponse.json(
        { error: `Database not configured: ${misconfig}` },
        { status: 503 }
      );
    }

    const body = await req.json();

    // Validate with Zod
    const validation = customerDataSchema.safeParse(body);
    if (!validation.success) {
      logger.warn('Customer validation failed:', validation.error);
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationErrors(validation.error),
        },
        { status: 400 }
      );
    }

    const created = await prisma.customer.create({
      data: mapFromDTO(validation.data as CustomerDTO),
    });
    return NextResponse.json(mapToDTO(created));
  } catch (err) {
    logger.error('POST /api/customers error', err);
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('authentication failed')) {
      return NextResponse.json(
        {
          error:
            'Database authentication failed. Check DATABASE_URL credentials.',
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}

// DELETE - Delete all customers (with safety protection)
export async function DELETE(request: NextRequest) {
  try {
    // ========================================================================
    // ⚠️ MASS DELETION PROTECTION
    // ========================================================================
    // Require explicit confirmation query parameter to prevent accidental
    // deletion of all records
    // ========================================================================
    const { searchParams } = new URL(request.url);
    const confirmParam = searchParams.get('confirm');

    if (confirmParam !== 'DELETE_ALL_CUSTOMERS') {
      return NextResponse.json(
        {
          error: 'Mass deletion protection',
          details:
            'You must provide confirmation query parameter to delete all customers',
          required: '?confirm=DELETE_ALL_CUSTOMERS',
          example: '/api/customers?confirm=DELETE_ALL_CUSTOMERS',
          suggestion:
            'This safety measure prevents accidental deletion of all records.',
        },
        { status: 400 } // Bad Request
      );
    }

    logger.warn('⚠️ Mass deletion requested with confirmation');

    // ========================================================================
    // ⚠️ SOFT DELETE - Mark as deleted instead of hard delete
    // ========================================================================
    // Use soft delete pattern: set deletedAt timestamp instead of removing
    // records. This allows data recovery and maintains audit trails.
    // ========================================================================

    // Check how many are already soft-deleted for observability
    const alreadyDeleted = await prisma.customer.count({
      where: { deletedAt: { not: null } },
    });

    const result = await prisma.customer.updateMany({
      where: { deletedAt: null }, // Only soft-delete active records
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info(
      `✅ Soft deleted ${result.count} customers (${alreadyDeleted} were already deleted)`
    );

    return NextResponse.json({
      message: `Successfully deleted ${result.count} customer records`,
      count: result.count,
      note: 'Records are soft-deleted and can be recovered if needed',
    });
  } catch (error) {
    logger.error('Failed to delete customers:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete customers',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
