import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/customers/with-shopee
 *
 * Optimized endpoint that fetches ALL customers with their Shopee usernames
 * in a SINGLE database query using JOIN instead of 1000+ individual queries.
 *
 * This is much faster than fetching customers and then making individual
 * additional-info API calls for each customer.
 */
export async function GET() {
  try {
    // Single query with JOIN to get all customers with their Shopee usernames
    const customersWithShopee = await prisma.customer.findMany({
      where: {
        deletedAt: null, // Exclude soft-deleted customers
      },
      select: {
        id: true,
        customerName: true,
        businessName: true,
        facebook: true,
        address: true,
        phoneNumber: true,
        additionalCustomerInfo: {
          where: {
            type: 'shopee_username', // Note: uses underscore, not camelCase
            deletedAt: null, // Exclude soft-deleted info
          },
          select: {
            value: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    // Transform to a flat structure for easier consumption
    const result = customersWithShopee.map((customer) => ({
      id: customer.id,
      customerName: customer.customerName || '',
      businessName: customer.businessName || '',
      facebook: customer.facebook || '',
      address: customer.address || '',
      phoneNumber: customer.phoneNumber || '',
      shopeeUsernames: customer.additionalCustomerInfo.map((info) =>
        (info.value || '').toLowerCase().trim()
      ),
    }));

    // Filter to only include customers with at least one Shopee username
    const withUsernames = result.filter((c) => c.shopeeUsernames.length > 0);

    logger.info(
      `Successfully fetched ${result.length} customers (${withUsernames.length} with Shopee usernames) in single query`
    );

    return NextResponse.json({
      success: true,
      data: result,
      stats: {
        totalCustomers: result.length,
        withShopeeUsernames: withUsernames.length,
      },
    });
  } catch (err) {
    logger.error('GET /api/customers/with-shopee error', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch customers with Shopee usernames',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
