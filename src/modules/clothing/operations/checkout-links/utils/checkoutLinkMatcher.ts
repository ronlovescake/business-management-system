/**
 * Checkout Link Matcher
 * Matches final weight with checkout links data
 */

export interface CheckoutLinkRecord {
  weight: string;
  checkoutLinks: string;
}

/**
 * Find checkout link by matching final weight
 *
 * @param finalWeight - The calculated final weight (e.g., "21.5")
 * @param checkoutLinksData - Array of checkout link records
 * @returns The matching checkout link URL or empty string if no match
 */
export function findCheckoutLinkByWeight(
  finalWeight: string | number | null | undefined,
  checkoutLinksData: CheckoutLinkRecord[]
): string {
  // Handle invalid input
  if (!finalWeight || checkoutLinksData.length === 0) {
    return '';
  }

  // Convert finalWeight to number for comparison
  const weightValue =
    typeof finalWeight === 'string'
      ? Number.parseFloat(finalWeight)
      : finalWeight;

  if (!Number.isFinite(weightValue) || weightValue <= 0) {
    return '';
  }

  // Look for exact match
  // Compare numerically to handle different string formats (e.g., "21.5" vs "21.50")
  const match = checkoutLinksData.find((record) => {
    const recordWeight = Number.parseFloat(record.weight);
    return (
      Number.isFinite(recordWeight) &&
      Math.abs(recordWeight - weightValue) < 0.001
    );
  });

  // Return the checkout link or empty string if no match
  return match?.checkoutLinks?.trim() || '';
}

/**
 * Batch lookup for multiple weights
 * Useful for processing multiple invoices at once
 */
export function batchFindCheckoutLinks(
  weights: Array<string | number>,
  checkoutLinksData: CheckoutLinkRecord[]
): Map<string, string> {
  const resultMap = new Map<string, string>();

  for (const weight of weights) {
    const key = String(weight);
    if (!resultMap.has(key)) {
      const link = findCheckoutLinkByWeight(weight, checkoutLinksData);
      resultMap.set(key, link);
    }
  }

  return resultMap;
}
