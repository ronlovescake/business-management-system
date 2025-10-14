import { z } from 'zod';

/**
 * Transaction Validation Schema
 * 
 * Comprehensive validation for transaction data with business rules
 */

/**
 * Date validation (ISO format or empty string)
 */
const dateSchema = z
  .string()
  .refine(
    (val) => {
      if (val === '') {
        return true;
      }
      // Check ISO date format or YYYY-MM-DD
      return /^\d{4}-\d{2}-\d{2}/.test(val) || !isNaN(Date.parse(val));
    },
    {
      message: 'Invalid date format. Use YYYY-MM-DD or ISO format',
    }
  );

/**
 * Product Code validation
 */
const productCodeSchema = z
  .string()
  .trim()
  .min(1, 'Product code is required')
  .max(50, 'Product code must not exceed 50 characters')
  .refine((val) => /^[A-Z0-9-_]+$/i.test(val), {
    message: 'Product code must contain only letters, numbers, dashes, and underscores',
  });

/**
 * Customer Name validation
 */
const customerNameSchema = z
  .string()
  .trim()
  .min(1, 'Customer name is required')
  .max(100, 'Customer name must not exceed 100 characters');

/**
 * Quantity validation
 */
const quantitySchema = z
  .number()
  .int('Quantity must be a whole number')
  .nonnegative('Quantity cannot be negative')
  .or(z.null())
  .refine((val) => val === null || val >= 0, {
    message: 'Quantity must be zero or positive',
  });

/**
 * Price validation (Unit Price, Discount, Adjustment)
 */
const priceSchema = z
  .number()
  .nonnegative('Price cannot be negative')
  .finite('Price must be a finite number')
  .or(z.null())
  .refine((val) => val === null || val >= 0, {
    message: 'Price must be zero or positive',
  });

/**
 * Line Total validation
 */
const lineTotalSchema = z
  .number()
  .finite('Line total must be a finite number')
  .or(z.null());

/**
 * Order Status validation
 */
const orderStatusSchema = z
  .string()
  .trim()
  .max(50, 'Order status must not exceed 50 characters');

/**
 * Notes validation
 */
const notesSchema = z
  .string()
  .trim()
  .max(1000, 'Notes must not exceed 1000 characters');

/**
 * Shipment Code validation
 */
const shipmentCodeSchema = z
  .string()
  .trim()
  .max(50, 'Shipment code must not exceed 50 characters');

/**
 * Base Transaction Data Schema (without refinements)
 */
const baseTransactionDataSchema = z.object({
  id: z.number().int().positive().optional(),
  'Order Date': dateSchema,
  Customers: customerNameSchema,
  'Product Code': productCodeSchema,
  Quantity: quantitySchema,
  'Unit Price': priceSchema,
  Discount: priceSchema,
  Adjustment: priceSchema,
  'Line Total': lineTotalSchema,
  'Order Status': orderStatusSchema,
  Notes: notesSchema,
  'Invoice Date': dateSchema,
  'Packed Date': dateSchema,
  'Shipment Code': shipmentCodeSchema,
});

/**
 * Transaction Data Schema (with business rule refinements)
 * Used for validating full transaction data
 */
export const transactionDataSchema = baseTransactionDataSchema
  .refine(
    (data) => {
      // Business Rule: If quantity and unit price are provided, line total should match
      if (
        data.Quantity !== null &&
        data['Unit Price'] !== null &&
        data['Line Total'] !== null
      ) {
        const quantity = data.Quantity;
        const unitPrice = data['Unit Price'];
        const discount = data.Discount || 0;
        const adjustment = data.Adjustment || 0;

        const expectedTotal = quantity * unitPrice - discount + adjustment;
        const actualTotal = data['Line Total'];

        // Allow small floating point differences (within 0.01)
        return Math.abs(expectedTotal - actualTotal) < 0.01;
      }
      return true;
    },
    {
      message: 'Line total does not match calculation: (Quantity × Unit Price) - Discount + Adjustment',
      path: ['Line Total'],
    }
  )
  .refine(
    (data) => {
      // Business Rule: If invoice date is provided, it should not be before order date
      if (data['Order Date'] && data['Invoice Date'] && data['Invoice Date'] !== '') {
        const orderDate = new Date(data['Order Date']);
        const invoiceDate = new Date(data['Invoice Date']);
        return invoiceDate >= orderDate;
      }
      return true;
    },
    {
      message: 'Invoice date cannot be before order date',
      path: ['Invoice Date'],
    }
  )
  .refine(
    (data) => {
      // Business Rule: If packed date is provided, it should not be before order date
      if (data['Order Date'] && data['Packed Date'] && data['Packed Date'] !== '') {
        const orderDate = new Date(data['Order Date']);
        const packedDate = new Date(data['Packed Date']);
        return packedDate >= orderDate;
      }
      return true;
    },
    {
      message: 'Packed date cannot be before order date',
      path: ['Packed Date'],
    }
  );

/**
 * Partial Transaction Data Schema (for updates)
 * Uses base schema without refinements for flexibility
 */
export const partialTransactionDataSchema = baseTransactionDataSchema.partial();

/**
 * Transaction Form Data Schema
 * For form inputs with camelCase field names
 */
