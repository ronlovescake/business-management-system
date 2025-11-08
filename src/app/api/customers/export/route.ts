import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/customers/export
 *
 * Optimized endpoint that fetches ALL customers with ALL their additional info
 * in a SINGLE database query for CSV export purposes.
 *
 * This returns:
 * - All primary customer fields
 * - All additional Shopee usernames
 * - All additional addresses
 * - All additional phone numbers
 * - All alternate customer names
 * - All Facebook accounts
 *
 * The frontend can then transform this data into different export formats:
 * 1. Numbered Columns (default): Shopee Username 1-5, Additional Address 1-5, etc.
 * 2. Duplicate Rows (for analysis): One row per additional info item
 */
export async function GET() {
  try {
    // Single query with JOIN to get all customers with ALL their additional info
    const customersWithInfo = await prisma.customer.findMany({
      where: {
        deletedAt: null, // Exclude soft-deleted customers
      },
      include: {
        additionalCustomerInfo: {
          where: {
            deletedAt: null, // Exclude soft-deleted info
          },
          select: {
            type: true,
            value: true,
          },
          orderBy: {
            createdAt: 'asc', // Oldest first for consistent ordering
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    // Transform to export-friendly structure
    const result = customersWithInfo.map((customer) => {
      // Group additional info by type
      const shopeeUsernames = customer.additionalCustomerInfo
        .filter((info) => info.type === 'shopee_username')
        .map((info) => info.value || '');

      const additionalAddresses = customer.additionalCustomerInfo
        .filter((info) => info.type === 'address')
        .map((info) => info.value || '');

      const additionalPhones = customer.additionalCustomerInfo
        .filter((info) => info.type === 'phone')
        .map((info) => info.value || '');

      const alternateNames = customer.additionalCustomerInfo
        .filter((info) => info.type === 'alternate_name')
        .map((info) => info.value || '');

      const facebookAccounts = customer.additionalCustomerInfo
        .filter((info) => info.type === 'facebook')
        .map((info) => info.value || '');

      return {
        id: customer.id,
        date: customer.date || '',
        customerName: customer.customerName || '',
        phoneNumber: customer.phoneNumber || '',
        address: customer.address || '',
        facebook: customer.facebook || '',
        emailAddress: customer.emailAddress || '',
        businessName: customer.businessName || '',
        taxNumber: customer.taxNumber || '',
        businessAddress: customer.businessAddress || '',
        businessContactNumber: customer.businessContactNumber || '',
        customerStatus: customer.customerStatus || '',
        // Additional info grouped by type
        shopeeUsernames,
        additionalAddresses,
        additionalPhones,
        alternateNames,
        facebookAccounts,
      };
    });

    // Calculate stats for logging
    const stats = {
      totalCustomers: result.length,
      withShopeeUsernames: result.filter((c) => c.shopeeUsernames.length > 0)
        .length,
      withAdditionalAddresses: result.filter(
        (c) => c.additionalAddresses.length > 0
      ).length,
      withAdditionalPhones: result.filter((c) => c.additionalPhones.length > 0)
        .length,
      withAlternateNames: result.filter((c) => c.alternateNames.length > 0)
        .length,
      withFacebookAccounts: result.filter((c) => c.facebookAccounts.length > 0)
        .length,
      totalShopeeUsernames: result.reduce(
        (sum, c) => sum + c.shopeeUsernames.length,
        0
      ),
      totalAdditionalAddresses: result.reduce(
        (sum, c) => sum + c.additionalAddresses.length,
        0
      ),
      totalAdditionalPhones: result.reduce(
        (sum, c) => sum + c.additionalPhones.length,
        0
      ),
      totalAlternateNames: result.reduce(
        (sum, c) => sum + c.alternateNames.length,
        0
      ),
      totalFacebookAccounts: result.reduce(
        (sum, c) => sum + c.facebookAccounts.length,
        0
      ),
      maxShopeeUsernames: Math.max(
        0,
        ...result.map((c) => c.shopeeUsernames.length)
      ),
      maxAdditionalAddresses: Math.max(
        0,
        ...result.map((c) => c.additionalAddresses.length)
      ),
      maxAdditionalPhones: Math.max(
        0,
        ...result.map((c) => c.additionalPhones.length)
      ),
      maxAlternateNames: Math.max(
        0,
        ...result.map((c) => c.alternateNames.length)
      ),
      maxFacebookAccounts: Math.max(
        0,
        ...result.map((c) => c.facebookAccounts.length)
      ),
    };

    logger.info(
      `Successfully fetched ${result.length} customers with all additional info`,
      stats
    );

    return NextResponse.json({
      success: true,
      data: result,
      stats,
    });
  } catch (err) {
    logger.error('GET /api/customers/export error', err);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch customers for export',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
