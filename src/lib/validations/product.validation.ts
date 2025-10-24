import { z } from 'zod';

/**
 * Product Validation Schema
 *
 * Comprehensive validation for product data with proper error messages
 * Products have 30+ fields including inventory, pricing, and shipment tracking
 */

/**
 * Shipment Status validation
 */
const shipmentStatusSchema = z.enum(
  ['Pending', 'In Transit', 'Delivered', 'Cancelled', 'Processing'],
  {
    errorMap: () => ({
      message:
        'Shipment status must be one of: Pending, In Transit, Delivered, Cancelled, or Processing',
    }),
  }
);

/**
 * Product Code validation (required field)
 */
const productCodeSchema = z
  .string()
  .trim()
  .min(1, 'Product code is required')
  .max(100, 'Product code must not exceed 100 characters');

/**
 * Numeric field validation (non-negative)
 */
const nonNegativeNumberSchema = z
  .number()
  .min(0, 'Value must be non-negative')
  .finite('Value must be a finite number');

/**
 * String field validation (nullable)
 */
const nullableStringSchema = z.string().trim().max(500).nullable().optional();

/**
 * Short string field (max 100 chars)
 */
const shortStringSchema = z.string().trim().max(100).nullable().optional();

/**
 * Date string validation (YYYY-MM-DD format)
 */
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .nullable()
  .optional();

/**
 * Product Data Schema (Frontend field names)
 * Used for validating data from CSV imports and API requests
 */
export const productDataSchema = z.object({
  id: z.number().int().positive().optional(),
  'Shipment Code': shortStringSchema,
  'CV Number': shortStringSchema,
  'No. Of Sacks': nonNegativeNumberSchema,
  'Total CBM': nonNegativeNumberSchema,
  Weight: nonNegativeNumberSchema,
  'Shipment Status': z
    .union([shipmentStatusSchema, z.literal(''), z.null()])
    .optional(),
  'Posting Date': dateStringSchema,
  'Order Date': dateStringSchema,
  Payment: shortStringSchema,
  Product: nullableStringSchema,
  'Product Code': z.union([productCodeSchema, z.null()]).optional(),
  'Age Range': shortStringSchema,
  Unit: shortStringSchema,
  'Unit Price': nonNegativeNumberSchema,
  Quantity: nonNegativeNumberSchema,
  'Alibaba Shipping Cost': nonNegativeNumberSchema,
  'Exchange Rates': nonNegativeNumberSchema,
  PHP: nonNegativeNumberSchema,
  'Sub Total (PHP)': nonNegativeNumberSchema,
  'Transaction Fee': nonNegativeNumberSchema,
  'Grand Total': nonNegativeNumberSchema,
  "Forwarder's Fee": nonNegativeNumberSchema,
  Lalamove: nonNegativeNumberSchema,
  'Packaging Cost': nonNegativeNumberSchema,
  'Suggested Price': nonNegativeNumberSchema,
  'Actual Price': nonNegativeNumberSchema,
  'Base Price': nonNegativeNumberSchema,
  COGS: nonNegativeNumberSchema,
  'Projected Sales': nonNegativeNumberSchema,
  'Projected Profit': nonNegativeNumberSchema,
  'Projected Profit (%)': nonNegativeNumberSchema,
  'Total Markup': nonNegativeNumberSchema,
});

/**
 * Product Database Schema (Database field names)
 * Used for validating data before database insertion
 */
