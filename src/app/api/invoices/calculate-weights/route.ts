import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { calculateInvoiceWeights } from '../_lib/weightCalculation';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { customerName }: { customerName?: string } = body;

    const { results, invoices, processedInvoiceCount } =
      await calculateInvoiceWeights({
        customerName,
        persistActualWeight: true,
        includeInvoices: true,
      });

    if (processedInvoiceCount === 0) {
      return NextResponse.json(
        {
          error: customerName
            ? `No invoice found for customer: ${customerName}`
            : 'No invoices found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully calculated weights for ${results.length} invoice(s)`,
      results,
      invoices,
    });
  } catch (error) {
    logger.error('Error calculating invoice weights', error);
    return NextResponse.json(
      { error: 'Failed to calculate invoice weights' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const customerName = searchParams.get('customerName');

    if (!customerName) {
      return NextResponse.json(
        { error: 'customerName parameter is required' },
        { status: 400 }
      );
    }

    const { results } = await calculateInvoiceWeights({
      customerName,
      persistActualWeight: false,
      includeInvoices: false,
    });

    const preview = results[0];

    if (!preview) {
      return NextResponse.json({
        customerName,
        actualWeight: '0.00',
        breakdown: [],
        unmatchedProducts: [],
        message: 'No transactions found for this customer',
      });
    }

    return NextResponse.json({
      customerName: preview.customerName,
      actualWeight: preview.actualWeight,
      breakdown: preview.breakdown,
      unmatchedProducts: preview.unmatchedProducts,
    });
  } catch (error) {
    logger.error('Error previewing weight calculation', error);
    return NextResponse.json(
      { error: 'Failed to preview weight calculation' },
      { status: 500 }
    );
  }
}
