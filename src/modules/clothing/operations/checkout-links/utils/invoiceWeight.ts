export interface TransactionSummary {
  customerName: string;
  productCode: string;
  quantity: number;
  orderStatus: string;
}

export interface ItemWeightSummary {
  itemName: string;
  approxWeightPerPiece: string | number | null | undefined;
}

const DEFAULT_ALLOWED_STATUSES = new Set(['warehouse', 'prepared']);

export function extractProductCodeFromItemName(
  itemName: string
): string | null {
  if (!itemName) {
    return null;
  }

  const match = itemName.match(/\(([^)]+)\)\s*$/);
  if (match && match[1]) {
    return match[1].trim().toUpperCase();
  }

  const trimmed = itemName.trim();
  if (trimmed.length > 0) {
    return trimmed.toUpperCase();
  }

  return null;
}

export function buildProductWeightMap(
  itemWeights: ItemWeightSummary[]
): Map<string, number> {
  const map = new Map<string, number>();

  itemWeights.forEach((item) => {
    const productCode = extractProductCodeFromItemName(item.itemName);
    if (!productCode || map.has(productCode)) {
      return;
    }

    const rawValue = item.approxWeightPerPiece;
    const weight =
      typeof rawValue === 'number'
        ? rawValue
        : Number.parseFloat(rawValue ?? '');
    if (Number.isFinite(weight) && weight > 0) {
      map.set(productCode, weight);
    }
  });

  return map;
}

export function calculateCustomerActualWeight(options: {
  customerName: string;
  transactions: TransactionSummary[];
  weightMap: Map<string, number>;
  allowedStatuses?: Set<string>;
}): number {
  const { customerName, transactions, weightMap, allowedStatuses } = options;

  if (!customerName || transactions.length === 0 || weightMap.size === 0) {
    return 0;
  }

  const normalizedCustomer = normalize(customerName);
  const statusWhitelist = allowedStatuses ?? DEFAULT_ALLOWED_STATUSES;
  const normalizedStatuses = Array.from(statusWhitelist).map((status) =>
    normalize(status)
  );

  let total = 0;

  transactions.forEach((transaction) => {
    if (normalize(transaction.customerName) !== normalizedCustomer) {
      return;
    }

    const normalizedStatus = normalize(transaction.orderStatus);
    if (
      normalizedStatus.length === 0 ||
      !normalizedStatuses.some(
        (allowed) =>
          normalizedStatus === allowed ||
          normalizedStatus.startsWith(allowed) ||
          normalizedStatus.includes(allowed)
      )
    ) {
      return;
    }

    const productCode = transaction.productCode?.trim().toUpperCase();
    if (!productCode) {
      return;
    }

    const approxWeight = weightMap.get(productCode);
    if (!approxWeight) {
      return;
    }

    const quantity = Number(transaction.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return;
    }

    total += quantity * approxWeight;
  });

  return total;
}

export function formatWeightDisplay(weight: number): string {
  if (!Number.isFinite(weight) || weight <= 0) {
    return '';
  }

  const rounded = Math.round(weight * 100) / 100;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rounded);
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