export const productDbSchema = z.object({
  id: z.number().int().positive().optional(),
  shipmentCode: shortStringSchema,
  cvNumber: shortStringSchema,
  noOfSacks: nonNegativeNumberSchema,
  totalCBM: nonNegativeNumberSchema,
  weight: nonNegativeNumberSchema,
  shipmentStatus: z
    .union([shipmentStatusSchema, z.literal(''), z.null()])
    .optional(),
  postingDate: dateStringSchema,
  orderDate: dateStringSchema,
  payment: shortStringSchema,
  product: nullableStringSchema,
  productCode: z.union([productCodeSchema, z.null()]).optional(),
  ageRange: shortStringSchema,
  unit: shortStringSchema,
  unitPrice: nonNegativeNumberSchema,
  quantity: nonNegativeNumberSchema,
  alibabaShippingCost: nonNegativeNumberSchema,
  exchangeRates: nonNegativeNumberSchema,
  php: nonNegativeNumberSchema,
  subTotalPHP: nonNegativeNumberSchema,
  transactionFee: nonNegativeNumberSchema,
  grandTotal: nonNegativeNumberSchema,
  forwardersFee: nonNegativeNumberSchema,
  lalamove: nonNegativeNumberSchema,
  packagingCost: nonNegativeNumberSchema,
  suggestedPrice: nonNegativeNumberSchema,
  actualPrice: nonNegativeNumberSchema,
  basePrice: nonNegativeNumberSchema,
  cogs: nonNegativeNumberSchema,
  projectedSales: nonNegativeNumberSchema,
  projectedProfit: nonNegativeNumberSchema,
  projectedProfitPercent: nonNegativeNumberSchema,
  totalMarkup: nonNegativeNumberSchema,
});

/**
 * Bulk Product Import Schema
 * Validates array of products for CSV import
 */
export const bulkProductSchema = z.array(productDataSchema).min(1, {
  message: 'At least one product is required for import',
});

/**
 * Type inference from schemas
 */
export type ProductDataInput = z.infer<typeof productDataSchema>;
export type ProductDbInput = z.infer<typeof productDbSchema>;
export type BulkProductInput = z.infer<typeof bulkProductSchema>;

/**
 * Validation helper functions
 */

/**
 * Validate product data (frontend format)
 */
export function validateProductData(data: unknown) {
  return productDataSchema.safeParse(data);
}

/**
 * Validate product data (database format)
 */
export function validateProductDb(data: unknown) {
  return productDbSchema.safeParse(data);
}

/**
 * Validate bulk product import
 */
export function validateBulkProducts(data: unknown) {
  return bulkProductSchema.safeParse(data);
}

/**
 * Format Zod validation errors for user-friendly display
 */
export function formatValidationErrors(
  errors: z.ZodError
): Record<string, string> {
  const formattedErrors: Record<string, string> = {};

  errors.errors.forEach((error) => {
    const path = error.path.join('.');
    formattedErrors[path] = error.message;
  });

  return formattedErrors;
}

/**
 * Validate business rules for products
 */
export function validateProductBusinessRules(data: ProductDataInput) {
  const errors: z.ZodIssue[] = [];

  // Rule 1: Quantity must be positive if product code exists
  if (data['Product Code'] && data.Quantity === 0) {
    errors.push({
      code: 'custom',
      path: ['Quantity'],
      message: 'Quantity must be greater than 0 when product code is specified',
    });
  }

  // Rule 2: Unit price should be set if quantity exists
  if (data.Quantity > 0 && data['Unit Price'] === 0) {
    errors.push({
      code: 'custom',
      path: ['Unit Price'],
      message: 'Unit price should be set when quantity is greater than 0',
    });
  }

  // Rule 3: COGS should not exceed actual price
  if (data['Actual Price'] > 0 && data.COGS > data['Actual Price']) {
    errors.push({
      code: 'custom',
      path: ['COGS'],
      message: 'Cost of goods sold (COGS) should not exceed actual price',
    });
  }

  // Rule 4: Projected profit should match calculation (if both present)
  if (data['Projected Sales'] > 0 && data.COGS > 0) {
    const calculatedProfit = data['Projected Sales'] - data.COGS;
    const providedProfit = data['Projected Profit'] || 0;

    // Allow 1% tolerance for rounding
    const tolerance = Math.abs(calculatedProfit) * 0.01;
    if (Math.abs(calculatedProfit - providedProfit) > tolerance) {
      errors.push({
        code: 'custom',
        path: ['Projected Profit'],
        message: `Projected profit (${providedProfit}) doesn't match calculation (${calculatedProfit.toFixed(2)})`,
      });
    }
  }

  if (errors.length > 0) {
    return {
      success: false as const,
      error: new z.ZodError(errors),
    };
  }

  return { success: true as const, data };
}
