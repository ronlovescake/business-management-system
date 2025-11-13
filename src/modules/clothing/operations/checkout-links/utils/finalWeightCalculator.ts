/**
 * Final Weight Calculator
 * Calculates final shipping weight based on actual weight using tiered pricing formula
 */

/**
 * Calculate final weight based on actual weight
 *
 * Logic:
 * - For weights ≤ 3kg: Use fixed weight tiers (0.5, 1, 1.5, 2, 2.5, 3)
 * - For weights > 3kg: Apply polynomial adjustment formula and round up to nearest 0.5kg
 *
 * Formula for > 3kg:
 * finalWeight = ROUNDUP((actualWeight + polynomial + 0.25) * 2, 0) / 2
 * where polynomial = 0.0012 * weight² + 0.0075 * weight + 0.198
 *
 * @param actualWeight - The actual weight in kg
 * @returns The final shipping weight in kg, or empty string if invalid
 */
export function calculateFinalWeight(
  actualWeight: number | string | null | undefined
): string {
  // Handle empty or invalid values
  if (
    actualWeight === null ||
    actualWeight === undefined ||
    actualWeight === ''
  ) {
    return '';
  }

  // Convert to number if string
  const weight =
    typeof actualWeight === 'string'
      ? Number.parseFloat(actualWeight)
      : actualWeight;

  // Return empty for invalid numbers or non-positive weights
  if (!Number.isFinite(weight) || weight <= 0) {
    return '';
  }

  let finalWeight: number;

  // Fixed tiers for weights ≤ 3kg
  if (weight <= 0.5) {
    finalWeight = 0.5;
  } else if (weight <= 1) {
    finalWeight = 1;
  } else if (weight <= 1.5) {
    finalWeight = 1.5;
  } else if (weight <= 2) {
    finalWeight = 2;
  } else if (weight <= 2.5) {
    finalWeight = 2.5;
  } else if (weight <= 3) {
    finalWeight = 3;
  } else {
    // For weights > 3kg, apply polynomial formula
    // polynomial = 0.0012 * weight² + 0.0075 * weight + 0.198
    const polynomial = 0.0012 * weight * weight + 0.0075 * weight + 0.198;

    // Add actual weight + polynomial + 0.25
    const total = weight + polynomial + 0.25;

    // Round up to nearest 0.5kg: ROUNDUP(total * 2, 0) / 2
    finalWeight = Math.ceil(total * 2) / 2;
  }

  // Format with up to 2 decimal places, removing unnecessary zeros
  return finalWeight.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Calculate final weight and return as a number
 * Useful for calculations or comparisons
 */
export function calculateFinalWeightAsNumber(
  actualWeight: number | string | null | undefined
): number {
  const result = calculateFinalWeight(actualWeight);
  return result === '' ? 0 : Number.parseFloat(result);
}
