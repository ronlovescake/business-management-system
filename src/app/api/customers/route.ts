import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Customer, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  customerDataSchema,
  bulkCustomerSchema,
  formatValidationErrors,
} from '@/lib/validations/customer.validation';
import { logger } from '@/lib/logger';

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
    return NextResponse.json(items.map(mapToDTO));
  } catch (err) {
    logger.error('GET /api/customers error', err);
    // Be lenient during initial setup: return empty list so UI can still render
    return NextResponse.json([]);
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
      return NextResponse.json({ error: 'Invalid payload: Expected an array' }, { status: 400 });
    }

    // Validate with Zod
    const validation = bulkCustomerSchema.safeParse(body);
    if (!validation.success) {
      logger.warn('Bulk customer validation failed:', validation.error);
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationErrors(validation.error),
        },
        { status: 400 }
      );
    }

    // Replace all rows for simplicity; could be optimized later
    await prisma.$transaction([
      prisma.customer.deleteMany({}),
      prisma.customer.createMany({ data: validation.data.map(mapFromDTO) as Prisma.CustomerCreateManyInput[] }),
    ]);

    return NextResponse.json({ ok: true, count: validation.data.length });
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
    
    const created = await prisma.customer.create({ data: mapFromDTO(validation.data as CustomerDTO) });
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
