/**
 * Invoice Weight Calculation API Route
 * Calculates actual weight for invoices based on transaction data and item weights
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

interface WeightCalculationResult {
  customerName: string;
  actualWeight: string;
  breakdown: Array<{
    productCode: string;
    quantity: number;
    weightPerPiece: number;
    totalWeight: number;
  }>;
  unmatchedProducts: string[];
}

type ItemWeightEntity = {
  id: string;
  itemName: string;
  bulkQuantity: Prisma.Decimal;
  bulkWeight: Prisma.Decimal;
  approxWeightPerPiece: Prisma.Decimal;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

const getItemWeightClient = () =>
  (
    prisma as unknown as {
      itemWeight: {
        findMany: (
          args: Prisma.ItemWeightFindManyArgs
        ) => Promise<ItemWeightEntity[]>;
      };
    }
  ).itemWeight;

/**
 * POST /api/invoices/calculate-weights
 *
 * Calculate actual weight for one or all invoices
 * Body: { customerName?: string } - If provided, calculates for specific customer only
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { customerName } = body;

    // Fetch invoices to process
    const invoices = await prisma.invoice.findMany({
      where: {
        deletedAt: null,
        ...(customerName ? { customerName } : {}),
      },
    });

    if (invoices.length === 0) {
      return NextResponse.json(
        {
          error: customerName
            ? `No invoice found for customer: ${customerName}`
            : 'No invoices found',
        },
        { status: 404 }
      );
    }

    // Fetch all item weights once
    const itemWeightClient = getItemWeightClient();
    const itemWeights = await itemWeightClient.findMany({
      where: { deletedAt: null },
    });

    // Create a map for quick lookup: itemName -> approxWeightPerPiece
    const itemWeightMap = new Map<string, number>();
    for (const item of itemWeights) {
      // Store by item name for matching
      itemWeightMap.set(
        item.itemName.toLowerCase().trim(),
        item.approxWeightPerPiece.toNumber()
      );
    }

    const results: WeightCalculationResult[] = [];

    // Process each invoice
    for (const invoice of invoices) {
      try {
        // Fetch all transactions for this customer
        const transactions = await prisma.transaction.findMany({
          where: {
            deletedAt: null,
            customers: invoice.customerName,
          },
          select: {
            productCode: true,
            quantity: true,
          },
        });

        if (transactions.length === 0) {
          logger.warn(
            `No transactions found for customer: ${invoice.customerName}`
          );
          results.push({
            customerName: invoice.customerName,
            actualWeight: '0.00',
            breakdown: [],
            unmatchedProducts: [],
          });
          continue;
        }

        let totalWeight = 0;
        const breakdown: WeightCalculationResult['breakdown'] = [];
        const unmatchedProducts: string[] = [];

        // Calculate weight for each product in transactions
        for (const transaction of transactions) {
          const productCode = transaction.productCode?.trim();
          const quantity = transaction.quantity ?? 0;

          if (!productCode || quantity <= 0) {
            continue;
          }

          // Try to find matching item weight by product code
          // The itemName in ItemWeight table should contain the product code
          let weightPerPiece: number | undefined;

          // Look for exact match or partial match in item names
          for (const itemName of Array.from(itemWeightMap.keys())) {
            // Check if the product code appears in the item name
            if (itemName.includes(productCode.toLowerCase())) {
              weightPerPiece = itemWeightMap.get(itemName);
              break;
            }
          }

          if (weightPerPiece !== undefined) {
            const itemTotalWeight = weightPerPiece * quantity;
            totalWeight += itemTotalWeight;

            breakdown.push({
              productCode,
              quantity,
              weightPerPiece,
              totalWeight: itemTotalWeight,
            });
          } else {
            // Product not found in item weights
            unmatchedProducts.push(productCode);
            logger.warn(
              `No weight data found for product: ${productCode} (Customer: ${invoice.customerName})`
            );
          }
        }

        results.push({
          customerName: invoice.customerName,
          actualWeight: totalWeight.toFixed(2),
          breakdown,
          unmatchedProducts: Array.from(new Set(unmatchedProducts)), // Remove duplicates
        });

        // Update the invoice with calculated actual weight
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { actualWeight: totalWeight.toFixed(2) },
        });
      } catch (error) {
        logger.error(
          `Error calculating weight for customer: ${invoice.customerName}`,
          error
        );
        results.push({
          customerName: invoice.customerName,
          actualWeight: 'ERROR',
          breakdown: [],
          unmatchedProducts: [],
        });
      }
    }

    // Fetch updated invoices
    const updatedInvoices = await prisma.invoice.findMany({
      where: {
        deletedAt: null,
        ...(customerName ? { customerName } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully calculated weights for ${results.length} invoice(s)`,
      results,
      invoices: updatedInvoices,
    });
  } catch (error) {
    logger.error('Error calculating invoice weights', error);
    return NextResponse.json(
      { error: 'Failed to calculate invoice weights' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/invoices/calculate-weights?customerName=...
 *
 * Preview weight calculation without saving
 */
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

    // Fetch transactions for this customer
    const transactions = await prisma.transaction.findMany({
      where: {
        deletedAt: null,
        customers: customerName,
      },
      select: {
        productCode: true,
        quantity: true,
      },
    });

    if (transactions.length === 0) {
      return NextResponse.json({
        customerName,
        actualWeight: '0.00',
        breakdown: [],
        unmatchedProducts: [],
        message: 'No transactions found for this customer',
      });
    }

    // Fetch all item weights
    const itemWeightClient = getItemWeightClient();
    const itemWeights = await itemWeightClient.findMany({
      where: { deletedAt: null },
    });

    const itemWeightMap = new Map<string, number>();
    for (const item of itemWeights) {
      itemWeightMap.set(
        item.itemName.toLowerCase().trim(),
        item.approxWeightPerPiece.toNumber()
      );
    }

    let totalWeight = 0;
    const breakdown: Array<{
      productCode: string;
      quantity: number;
      weightPerPiece: number;
      totalWeight: number;
    }> = [];
    const unmatchedProducts: string[] = [];

    // Calculate weight for each product
    for (const transaction of transactions) {
      const productCode = transaction.productCode?.trim();
      const quantity = transaction.quantity ?? 0;

      if (!productCode || quantity <= 0) {
        continue;
      }

      let weightPerPiece: number | undefined;

      for (const itemName of Array.from(itemWeightMap.keys())) {
        if (itemName.includes(productCode.toLowerCase())) {
          weightPerPiece = itemWeightMap.get(itemName);
          break;
        }
      }

      if (weightPerPiece !== undefined) {
        const itemTotalWeight = weightPerPiece * quantity;
        totalWeight += itemTotalWeight;

        breakdown.push({
          productCode,
          quantity,
          weightPerPiece,
          totalWeight: itemTotalWeight,
        });
      } else {
        unmatchedProducts.push(productCode);
      }
    }

    return NextResponse.json({
      customerName,
      actualWeight: totalWeight.toFixed(2),
      breakdown,
      unmatchedProducts: Array.from(new Set(unmatchedProducts)),
    });
  } catch (error) {
    logger.error('Error previewing weight calculation', error);
    return NextResponse.json(
      { error: 'Failed to preview weight calculation' },
      { status: 500 }
    );
  }
}
