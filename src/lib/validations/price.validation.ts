import { z } from 'zod';

/**
 * Price Validation Schema
 *
 * Comprehensive validation for tier pricing data
 * Prices are stored as integers (cents) but displayed as decimal values
 * Example: $10.50 is stored as 1050 cents
 */

/**
 * Product Code validation (required field)
 */
const productCodeSchema = z
  .string()
  .trim()
  .min(1, 'Product code is required')
  .max(100, 'Product code must not exceed 100 characters');

/**
 * Non-negative integer validation (for prices in cents)
 */
const nonNegativeIntSchema = z
  .number()
  .int('Must be a whole number')
  .min(0, 'Value must be non-negative')
  .finite('Value must be a finite number');

/**
 * Non-negative number validation (for UI display values)
 */
const nonNegativeNumberSchema = z
  .number()
  .min(0, 'Value must be non-negative')
  .finite('Value must be a finite number');

/**
 * Optional string field validation
 */
const optionalStringSchema = z.string().trim().max(500).nullable().optional();

/**
 * Short string field (max 100 chars)
 */
const shortStringSchema = z.string().trim().max(100).nullable().optional();

/**
 * Price Data Schema (Frontend field names - display format)
 * Used for validating data from CSV imports and API requests
 * Values are in dollars, not cents
 */
export const priceDataSchema = z
  .object({
    id: z.number().int().positive().optional(),
    'Product Code': productCodeSchema,
    'Lower Limit': nonNegativeNumberSchema,
    'Upper Limit': nonNegativeNumberSchema,
    Prices: nonNegativeNumberSchema,
    'Price Adjustment': nonNegativeNumberSchema.default(0),
    description: optionalStringSchema,
    category: shortStringSchema,
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine(
    (data) => {
      const lower = data['Lower Limit'];
      const upper = data['Upper Limit'];
      return upper >= lower;
    },
    {
      message: 'Upper Limit must be greater than or equal to Lower Limit',
      path: ['Upper Limit'],
    }
  )
  .refine(
    (data) => {
      const lower = data['Lower Limit'];
      return lower >= 0;
    },
    {
      message: 'Lower Limit cannot be negative',
      path: ['Lower Limit'],
    }
  )
  .refine(
    (data) => {
      const price = data['Prices'];
      return price >= 0;
    },
    {
      message: 'Price cannot be negative',
      path: ['Prices'],
    }
  );

/**
 * Price Database Schema (Database field names - storage format)
 * Values are in cents (integers)
 */
export const priceDbSchema = z
  .object({
    id: z.number().int().positive().optional(),
    productCode: z.string().min(1).max(100),
    lowerLimit: nonNegativeIntSchema,
    upperLimit: nonNegativeIntSchema,
    currentPrice: nonNegativeIntSchema,
    priceAdjustment: nonNegativeIntSchema.default(0),
    description: z.string().max(500).nullable().optional(),
    category: z.string().max(100).nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine((data) => data.upperLimit >= data.lowerLimit, {
    message: 'Upper limit must be >= lower limit',
    path: ['upperLimit'],
  });

/**
 * Bulk Price Schema (array validation)
 * Limits batch size to prevent timeouts
 */
export const bulkPriceSchema = z
  .array(priceDataSchema)
  .min(1, 'At least one price tier is required')
  .max(1000, 'Maximum 1000 price tiers per request');

/**
 * Type exports for TypeScript usage
 */
export type PriceDataInput = z.infer<typeof priceDataSchema>;
export type PriceDbInput = z.infer<typeof priceDbSchema>;

/**
 * Format Zod validation errors into user-friendly messages
 */
export function formatValidationErrors(error: z.ZodError): string[] {
  return error.errors.map((err) => {
    const path = err.path.join(' → ');
    return path ? `${path}: ${err.message}` : err.message;
  });
}

/**
 * Validation helper: Check for overlapping price tiers
 * Price tiers should not overlap for the same product code
 */
export function detectOverlappingTiers(
  prices: Array<{ productCode: string; lowerLimit: number; upperLimit: number }>
): Array<{ productCode: string; tier1: string; tier2: string }> {
  const conflicts: Array<{
    productCode: string;
    tier1: string;
    tier2: string;
  }> = [];

  // Group by product code
  const grouped = new Map<
    string,
    Array<{ lowerLimit: number; upperLimit: number; index: number }>
  >();

  prices.forEach((price, index) => {
    if (!grouped.has(price.productCode)) {
      grouped.set(price.productCode, []);
    }
    const group = grouped.get(price.productCode);
    if (group) {
      group.push({
        lowerLimit: price.lowerLimit,
        upperLimit: price.upperLimit,
        index,
      });
    }
  });

  // Check each product code for overlaps
  Array.from(grouped.entries()).forEach(([productCode, tiers]) => {
    for (let i = 0; i < tiers.length; i++) {
      for (let j = i + 1; j < tiers.length; j++) {
        const tier1 = tiers[i];
        const tier2 = tiers[j];

        // Check if ranges overlap
        const hasOverlap =
          (tier1.lowerLimit >= tier2.lowerLimit &&
            tier1.lowerLimit <= tier2.upperLimit) ||
          (tier1.upperLimit >= tier2.lowerLimit &&
            tier1.upperLimit <= tier2.upperLimit) ||
          (tier2.lowerLimit >= tier1.lowerLimit &&
            tier2.lowerLimit <= tier1.upperLimit) ||
          (tier2.upperLimit >= tier1.lowerLimit &&
            tier2.upperLimit <= tier1.upperLimit);

        if (hasOverlap) {
          conflicts.push({
            productCode,
            tier1: `${tier1.lowerLimit}-${tier1.upperLimit} (row ${tier1.index + 1})`,
            tier2: `${tier2.lowerLimit}-${tier2.upperLimit} (row ${tier2.index + 1})`,
          });
        }
      }
    }
  });

  return conflicts;
}
