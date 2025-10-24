import { z } from 'zod';

/**
 * Sorting Distribution Validation Schema
 *
 * Comprehensive validation for order fulfillment and packaging distribution
 * Tracks how products are sorted into groups/packages for orders
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
 * Group Number validation (package/group identifier)
 */
const groupNumberSchema = z
  .string()
  .trim()
  .max(50, 'Group number must not exceed 50 characters')
  .default('');

/**
 * Non-negative number validation
 */
const nonNegativeNumberSchema = z
  .number()
  .min(0, 'Value must be non-negative')
  .finite('Value must be a finite number');

/**
 * Non-negative integer validation
 */
const nonNegativeIntSchema = z
  .number()
  .int('Must be a whole number')
  .min(0, 'Value must be non-negative');

/**
 * Percentage validation (0-100)
 */
const percentageSchema = z
  .number()
  .min(0, 'Percentage must be at least 0')
  .max(100, 'Percentage must not exceed 100')
  .finite('Percentage must be a finite number');

/**
 * Row Number validation (positive integer)
 */
const rowNumberSchema = z
  .number()
  .int('Row number must be a whole number')
  .positive('Row number must be positive');

/**
 * Single Distribution Row Schema
 * Represents one row in the sorting distribution table
 */
export const distributionRowSchema = z
  .object({
    id: z.number().int().positive().optional(),
    rowNumber: rowNumberSchema.optional(),
    quantity: nonNegativeNumberSchema.default(0),
    percentage: percentageSchema.default(0),
    groupNumber: groupNumberSchema,
    distribution: nonNegativeNumberSchema.default(0),
    checked: z.boolean().default(false),
  })
  .strict()
  .refine(
    (data) => {
      // At least one field must have a value for a row to be valid
      return (
        data.quantity > 0 ||
        data.percentage > 0 ||
        data.groupNumber.trim() !== '' ||
        data.distribution > 0 ||
        data.checked
      );
    },
    {
      message: 'Row must have at least one non-zero/non-empty value',
    }
  );

/**
 * Sorting Distribution Request Schema
 * Used for POST requests to save distribution data
 */
export const sortingDistributionSchema = z
  .object({
    productCode: productCodeSchema,
    selectedQuantity: nonNegativeIntSchema.nullable().optional(),
    rows: z.array(distributionRowSchema).min(1, 'At least one row is required'),
  })
  .strict()
  .refine(
    (data) => {
      // If selectedQuantity is provided, validate distribution totals
      if (data.selectedQuantity && data.selectedQuantity > 0) {
        const totalDistribution = data.rows.reduce(
          (sum, row) => sum + row.distribution,
          0
        );
        // Allow some tolerance for floating point arithmetic (within 1%)
        const tolerance = data.selectedQuantity * 0.01;
        return Math.abs(totalDistribution - data.selectedQuantity) <= tolerance;
      }
      return true;
    },
    {
      message:
        'Total distribution must equal selected quantity (within 1% tolerance)',
      path: ['rows'],
    }
  )
  .refine(
    (data) => {
      // Sum of percentages should not exceed 100%
      const totalPercentage = data.rows.reduce(
        (sum, row) => sum + row.percentage,
        0
      );
      return totalPercentage <= 100.1; // Allow small floating point tolerance
    },
    {
      message: 'Total percentages must not exceed 100%',
      path: ['rows'],
    }
  );

/**
 * Database Record Schema (for Prisma operations)
 */
export const distributionDbSchema = z.object({
  id: z.number().int().positive().optional(),
  productCode: z.string().min(1).max(100),
  selectedQuantity: z.number().int().nullable().optional(),
  rowNumber: z.number().int().positive(),
  quantity: nonNegativeNumberSchema,
  percentage: percentageSchema,
  groupNumber: z.string().max(50),
  distribution: nonNegativeNumberSchema,
  checked: z.boolean(),
});

/**
 * Bulk Distribution Schema (array validation)
 * For bulk operations on multiple product distributions
 */
export const bulkDistributionSchema = z
  .array(sortingDistributionSchema)
  .min(1, 'At least one distribution is required')
  .max(100, 'Maximum 100 product distributions per request');

/**
 * Type exports for TypeScript usage
 */
export type DistributionRowInput = z.infer<typeof distributionRowSchema>;
export type SortingDistributionInput = z.infer<
  typeof sortingDistributionSchema
>;
export type DistributionDbInput = z.infer<typeof distributionDbSchema>;

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
 * Validation helper: Check for duplicate row numbers
 */
export function detectDuplicateRowNumbers(
  rows: Array<{ rowNumber?: number }>
): Array<{ rowNumber: number; count: number }> {
  const rowMap = new Map<number, number>();

  rows.forEach((row) => {
    if (row.rowNumber !== undefined) {
      rowMap.set(row.rowNumber, (rowMap.get(row.rowNumber) || 0) + 1);
    }
  });

  const duplicates: Array<{ rowNumber: number; count: number }> = [];

  Array.from(rowMap.entries()).forEach(([rowNumber, count]) => {
    if (count > 1) {
      duplicates.push({ rowNumber, count });
    }
  });

  return duplicates;
}

/**
 * Calculate distribution metrics
 */
export function calculateDistributionMetrics(rows: DistributionRowInput[]): {
  totalQuantity: number;
  totalPercentage: number;
  totalDistribution: number;
  checkedCount: number;
  groupCount: number;
} {
  const uniqueGroups = new Set(
    rows.map((r) => r.groupNumber).filter((g) => g && g.trim() !== '')
  );

  return {
    totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
    totalPercentage: rows.reduce((sum, row) => sum + row.percentage, 0),
    totalDistribution: rows.reduce((sum, row) => sum + row.distribution, 0),
    checkedCount: rows.filter((row) => row.checked).length,
    groupCount: uniqueGroups.size,
  };
}
