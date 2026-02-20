export function normalizeProductCode(value: string | null | undefined): string {
  return (value ?? '').trim();
}

export function buildAutoSaleMovementNote(transactionId: number): string {
  return `auto-sale txn ${transactionId}`;
}

export function buildAutoReserveMovementNote(transactionId: number): string {
  return `auto-reserve txn ${transactionId}`;
}

export function buildAutoMixReserveMovementNote(
  transactionId: number,
  productCode: string
): string {
  return `auto-reserve txn ${transactionId} mix ${productCode}`;
}

export function buildAutoMixSaleMovementNote(
  transactionId: number,
  productCode: string
): string {
  return `auto-sale txn ${transactionId} mix ${productCode}`;
}

export function buildAutoMixReserveMovementPrefix(
  transactionId: number
): string {
  return `auto-reserve txn ${transactionId} mix `;
}

export function buildAutoMixSaleMovementPrefix(transactionId: number): string {
  return `auto-sale txn ${transactionId} mix `;
}
