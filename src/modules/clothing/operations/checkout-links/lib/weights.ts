import type { ProductData } from '../../products/types/product.types';
import type { ItemWeightData } from '../types';

const formatNumber = (value: number | undefined | null): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
};

export const formatWeightValue = (value: number | undefined | null): string => {
  const numeric = formatNumber(value);
  return numeric.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const hasWeightData = (product: ProductData): boolean => {
  const bulkQuantity = formatNumber(product['Bulk Quantity']);
  const bulkWeight = formatNumber(product['Bulk Weight']);
  const weightPerPiece = formatNumber(product['Weight Per Piece']);
  return bulkQuantity > 0 || bulkWeight > 0 || weightPerPiece > 0;
};

export const mapProductToItemWeight = (
  product: ProductData
): ItemWeightData => {
  const bulkQuantity = formatNumber(product['Bulk Quantity']);
  const bulkWeight = formatNumber(product['Bulk Weight']);
  const weightPerPieceCandidate = product['Weight Per Piece'];
  const weightPerPiece =
    typeof weightPerPieceCandidate === 'number'
      ? weightPerPieceCandidate
      : bulkQuantity > 0
        ? bulkWeight / bulkQuantity
        : 0;

  const productNameRaw = (product.Product ?? '').trim();
  const productName =
    productNameRaw.length > 0 ? productNameRaw : 'Unnamed Product';
  const productCode = product['Product Code']?.trim();

  return {
    id: product.id
      ? String(product.id)
      : `${productCode ?? 'unknown'}-${productName}`,
    itemName: productCode ? `${productName} (${productCode})` : productName,
    productCode,
    bulkQuantity: formatWeightValue(bulkQuantity),
    bulkWeight: formatWeightValue(bulkWeight),
    approxWeightPerPiece: formatWeightValue(weightPerPiece),
  };
};
