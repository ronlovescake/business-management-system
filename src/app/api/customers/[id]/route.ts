import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Customer, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  partialCustomerDataSchema,
  formatValidationErrors,
} from '@/lib/validations/customer.validation';
import { logger } from '@/lib/logger';

// Shape used by the UI grid (reusing from customers route)
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

function mapFromDTO(d: CustomerDTO): Prisma.CustomerUpdateInput {
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

// GET single customer by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = Number.parseInt(params.id);
    if (Number.isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(mapToDTO(customer));
  } catch (err) {
    logger.error('GET /api/customers/[id] error', err);
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

// PUT update single customer by ID
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = Number.parseInt(params.id);
    if (Number.isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate with Zod (partial schema for updates)
    const validation = partialCustomerDataSchema.safeParse(body);
    if (!validation.success) {
      logger.warn(`Customer ${customerId} update validation failed:`, validation.error);
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationErrors(validation.error),
        },
        { status: 400 }
      );
    }

    const updated = await prisma.customer.update({
      where: { id: customerId },
      data: mapFromDTO(validation.data as CustomerDTO),
    });

    return NextResponse.json(mapToDTO(updated));
  } catch (err) {
    logger.error('PUT /api/customers/[id] error', err);
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

// DELETE single customer by ID
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerId = Number.parseInt(params.id);
    if (Number.isNaN(customerId)) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 400 }
      );
    }

    await prisma.customer.delete({
      where: { id: customerId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('DELETE /api/customers/[id] error', err);
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
