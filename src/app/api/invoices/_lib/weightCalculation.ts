import type { Invoice, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface WeightCalculationBreakdown {
  productCode: string;
  quantity: number;
  weightPerPiece: number;
  totalWeight: number;
  orderStatus?: string;
}

export interface WeightCalculationResult {
  customerName: string;
  actualWeight: string;
  breakdown: WeightCalculationBreakdown[];
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

type TransactionEntity = Prisma.TransactionGetPayload<{
  select: {
    customers: true;
    productCode: true;
    quantity: true;
    orderStatus: true;
    invoiceDate: true;
  };
}>;

const PRODUCT_CODE_CAPTURE_PATTERN = '\\(([^)]+)\\)';
const PRODUCT_CODE_CAPTURE_REGEX = new RegExp(
  PRODUCT_CODE_CAPTURE_PATTERN,
  'g'
);
const createProductCodeRegex = () =>
  new RegExp(
    PRODUCT_CODE_CAPTURE_REGEX.source,
    PRODUCT_CODE_CAPTURE_REGEX.flags
  );

export const EXCLUDED_TRANSACTION_STATUSES = [
  'In Transit',
  'Shipped',
  'Cancelled',
  'Pending Payment',
] as const;

const extractParentheticalSegments = (value: string | null | undefined) => {
  if (!value) {
    return [] as string[];
  }

  const segments: string[] = [];
  const regex = createProductCodeRegex();
  let match: RegExpExecArray | null;

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

export interface CalculateInvoiceWeightsOptions {
  customerName?: string | null;
  persistActualWeight?: boolean;
  includeInvoices?: boolean;
}

export interface CalculateInvoiceWeightsResponse {
  results: WeightCalculationResult[];
  invoices?: Invoice[];
  processedInvoiceCount: number;
}

export const calculateInvoiceWeights = async (
  options: CalculateInvoiceWeightsOptions = {}
): Promise<CalculateInvoiceWeightsResponse> => {
  const {
    customerName,
    persistActualWeight = true,
    includeInvoices = true,
  } = options;

  const invoices = await prisma.invoice.findMany({
    where: {
      deletedAt: null,
      ...(customerName ? { customerName } : {}),
    },
  });

  if (invoices.length === 0) {
    return {
      results: [],
      invoices: includeInvoices ? [] : undefined,
      processedInvoiceCount: 0,
    };
  }

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

  for (const invoice of invoices) {
    try {
      const normalizedCustomerName = invoice.customerName.trim();
      const transactionWhere: Prisma.TransactionWhereInput = {
        deletedAt: null,
        NOT: EXCLUDED_TRANSACTION_STATUSES.map((status) => ({
          orderStatus: {
            equals: status,
            mode: 'insensitive',
          },
        })),
      };

      if (normalizedCustomerName.length > 0) {
        transactionWhere.customers = {
          equals: normalizedCustomerName,
          mode: 'insensitive',
        };
      }

      const transactions = await prisma.transaction.findMany({
        where: transactionWhere,
        select: {
          productCode: true,
          quantity: true,
          orderStatus: true,
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
      const breakdown: WeightCalculationBreakdown[] = [];
      const unmatchedProducts: string[] = [];

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
            orderStatus: transaction.orderStatus?.trim() ?? undefined,
          });
        } else {
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
        unmatchedProducts: Array.from(new Set(unmatchedProducts)),
      });

      if (persistActualWeight) {
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { actualWeight: totalWeight.toFixed(2) },
        });
      }
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

  let updatedInvoices: Invoice[] | undefined;
  if (includeInvoices) {
    updatedInvoices = await prisma.invoice.findMany({
      where: {
        deletedAt: null,
        ...(customerName ? { customerName } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  return {
    results,
    invoices: includeInvoices ? updatedInvoices : undefined,
    processedInvoiceCount: invoices.length,
  };
};

type CustomerOrderCalculationOptions = {
  customerName?: string | null;
  requireInvoiceDate?: boolean;
};

const CUSTOMER_ORDER_INCLUDED_STATUSES = [
  'Prepared',
  'On-Hold',
  'Ready For Dispatch',
] as const;

export const calculateCustomerOrdersFromTransactions = async (
  options: CustomerOrderCalculationOptions = {}
): Promise<WeightCalculationResult[]> => {
  const { customerName, requireInvoiceDate = true } = options;

  const transactionWhere: Prisma.TransactionWhereInput = {
    deletedAt: null,
    orderStatus: {
      in: [...CUSTOMER_ORDER_INCLUDED_STATUSES],
      mode: 'insensitive',
    },
    ...(customerName
      ? {
          customers: {
            equals: customerName,
            mode: 'insensitive',
          },
        }
      : {}),
  };

  const [transactionRows, itemWeights, productWeights] = await Promise.all([
    prisma.transaction.findMany({
      where: transactionWhere,
      select: {
        customers: true,
        productCode: true,
        quantity: true,
        orderStatus: true,
        invoiceDate: true,
      },
    }),
    getItemWeightClient().findMany({
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

  const transactions = transactionRows as TransactionEntity[];

  const weightIndex = buildWeightIndex(itemWeights, productWeights);

  const groupedTransactions = new Map<
    string,
    { displayName: string; items: TransactionEntity[] }
  >();

  for (const transaction of transactions) {
    const customerDisplayName = transaction.customers?.trim();
    const hasInvoiceDate = Boolean(transaction.invoiceDate?.trim());

    if (!customerDisplayName) {
      continue;
    }

    if (requireInvoiceDate && !hasInvoiceDate) {
      continue;
    }

    const normalized = customerDisplayName.toLowerCase();
    const existing = groupedTransactions.get(normalized);
    if (existing) {
      existing.items.push(transaction);
    } else {
      groupedTransactions.set(normalized, {
        displayName: customerDisplayName,
        items: [transaction],
      });
    }
  }

  const results: WeightCalculationResult[] = [];

  groupedTransactions.forEach(({ displayName, items }) => {
    let totalWeight = 0;
    const breakdown: WeightCalculationBreakdown[] = [];
    const unmatchedProducts: string[] = [];

    for (const transaction of items) {
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
          orderStatus: transaction.orderStatus?.trim() ?? undefined,
        });
      } else {
        unmatchedProducts.push(productCode);
        logger.warn(
          `No weight data found for product: ${productCode} (Customer: ${displayName})`
        );
      }
    }

    results.push({
      customerName: displayName,
      actualWeight: totalWeight.toFixed(2),
      breakdown,
      unmatchedProducts: Array.from(new Set(unmatchedProducts)),
    });
  });

  return results;
};
