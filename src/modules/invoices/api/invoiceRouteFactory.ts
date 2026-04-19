import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/core/api/response';

/**
 * Structural minimum the invoice delegate must satisfy. We accept any
 * concrete Prisma delegate (clothing `prisma.invoice`, GM
 * `prisma.generalMerchandiseInvoice`, etc.) because their actual generated
 * `*Args` types use Prisma's `SelectSubset` generic and cannot be expressed
 * as a single non-generic interface. Callers consume the factory through a
 * generic `T` so the body is checked against the *concrete* delegate's
 * signatures rather than this loose minimum.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MinimalInvoiceDelegate {
  findMany: (...args: any[]) => Promise<unknown[]>;
  createMany: (...args: any[]) => Promise<{ count: number }>;
  update: (...args: any[]) => Promise<unknown>;
  updateMany: (...args: any[]) => Promise<unknown>;
}

/**
 * Backwards-compatible alias. Prefer `MinimalInvoiceDelegate` in new code.
 * @deprecated kept so external imports continue to compile.
 */
export type InvoiceModelDelegate = MinimalInvoiceDelegate;

export interface InvoiceRouteConfig<T extends MinimalInvoiceDelegate> {
  invoiceModel: T;
  domainLabel?: string;
}

export function createInvoiceRoutes<T extends MinimalInvoiceDelegate>(
  config: InvoiceRouteConfig<T>
) {
  const { invoiceModel, domainLabel } = config;
  const label = domainLabel ? `${domainLabel} ` : '';

  async function GET() {
    try {
      const invoices = await invoiceModel.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      return ApiResponseUtil.success(invoices);
    } catch (error) {
      logger.error(`Error fetching ${label}invoices`, error);
      return ApiResponseUtil.error('Failed to fetch invoices', 500);
    }
  }

  async function POST(request: NextRequest) {
    try {
      const body = await request.json();
      const { invoices } = body;

      if (!Array.isArray(invoices)) {
        return ApiResponseUtil.error(
          'Invalid request: invoices must be an array',
          400
        );
      }

      await invoiceModel.updateMany({
        where: { deletedAt: null },
        data: { deletedAt: new Date() },
      });

      const created = await invoiceModel.createMany({
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

      const newInvoices = await invoiceModel.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      return ApiResponseUtil.success({
        count: created.count,
        data: newInvoices,
      });
    } catch (error) {
      logger.error(`Error replacing ${label}invoices`, error);
      return ApiResponseUtil.error('Failed to replace invoices', 500);
    }
  }

  async function PUT(request: NextRequest) {
    try {
      const body = await request.json();
      const { id, ...data } = body;

      if (!id) {
        return ApiResponseUtil.error('ID is required', 400);
      }

      const updated = await invoiceModel.update({
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
      logger.error(`Error updating ${label}invoice`, error);
      return ApiResponseUtil.error('Failed to update invoice', 500);
    }
  }

  async function DELETE(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return ApiResponseUtil.error('ID is required', 400);
      }

      await invoiceModel.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      return ApiResponseUtil.ok();
    } catch (error) {
      logger.error(`Error deleting ${label}invoice`, error);
      return ApiResponseUtil.error('Failed to delete invoice', 500);
    }
  }

  return { GET, POST, PUT, DELETE };
}

/**
 * Factory for the [id]/tickbox route.
 */
export interface TickboxModelDelegate {
  update: (args: {
    where: { id: string };
    data: { tickbox: boolean };
  }) => Promise<unknown>;
}

export function createTickboxRoute(
  invoiceModel: TickboxModelDelegate,
  domainLabel?: string
) {
  const label = domainLabel ? `${domainLabel} ` : '';

  async function PUT(
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

      const updatedInvoice = await invoiceModel.update({
        where: { id },
        data: { tickbox },
      });

      return NextResponse.json({
        success: true,
        data: updatedInvoice,
      });
    } catch (error) {
      logger.error(`Error updating ${label}invoice tickbox`, error);

      if (
        error instanceof Error &&
        error.message.includes('Record to update not found')
      ) {
        return NextResponse.json(
          { error: 'Invoice not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to update invoice tickbox' },
        { status: 500 }
      );
    }
  }

  return { PUT };
}

/**
 * Factory for the calculate-weights route.
 * Accepts the domain's calculateInvoiceWeights function.
 */
export interface WeightCalculationFn {
  (options: {
    customerName?: string;
    persistActualWeight: boolean;
    includeInvoices: boolean;
  }): Promise<{
    results: Array<{
      customerName?: string;
      actualWeight?: string;
      breakdown?: Array<{
        productCode?: string;
        quantity?: number;
        weightPerPiece?: number;
        totalWeight?: number;
        orderStatus?: string;
      }>;
      unmatchedProducts: Array<unknown>;
    }>;
    invoices?: unknown[];
    processedInvoiceCount: number;
  }>;
}

export function createCalculateWeightsRoute(
  calculateInvoiceWeights: WeightCalculationFn,
  domainLabel?: string
) {
  const label = domainLabel ? `${domainLabel} ` : '';

  async function POST(request: NextRequest) {
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
      logger.error(`Error calculating ${label}invoice weights`, error);
      return NextResponse.json(
        { error: 'Failed to calculate invoice weights' },
        { status: 500 }
      );
    }
  }

  async function GET(request: NextRequest) {
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
      logger.error(`Error previewing ${label}weight calculation`, error);
      return NextResponse.json(
        { error: 'Failed to preview weight calculation' },
        { status: 500 }
      );
    }
  }

  return { GET, POST };
}

