import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Customer, Prisma } from '@prisma/client';
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
    record['Customer Name'] = record['Customer Name'].trim();
  }

  if (typeof record['Phone Number'] === 'string') {
    record['Phone Number'] = record['Phone Number'].trim();
  }

  if (typeof record.Address === 'string') {
    record.Address = record.Address.trim();
  }

  if (typeof record['Business Name'] === 'string') {
    record['Business Name'] = record['Business Name'].trim();
  }

  if (typeof record['Business Address'] === 'string') {
    record['Business Address'] = record['Business Address'].trim();
  }

  if (typeof record['Business Contact Number'] === 'string') {
    record['Business Contact Number'] =
      record['Business Contact Number'].trim();
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

export async function GET() {
  try {
    const items = await prisma.customer.findMany({ orderBy: { id: 'asc' } });
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
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Invalid payload: Expected an array' },
        { status: 400 }
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
        invalidCustomers.push({
          index,
          issues: formatValidationErrors(result.error),
        });
      }
    });

    if (validCustomers.length === 0) {
      logger.warn('Bulk customer validation rejected all rows', {
        total: normalizedPayload.length,
      });
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: invalidCustomers,
        },
        { status: 400 }
      );
    }

    const { created, updated } = await prisma.$transaction(async (tx) => {
      let createdCount = 0;
      let updatedCount = 0;

      for (const customer of validCustomers) {
        const createData = mapFromDTO(customer);
        const updateData: Prisma.CustomerUpdateInput = { ...createData };

        if (customer.id) {
          await tx.customer.upsert({
            where: { id: customer.id },
            create: createData,
            update: updateData,
          });
          updatedCount++;
          continue;
        }

        const existing = await tx.customer.findFirst({
          where: { customerName: createData.customerName },
        });

        if (existing) {
          await tx.customer.update({
            where: { id: existing.id },
            data: updateData,
          });
          updatedCount++;
        } else {
          await tx.customer.create({ data: createData });
          createdCount++;
        }
      }

      return { created: createdCount, updated: updatedCount };
    });

    return NextResponse.json({
      ok: true,
      created,
      updated,
      skipped: invalidCustomers.length,
      errors: invalidCustomers,
    });
  } catch (err) {
    logger.error('PUT /api/customers error', err);
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
      { error: 'Failed to save customers' },
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

// DELETE - Clear all customers
export async function DELETE() {
  try {
    const result = await prisma.customer.deleteMany({});

    return NextResponse.json({
      message: `Successfully deleted ${result.count} customer records`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Failed to delete customers:', error);
    return NextResponse.json(
      { error: 'Failed to delete customers' },
      { status: 500 }
    );
  }
}
