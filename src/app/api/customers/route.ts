import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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

function mapToDTO(c: any): CustomerDTO {
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

function mapFromDTO(d: CustomerDTO) {
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
  if (!url) return 'DATABASE_URL is not set';
  if (/postgresql:\/\/username:password@/i.test(url)) return 'DATABASE_URL still has placeholder username/password';
  return null;
}

export async function GET() {
  try {
    const db = prisma as any;
    const items = await db.customer.findMany({ orderBy: { id: 'asc' } });
    return NextResponse.json(items.map(mapToDTO));
  } catch (err) {
    console.error('GET /api/customers error', err);
    // Be lenient during initial setup: return empty list so UI can still render
    return NextResponse.json([]);
  }
}

// Upsert-like bulk sync: replace all customer rows with provided list
export async function PUT(req: NextRequest) {
  try {
    const misconfig = dbNotConfigured();
    if (misconfig) {
      return NextResponse.json({ error: `Database not configured: ${misconfig}` }, { status: 503 });
    }
    const body = (await req.json()) as CustomerDTO[];
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Replace all rows for simplicity; could be optimized later
    const db = prisma as any;
    await prisma.$transaction([
      db.customer.deleteMany({}),
      db.customer.createMany({ data: body.map(mapFromDTO) }),
    ]);

    return NextResponse.json({ ok: true, count: body.length });
  } catch (err) {
    console.error('PUT /api/customers error', err);
    const msg = (err as any)?.message?.toString().toLowerCase() ?? '';
    if (msg.includes('authentication failed')) {
      return NextResponse.json({ error: 'Database authentication failed. Check DATABASE_URL credentials.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to save customers' }, { status: 500 });
  }
}

// Create a single customer (used by the modal)
export async function POST(req: NextRequest) {
  try {
    const misconfig = dbNotConfigured();
    if (misconfig) {
      return NextResponse.json({ error: `Database not configured: ${misconfig}` }, { status: 503 });
    }
    const body = (await req.json()) as CustomerDTO;
    const db = prisma as any;
    const created = await db.customer.create({ data: mapFromDTO(body) });
    return NextResponse.json(mapToDTO(created));
  } catch (err) {
    console.error('POST /api/customers error', err);
    const msg = (err as any)?.message?.toString().toLowerCase() ?? '';
    if (msg.includes('authentication failed')) {
      return NextResponse.json({ error: 'Database authentication failed. Check DATABASE_URL credentials.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

// DELETE - Clear all customers
export async function DELETE() {
  try {
    const db = prisma as any;
    const result = await db.customer.deleteMany({});
    
    return NextResponse.json({
      message: `Successfully deleted ${result.count} customer records`,
      count: result.count
    });
  } catch (error) {
    console.error('Failed to delete customers:', error);
    return NextResponse.json(
      { error: 'Failed to delete customers' },
      { status: 500 }
    );
  }
}