/**
 * Factory for the customer-orders route.
 * Accepts the domain's calculateCustomerOrdersFromTransactions function
 * and the map function.
 */
export interface CustomerOrderCalculationFn {
  (options: { customerName?: string; requireInvoiceDate: boolean }): Promise<
    Array<{
      customerName?: string;
      actualWeight?: string;
      breakdown?: Array<{
        productCode?: string;
        quantity?: number;
        weightPerPiece?: number;
        totalWeight?: number;
        orderStatus?: string;
      }>;
      unmatchedProducts: Array<unknown>;
    }>
  >;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CustomerOrderMapFn = (results: any[]) => any[];

export function createCustomerOrdersRoute(
  calculateCustomerOrdersFromTransactions: CustomerOrderCalculationFn,
  mapResultsToCustomerOrders: CustomerOrderMapFn,
  options?: { defaultRequireInvoiceDate?: boolean },
  domainLabel?: string
) {
  const defaultRequireInvoiceDate = options?.defaultRequireInvoiceDate ?? false;

  async function GET(request: NextRequest) {
    try {
      const { searchParams } = new URL(request.url);
      const customerName = searchParams.get('customerName') ?? undefined;
      const requireInvoiceDateParam = searchParams.get('requireInvoiceDate');

      let requireInvoiceDate: boolean;
      if (requireInvoiceDateParam !== null) {
        requireInvoiceDate = !['0', 'false', 'no'].includes(
          requireInvoiceDateParam.toLowerCase()
        );
      } else {
        requireInvoiceDate = defaultRequireInvoiceDate;
      }

      const results = await calculateCustomerOrdersFromTransactions({
        customerName,
        requireInvoiceDate,
      });

      const orders = mapResultsToCustomerOrders(results);
      const unmatchedProductCount = results.reduce(
        (total, current) => total + current.unmatchedProducts.length,
        0
      );

      return NextResponse.json({
        success: true,
        orders,
        summary: {
          customersProcessed: results.length,
          unmatchedProductCount,
        },
      });
    } catch (error) {
      logger.error(
        `Error loading ${domainLabel ? domainLabel + ' ' : ''}customer orders`,
        error
      );
      return NextResponse.json(
        { success: false, error: 'Failed to load customer orders' },
        { status: 500 }
      );
    }
  }

  return { GET };
}
