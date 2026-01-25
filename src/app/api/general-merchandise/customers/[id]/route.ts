import type { NextRequest } from 'next/server';
import type { Customer, Prisma } from '@prisma/client';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { sanitizers } from '@/lib/security/sanitize';
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

const gmPrisma = prisma as unknown as {
  generalMerchandiseCustomer: typeof prisma.customer;
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
    date: sanitizers.date(d.Date ?? ''),
    customerName: sanitizers.name(d['Customer Name'] ?? ''),
    phoneNumber: sanitizers.phone(d['Phone Number'] ?? ''),
    address: sanitizers.address(d.Address ?? ''),
    facebook: sanitizers.name(d.Facebook ?? ''),
    emailAddress: sanitizers.email(d['Email Address'] ?? ''),
    businessName: sanitizers.name(d['Business Name'] ?? ''),
    taxNumber: sanitizers.name(d['Tax Number'] ?? ''),
    businessAddress: sanitizers.address(d['Business Address'] ?? ''),
    businessContactNumber: sanitizers.phone(d['Business Contact Number'] ?? ''),
    customerStatus: sanitizers.name(d['Customer Status'] ?? ''),
  };
}

type RouteContext = { params: { id: string } };

export const GET = withErrorHandler<RouteContext>(
  async (_request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const customer = await gmPrisma.generalMerchandiseCustomer.findUnique({
      where: { id: idResult.id },
    });

    if (!customer) {
      return ApiResponse.notFound('Customer');
    }

    logger.info('GM customer fetched', { id: idResult.id });
    return ApiResponse.success(mapToDTO(customer), 'Customer fetched');
  }
);

export const PUT = withErrorHandler<RouteContext>(
  async (request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const body = await request.json();
    const validation = partialCustomerDataSchema.safeParse(body);
    if (!validation.success) {
      logger.warn(
        `GM customer ${idResult.id} update validation failed`,
        validation.error
      );
      return ApiResponse.badRequest('Validation failed', {
        ...formatValidationErrors(validation.error),
      });
    }

    const existingCustomer =
      await gmPrisma.generalMerchandiseCustomer.findUnique({
        where: { id: idResult.id },
      });

    if (!existingCustomer) {
      return ApiResponse.notFound('Customer');
    }

    const updated = await gmPrisma.generalMerchandiseCustomer.update({
      where: { id: idResult.id },
      data: mapFromDTO(validation.data as CustomerDTO),
    });

    logger.info('GM customer updated', { id: idResult.id });
    return ApiResponse.success(
      mapToDTO(updated),
      'Customer updated successfully'
    );
  }
);

export const DELETE = withErrorHandler<RouteContext>(
  async (_request: NextRequest, context) => {
    const idResult = parseCustomerId(context);
    if ('error' in idResult) {
      return idResult.error;
    }

    const existingCustomer =
      await gmPrisma.generalMerchandiseCustomer.findUnique({
        where: { id: idResult.id },
      });

    if (!existingCustomer) {
      return ApiResponse.notFound('Customer');
    }

    await gmPrisma.generalMerchandiseCustomer.delete({
      where: { id: idResult.id },
    });

    logger.info('GM customer deleted', { id: idResult.id });
    return ApiResponse.success(
      { id: idResult.id },
      'Customer deleted successfully'
    );
  }
);

function parseCustomerId(
  context?: RouteContext
): { id: number } | { error: ReturnType<typeof ApiResponse.badRequest> } {
  const idParam = context?.params?.id ?? '';
  const customerId = Number(idParam);

  if (!idParam || Number.isNaN(customerId)) {
    return {
      error: ApiResponse.badRequest('Invalid customer ID', {
        id: 'Provide a numeric customer ID in the URL path.',
      }),
    };
  }

  return { id: customerId };
}
