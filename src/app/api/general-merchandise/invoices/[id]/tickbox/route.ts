/**
 * GM Invoice Tickbox API Route
 * Updates the tickbox (message sent) status for a GM invoice
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

const gmPrisma = prisma as unknown as {
  generalMerchandiseInvoice: typeof prisma.invoice;
};

/**
 * PUT /api/general-merchandise/invoices/[id]/tickbox
 *
 * Update invoice tickbox status
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { tickbox } = body;

    if (typeof tickbox !== 'boolean') {
      return NextResponse.json(
        { error: 'Tickbox value must be a boolean' },
        { status: 400 }
      );
    }

    const updatedInvoice = await gmPrisma.generalMerchandiseInvoice.update({
      where: { id },
      data: { tickbox },
    });

    return NextResponse.json({
      success: true,
      data: updatedInvoice,
    });
  } catch (error) {
    logger.error('Error updating GM invoice tickbox', error);

    if (
      error instanceof Error &&
      error.message.includes('Record to update not found')
    ) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to update invoice tickbox' },
      { status: 500 }
    );
  }
}
