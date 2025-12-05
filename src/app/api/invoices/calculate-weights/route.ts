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

const productWeightSelect = {
  productCode: true,
  product: true,
  bulkQuantity: true,
  bulkWeight: true,
  weightPerPiece: true,
} as const;

type ProductWeightEntity = Prisma.ProductGetPayload<{
  select: typeof productWeightSelect;
}>;

const PRODUCT_CODE_CAPTURE_PATTERN = '\\(([^)]+)\\)';
const createProductCodeRegex = () =>
  new RegExp(PRODUCT_CODE_CAPTURE_PATTERN, 'g');
const EXCLUDED_TRANSACTION_STATUS = 'In Transit';

const extractParentheticalSegments = (value: string | null | undefined) => {
  if (!value) {
    return [] as string[];
  }

  const regex = createProductCodeRegex();
  const segments: string[] = [];
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = regex.exec(value)) !== null) {
    if (match[1]) {
      segments.push(match[1]);
    }
  }

  return segments;
};

const normalizeKey = (value: string | null | undefined) =>
  value ? value.toLowerCase().replace(/\s+/g, ' ').trim() : '';

const registerWeightKey = (
  index: Map<string, number>,
  rawKey: string | null | undefined,
  weight: number
) => {
  const normalized = normalizeKey(rawKey);
  if (!normalized || !Number.isFinite(weight) || weight <= 0) {
    return;
  }

  if (!index.has(normalized)) {
    index.set(normalized, weight);
  }
};

const computeProductWeight = (product: ProductWeightEntity) => {
  if (product.weightPerPiece && product.weightPerPiece > 0) {
    return product.weightPerPiece;
  }

  if (product.bulkQuantity > 0 && product.bulkWeight > 0) {
    return product.bulkWeight / product.bulkQuantity;
  }

  return 0;
};

const buildWeightIndex = (
  itemWeights: ItemWeightEntity[],
  productWeights: ProductWeightEntity[]
) => {
  const index = new Map<string, number>();

  for (const item of itemWeights) {
    const weight = item.approxWeightPerPiece.toNumber();
    registerWeightKey(index, item.itemName, weight);

    const capturedCodes = extractParentheticalSegments(item.itemName);
    capturedCodes.forEach((code) => {
      registerWeightKey(index, code, weight);
    });
  }

  for (const product of productWeights) {
    const weight = computeProductWeight(product);
    if (weight <= 0) {
      continue;
    }

    registerWeightKey(index, product.productCode, weight);
    registerWeightKey(index, product.product, weight);

    if (product.product && product.productCode) {
      registerWeightKey(
        index,
        `${product.product} (${product.productCode})`,
        weight
      );
    }
  }

  return index;
};

const collectLookupCandidates = (raw: string) => {
  const candidates = new Set<string>();
  const direct = normalizeKey(raw);
  if (direct) {
    candidates.add(direct);
  }

  const capturedCodes = extractParentheticalSegments(raw);
  capturedCodes.forEach((code) => {
    const normalized = normalizeKey(code);
    if (normalized) {
      candidates.add(normalized);
    }
  });

  const withoutParentheses = raw.replace(createProductCodeRegex(), ' ');
  const normalizedWithoutParentheses = normalizeKey(withoutParentheses);
  if (normalizedWithoutParentheses) {
    candidates.add(normalizedWithoutParentheses);
  }

  return Array.from(candidates);
};

const findWeightForProduct = (
  weightIndex: Map<string, number>,
  rawProductCode: string
) => {
  const candidates = collectLookupCandidates(rawProductCode);

  for (const candidate of candidates) {
    const weight = weightIndex.get(candidate);
    if (weight !== undefined) {
      return weight;
    }
  }

  for (const candidate of candidates) {
    let fuzzyMatch: number | undefined;

    weightIndex.forEach((weight, key) => {
      if (fuzzyMatch !== undefined) {
        return;
      }

      if (key.includes(candidate) || candidate.includes(key)) {
        fuzzyMatch = weight;
      }
    });

    if (fuzzyMatch !== undefined) {
      return fuzzyMatch;
    }
  }

  return undefined;
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

    // Fetch all weight sources once
    const itemWeightClient = getItemWeightClient();
    const [itemWeights, productWeights] = await Promise.all([
      itemWeightClient.findMany({
        where: { deletedAt: null },
      }),
      prisma.product.findMany({
        where: {
          deletedAt: null,
          OR: [
            { weightPerPiece: { gt: 0 } },
            {
              AND: [{ bulkWeight: { gt: 0 } }, { bulkQuantity: { gt: 0 } }],
            },
          ],
        },
        select: productWeightSelect,
      }),
    ]);

    const weightIndex = buildWeightIndex(itemWeights, productWeights);

    const results: WeightCalculationResult[] = [];

    // Process each invoice
    for (const invoice of invoices) {
      try {
        const normalizedCustomerName = invoice.customerName.trim();
        const transactionWhere: Prisma.TransactionWhereInput = {
          deletedAt: null,
          NOT: {
            orderStatus: {
              equals: EXCLUDED_TRANSACTION_STATUS,
              mode: 'insensitive',
            },
          },
        };

        if (normalizedCustomerName.length > 0) {
          transactionWhere.customers = {
            equals: normalizedCustomerName,
            mode: 'insensitive',
          };
        }

        // Fetch all transactions for this customer
        const transactions = await prisma.transaction.findMany({
          where: transactionWhere,
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

          const weightPerPiece = findWeightForProduct(weightIndex, productCode);

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
