import { z } from 'zod';

/**
 * Product and Price Validation Schemas
 * 
 * Comprehensive validation for product and price data with proper constraints
 */

// ============================================================================
// PRODUCT VALIDATION SCHEMAS
// ============================================================================

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
 * Shipment Code validation
 */
const shipmentCodeSchema = z
  .string()
  .trim()
  .max(50, 'Shipment code must not exceed 50 characters');

/**
 * Quantity validation
 */
const quantitySchema = z
  .number()
  .int('Quantity must be a whole number')
  .nonnegative('Quantity cannot be negative')
  .max(1000000, 'Quantity cannot exceed 1,000,000');

/**
 * Date validation
 */
const dateSchema = z
  .string()
  .refine(
    (val) => {
      if (val === '') {
        return true;
      }
      return /^\d{4}-\d{2}-\d{2}/.test(val) || !isNaN(Date.parse(val));
    },
    {
      message: 'Invalid date format. Use YYYY-MM-DD or ISO format',
    }
  );

/**
 * Product Data Schema
 */
export const productDataSchema = z.object({
  id: z.number().int().positive().optional(),
  'Product Code': productCodeSchema,
  'Shipment Code': shipmentCodeSchema,
  'Ordered Quantity': quantitySchema,
  'Quantity per Dozen': quantitySchema,
  'Date Created': dateSchema,
});

/**
 * Partial Product Data Schema (for updates)
 */
export const partialProductDataSchema = productDataSchema.partial();

/**
 * Product Form Data Schema
 */
export const productFormSchema = z.object({
  productCode: productCodeSchema,
  shipmentCode: shipmentCodeSchema,
  orderedQuantity: quantitySchema,
  quantityPerDozen: quantitySchema,
  dateCreated: dateSchema,
});

/**
 * Bulk Product Import Schema
 */
export const bulkProductSchema = z
  .array(productDataSchema)
  .min(1, {
    message: 'At least one product is required for bulk import',
  })
  .max(50000, {
    message: 'Bulk import cannot exceed 50,000 products',
  });

/**
 * Product Query Parameters Schema
 */