export const transactionFormSchema = z
  .object({
    orderDate: dateSchema,
    customers: customerNameSchema,
    productCode: productCodeSchema,
    quantity: quantitySchema,
    unitPrice: priceSchema,
    discount: priceSchema,
    adjustment: priceSchema,
    lineTotal: lineTotalSchema,
    orderStatus: orderStatusSchema,
    notes: notesSchema,
    invoiceDate: dateSchema,
    packedDate: dateSchema,
    shipmentCode: shipmentCodeSchema,
  })
  .refine(
    (data) => {
      // Same business rules as transactionDataSchema
      if (
        data.quantity !== null &&
        data.unitPrice !== null &&
        data.lineTotal !== null
      ) {
        const quantity = data.quantity;
        const unitPrice = data.unitPrice;
        const discount = data.discount || 0;
        const adjustment = data.adjustment || 0;

        const expectedTotal = quantity * unitPrice - discount + adjustment;
        const actualTotal = data.lineTotal;

        return Math.abs(expectedTotal - actualTotal) < 0.01;
      }
      return true;
    },
    {
      message: 'Line total does not match calculation',
      path: ['lineTotal'],
    }
  );

/**
 * Bulk Transaction Import Schema
 */
export const bulkTransactionSchema = z
  .array(transactionDataSchema)
  .min(1, {
    message: 'At least one transaction is required for bulk import',
  })
  .max(10000, {
    message: 'Bulk import cannot exceed 10,000 transactions',
  });

/**
 * Transaction Query Parameters Schema
 */
export const transactionQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  search: z.string().max(200).optional(),
  status: z.string().max(50).optional(),
  customer: z.string().max(100).optional(),
  productCode: z.string().max(50).optional(),
  fromDate: dateSchema.optional(),
  toDate: dateSchema.optional(),
  sortBy: z
    .enum([
      'Order Date',
      'Customers',
      'Product Code',
      'Quantity',
      'Line Total',
      'Order Status',
    ])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * Price Tier Schema
 */
export const priceTierSchema = z.object({
  'Product Code': productCodeSchema,
  'Lower Limit': z.number().int().nonnegative(),
  'Upper Limit': z.number().int().nonnegative(),
  Prices: z.number().nonnegative(),
});

/**
 * Type inference from schemas
 */
export type TransactionDataInput = z.infer<typeof transactionDataSchema>;
export type PartialTransactionDataInput = z.infer<typeof partialTransactionDataSchema>;
export type TransactionFormInput = z.infer<typeof transactionFormSchema>;
export type BulkTransactionInput = z.infer<typeof bulkTransactionSchema>;
export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
export type PriceTierInput = z.infer<typeof priceTierSchema>;

/**
 * Validation helper functions
 */

/**
 * Validate transaction data
 */
export function validateTransactionData(data: unknown) {
  return transactionDataSchema.safeParse(data);
}

/**
 * Validate partial transaction data (for updates)
 */
export function validatePartialTransactionData(data: unknown) {
  return partialTransactionDataSchema.safeParse(data);
}

/**
 * Validate transaction form data
 */
export function validateTransactionForm(data: unknown) {
  return transactionFormSchema.safeParse(data);
}

/**
 * Validate bulk transaction import
 */
export function validateBulkTransactions(data: unknown) {
  return bulkTransactionSchema.safeParse(data);
}

/**
 * Validate transaction query parameters
 */
export function validateTransactionQuery(data: unknown) {
  return transactionQuerySchema.safeParse(data);
}

/**
 * Validate price tier data
 */
export function validatePriceTier(data: unknown) {
  return priceTierSchema.safeParse(data);
}

/**
 * Format Zod validation errors for user-friendly display
 */
export function formatValidationErrors(errors: z.ZodError): Record<string, string> {
  const formattedErrors: Record<string, string> = {};

  errors.errors.forEach((error) => {
    const path = error.path.join('.');
    formattedErrors[path] = error.message;
  });

  return formattedErrors;
}

/**
 * Calculate line total from transaction fields
 */
export function calculateLineTotal(
  quantity: number | null,
  unitPrice: number | null,
  discount: number | null,
  adjustment: number | null
): number | null {
  if (quantity === null || unitPrice === null) {
    return null;
  }

  const discountValue = discount || 0;
  const adjustmentValue = adjustment || 0;

  return quantity * unitPrice - discountValue + adjustmentValue;
}

/**
 * Validate and auto-calculate line total
 */
export function validateAndCalculateLineTotal(data: unknown) {
  const result = transactionDataSchema.safeParse(data);

  if (!result.success) {
    return result;
  }

  // Auto-calculate line total if not provided
  if (result.data['Line Total'] === null) {
    const calculated = calculateLineTotal(
      result.data.Quantity,
      result.data['Unit Price'],
      result.data.Discount,
      result.data.Adjustment
    );

    return {
      success: true as const,
      data: {
        ...result.data,
        'Line Total': calculated,
      },
    };
  }

  return result;
}

/**
 * Advanced transaction validation with business rules
 */
export function validateTransactionWithBusinessRules(data: unknown) {
  const result = transactionDataSchema.safeParse(data);

  if (!result.success) {
    return result;
  }

  const customErrors: z.ZodIssue[] = [];

  // Business Rule: Discount should not exceed line total
  if (
    result.data.Discount !== null &&
    result.data['Line Total'] !== null &&
    result.data.Discount > result.data['Line Total']
  ) {
    customErrors.push({
      code: 'custom',
      path: ['Discount'],
      message: 'Discount cannot exceed line total',
    });
  }

  // Business Rule: Quantity should be reasonable (not more than 100,000)
  if (result.data.Quantity !== null && result.data.Quantity > 100000) {
    customErrors.push({
      code: 'custom',
      path: ['Quantity'],
      message: 'Quantity seems unusually high. Please verify.',
    });
  }

  // Business Rule: Unit price should be reasonable (not more than $100,000)
  if (result.data['Unit Price'] !== null && result.data['Unit Price'] > 100000) {
    customErrors.push({
      code: 'custom',
      path: ['Unit Price'],
      message: 'Unit price seems unusually high. Please verify.',
    });
  }

  if (customErrors.length > 0) {
    return {
      success: false as const,
      error: new z.ZodError(customErrors),
    };
  }

  return result;
}
