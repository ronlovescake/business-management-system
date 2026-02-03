/**
 * GM Invoices API Route
 */

import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/core/api/response';

const gmPrisma = prisma as unknown as {
  generalMerchandiseInvoice: typeof prisma.invoice;
};

/**
 * GET /api/general-merchandise/invoices
 *
 * Fetch all invoice records
 */
export async function GET() {
  try {
    const invoices = await gmPrisma.generalMerchandiseInvoice.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return ApiResponseUtil.success(invoices);
  } catch (error) {
    logger.error('Error fetching GM invoices', error);
    return ApiResponseUtil.error('Failed to fetch invoices', 500);
  }
}

/**
 * POST /api/general-merchandise/invoices
 *
 * Replace all invoice records with new data from Google Drive
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { invoices } = body;

    if (!Array.isArray(invoices)) {
      return ApiResponseUtil.error(
        'Invalid request: invoices must be an array',
        400
      );
    }

    await gmPrisma.generalMerchandiseInvoice.updateMany({
      where: { deletedAt: null },
      data: { deletedAt: new Date() },
    });

    const created = await gmPrisma.generalMerchandiseInvoice.createMany({
      data: invoices.map(
        (invoice: {
          id?: string;
          customerName: string;
          actualWeight?: string;
          finalWeight?: string;
          shopeeCheckoutLinks?: string;
          driveFiles?: string;
          message?: string;
          chat?: string;
          tickbox?: boolean;
        }) => ({
          customerName: invoice.customerName,
          actualWeight: invoice.actualWeight || null,
          finalWeight: invoice.finalWeight || null,
          shopeeCheckoutLinks: invoice.shopeeCheckoutLinks || null,
          driveFiles: invoice.driveFiles || null,
          message: invoice.message || null,
          chat: invoice.chat || null,
          tickbox: invoice.tickbox || false,
        })
      ),
    });

    const newInvoices = await gmPrisma.generalMerchandiseInvoice.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    return ApiResponseUtil.success({
      count: created.count,
      data: newInvoices,
    });
  } catch (error) {
    logger.error('Error replacing GM invoices', error);
    return ApiResponseUtil.error('Failed to replace invoices', 500);
  }
}

/**
 * PUT /api/general-merchandise/invoices
 *
 * Update a single invoice record
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return ApiResponseUtil.error('ID is required', 400);
    }

    const updated = await gmPrisma.generalMerchandiseInvoice.update({
      where: { id },
      data: {
        customerName: data.customerName,
        actualWeight: data.actualWeight || null,
        finalWeight: data.finalWeight || null,
        shopeeCheckoutLinks: data.shopeeCheckoutLinks || null,
        driveFiles: data.driveFiles || null,
        message: data.message || null,
        chat: data.chat || null,
        tickbox: data.tickbox ?? false,
      },
    });

    return ApiResponseUtil.success(updated);
  } catch (error) {
    logger.error('Error updating GM invoice', error);
    return ApiResponseUtil.error('Failed to update invoice', 500);
  }
}

/**
 * DELETE /api/general-merchandise/invoices?id=INVOICE_ID
 *
 * Soft delete an invoice record
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return ApiResponseUtil.error('ID is required', 400);
    }

    await gmPrisma.generalMerchandiseInvoice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return ApiResponseUtil.ok();
  } catch (error) {
    logger.error('Error deleting GM invoice', error);
    return ApiResponseUtil.error('Failed to delete invoice', 500);
  }
}