export const productQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  search: z.string().max(200).optional(),
  productCode: z.string().max(50).optional(),
  shipmentCode: z.string().max(50).optional(),
  sortBy: z
    .enum(['Product Code', 'Shipment Code', 'Ordered Quantity', 'Date Created'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ============================================================================
// PRICE VALIDATION SCHEMAS
// ============================================================================

/**
 * Price value validation
 */
const priceValueSchema = z
  .number()
  .nonnegative('Price cannot be negative')
  .finite('Price must be a finite number')
  .max(1000000, 'Price cannot exceed 1,000,000')
  .refine((val) => {
    // Ensure max 2 decimal places for currency
    const decimalPlaces = (val.toString().split('.')[1] || '').length;
    return decimalPlaces <= 2;
  }, {
    message: 'Price must have at most 2 decimal places',
  });

/**
 * Quantity limit validation
 */
const quantityLimitSchema = z
  .number()
  .int('Quantity limit must be a whole number')
  .nonnegative('Quantity limit cannot be negative')
  .max(1000000, 'Quantity limit cannot exceed 1,000,000');

/**
 * Price Tier Data Schema
 */
export const priceTierDataSchema = z
  .object({
    id: z.number().int().positive().optional(),
    'Product Code': productCodeSchema,
    'Lower Limit': quantityLimitSchema,
    'Upper Limit': quantityLimitSchema,
    Prices: priceValueSchema,
  })
  .refine(
    (data) => {
      // Business Rule: Upper limit must be greater than lower limit
      return data['Upper Limit'] >= data['Lower Limit'];
    },
    {
      message: 'Upper limit must be greater than or equal to lower limit',
      path: ['Upper Limit'],
    }
  )
  .refine(
    (data) => {
      // Business Rule: Lower limit cannot be 0 if upper limit is also 0
      if (data['Lower Limit'] === 0 && data['Upper Limit'] === 0) {
        return false;
      }
      return true;
    },
    {
      message: 'Both limits cannot be zero',
      path: ['Lower Limit'],
    }
  );

/**
 * Partial Price Tier Data Schema (for updates)
 */
const basePriceTierSchema = z.object({
  id: z.number().int().positive().optional(),
  'Product Code': productCodeSchema,
  'Lower Limit': quantityLimitSchema,
  'Upper Limit': quantityLimitSchema,
  Prices: priceValueSchema,
});

export const partialPriceTierDataSchema = basePriceTierSchema.partial();

/**
 * Price Tier Form Data Schema
 */
export const priceTierFormSchema = z
  .object({
    productCode: productCodeSchema,
    lowerLimit: quantityLimitSchema,
    upperLimit: quantityLimitSchema,
    prices: priceValueSchema,
  })
  .refine(
    (data) => {
      return data.upperLimit >= data.lowerLimit;
    },
    {
      message: 'Upper limit must be greater than or equal to lower limit',
      path: ['upperLimit'],
    }
  );

/**
 * Bulk Price Tier Import Schema
 */
export const bulkPriceTierSchema = z
  .array(priceTierDataSchema)
  .min(1, {
    message: 'At least one price tier is required for bulk import',
  })
  .max(100000, {
    message: 'Bulk import cannot exceed 100,000 price tiers',
  })
  .refine(
    (data) => {
      // Business Rule: Check for overlapping quantity ranges for same product
      const productRanges = new Map<string, Array<[number, number]>>();

      for (const tier of data) {
        const code = tier['Product Code'];
        const lower = tier['Lower Limit'];
        const upper = tier['Upper Limit'];

        if (!productRanges.has(code)) {
          productRanges.set(code, []);
        }

        const ranges = productRanges.get(code);
        if (!ranges) {
          continue;
        }
        
        // Check for overlaps with existing ranges
        for (const [existingLower, existingUpper] of ranges) {
          // Check if ranges overlap
          if (
            (lower >= existingLower && lower <= existingUpper) ||
            (upper >= existingLower && upper <= existingUpper) ||
            (lower <= existingLower && upper >= existingUpper)
          ) {
            return false;
          }
        }

        ranges.push([lower, upper]);
      }

      return true;
    },
    {
      message: 'Price tiers have overlapping quantity ranges for the same product',
    }
  );

/**
 * Price Query Parameters Schema
 */
export const priceQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
  search: z.string().max(200).optional(),
  productCode: z.string().max(50).optional(),
  minPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
  maxPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).transform(Number).optional(),
  sortBy: z
    .enum(['Product Code', 'Lower Limit', 'Upper Limit', 'Prices'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

// ============================================================================
// TYPE INFERENCE
// ============================================================================

export type ProductDataInput = z.infer<typeof productDataSchema>;
export type PartialProductDataInput = z.infer<typeof partialProductDataSchema>;
export type ProductFormInput = z.infer<typeof productFormSchema>;
export type BulkProductInput = z.infer<typeof bulkProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;

export type PriceTierDataInput = z.infer<typeof priceTierDataSchema>;
export type PartialPriceTierDataInput = z.infer<typeof partialPriceTierDataSchema>;
export type PriceTierFormInput = z.infer<typeof priceTierFormSchema>;
export type BulkPriceTierInput = z.infer<typeof bulkPriceTierSchema>;
export type PriceQueryInput = z.infer<typeof priceQuerySchema>;

// ============================================================================
// VALIDATION HELPER FUNCTIONS
// ============================================================================

/**
 * Product validation helpers
 */
export function validateProductData(data: unknown) {
  return productDataSchema.safeParse(data);
}

export function validatePartialProductData(data: unknown) {
  return partialProductDataSchema.safeParse(data);
}

export function validateProductForm(data: unknown) {
  return productFormSchema.safeParse(data);
}

export function validateBulkProducts(data: unknown) {
  return bulkProductSchema.safeParse(data);
}

export function validateProductQuery(data: unknown) {
  return productQuerySchema.safeParse(data);
}

/**
 * Price validation helpers
 */
export function validatePriceTierData(data: unknown) {
  return priceTierDataSchema.safeParse(data);
}

export function validatePartialPriceTierData(data: unknown) {
  return partialPriceTierDataSchema.safeParse(data);
}

export function validatePriceTierForm(data: unknown) {
  return priceTierFormSchema.safeParse(data);
}

export function validateBulkPriceTiers(data: unknown) {
  return bulkPriceTierSchema.safeParse(data);
}

export function validatePriceQuery(data: unknown) {
  return priceQuerySchema.safeParse(data);
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
 * Find applicable price tier for a given quantity
 */
export function findPriceTierForQuantity(
  priceTiers: PriceTierDataInput[],
  productCode: string,
  quantity: number
): PriceTierDataInput | null {
  const applicableTiers = priceTiers.filter(
    (tier) =>
      tier['Product Code'] === productCode &&
      quantity >= tier['Lower Limit'] &&
      quantity <= tier['Upper Limit']
  );

  if (applicableTiers.length === 0) {
    return null;
  }

  // Return the most specific tier (narrowest range)
  return applicableTiers.reduce((mostSpecific, current) => {
    const currentRange = current['Upper Limit'] - current['Lower Limit'];
    const specificRange = mostSpecific['Upper Limit'] - mostSpecific['Lower Limit'];
    return currentRange < specificRange ? current : mostSpecific;
  });
}

/**
 * Validate price tier consistency for a product
 */
export function validatePriceTierConsistency(priceTiers: PriceTierDataInput[]) {
  const customErrors: z.ZodIssue[] = [];

  // Group by product code
  const productGroups = new Map<string, PriceTierDataInput[]>();

  priceTiers.forEach((tier) => {
    const code = tier['Product Code'];
    if (!productGroups.has(code)) {
      productGroups.set(code, []);
    }
    const group = productGroups.get(code);
    if (group) {
      group.push(tier);
    }
  });

  // Check each product's tiers
  productGroups.forEach((tiers, productCode) => {
    // Sort by lower limit
    const sortedTiers = [...tiers].sort((a, b) => a['Lower Limit'] - b['Lower Limit']);

    // Check for gaps in coverage
    for (let i = 0; i < sortedTiers.length - 1; i++) {
      const current = sortedTiers[i];
      const next = sortedTiers[i + 1];

      if (current['Upper Limit'] + 1 < next['Lower Limit']) {
        customErrors.push({
          code: 'custom',
          path: ['Product Code'],
          message: `Product ${productCode} has a gap in quantity coverage between ${current['Upper Limit']} and ${next['Lower Limit']}`,
        });
      }
    }
  });

  if (customErrors.length > 0) {
    return {
      success: false as const,
      error: new z.ZodError(customErrors),
    };
  }

  return {
    success: true as const,
    data: priceTiers,
  };
}
