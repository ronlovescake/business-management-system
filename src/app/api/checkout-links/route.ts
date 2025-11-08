/**
 * CheckoutLinks API Route
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  BulkCreateCheckoutLinksSchema,
  CheckoutLinksQuerySchema,
  UpdateCheckoutLinksSchema,
} from '@/modules/clothing/operations/checkout-links/api/schemas';
import { ZodError } from 'zod';

/**
 * GET /api/checkout-links
 *
 * Fetch all records with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const limit = limitParam ? parseInt(limitParam, 10) : 100;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    const query = CheckoutLinksQuerySchema.parse({ search, limit, offset });

    const where = query.search
      ? {
          deletedAt: null,
          OR: [
            {
              weight: { contains: query.search, mode: 'insensitive' as const },
            },
            { width: { contains: query.search, mode: 'insensitive' as const } },
            {
              length: { contains: query.search, mode: 'insensitive' as const },
            },
            {
              height: { contains: query.search, mode: 'insensitive' as const },
            },
            {
              checkoutLinks: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
            {
              productPortals: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
            {
              productNames: {
                contains: query.search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : { deletedAt: null };

    const [data, total] = await Promise.all([
      prisma.checkoutLink.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.checkoutLink.count({ where }),
    ]);

    return NextResponse.json({ data, total });
  } catch (error) {
    logger.error('Error fetching checkout links', error);
    return NextResponse.json(
      { error: 'Failed to fetch checkout links' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/checkout-links
 *
 * Create new records (supports bulk creation)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = BulkCreateCheckoutLinksSchema.parse(body);

    const result = await prisma.checkoutLink.createMany({
      data: validatedData.items,
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Successfully imported ${result.count} checkout links`,
    });
  } catch (error) {
    logger.error('Error creating checkout links', error);

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.issues,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create checkout links' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/checkout-links
 *
 * Update an existing record
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const validatedData = UpdateCheckoutLinksSchema.parse(data);

    const updated = await prisma.checkoutLink.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating checkout link', error);
    return NextResponse.json(
      { error: 'Failed to update checkout link' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/checkout-links
 *
 * Soft delete a record
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.checkoutLink.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting checkout link', error);
    return NextResponse.json(
      { error: 'Failed to delete checkout link' },
      { status: 500 }
    );
  }
}
