import { z } from 'zod';

/**
 * Shipment Validation Schema
 *
 * Comprehensive validation for shipment/delivery data
 * Tracks shipment status, quantities, weights, and delivery dates
 */

/**
 * Shipment Status validation
 */
const shipmentStatusSchema = z.enum(
  ['Pending', 'In Transit', 'Delivered', 'Cancelled', 'Processing', 'On Hold'],
  {
    errorMap: () => ({
      message:
        'Shipment status must be one of: Pending, In Transit, Delivered, Cancelled, Processing, or On Hold',
    }),
  }
);

/**
 * Shipment Code validation (required field)
 */
const shipmentCodeSchema = z
  .string()
  .trim()
  .min(1, 'Shipment code is required')
  .max(100, 'Shipment code must not exceed 100 characters');

/**
 * Non-negative number validation
 */
const nonNegativeNumberSchema = z
  .number()
  .min(0, 'Value must be non-negative')
  .finite('Value must be a finite number');

/**
 * Non-negative integer validation (for sacks count)
 */
const nonNegativeIntSchema = z
  .number()
  .int('Must be a whole number')
  .min(0, 'Value must be non-negative');

/**
 * Optional string field validation
 */
const optionalStringSchema = z.string().trim().max(500).nullable().optional();

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
 * Duration string validation (e.g., "3 days", "1 week")
 */
const durationSchema = z.string().trim().max(20).nullable().optional();

/**
 * Shipment Data Schema (Frontend field names)
 * Used for validating data from CSV imports and API requests
 */
export const shipmentDataSchema = z
  .object({
    id: z.number().int().positive().optional(),
    'Shipment Code': shipmentCodeSchema,
    'CV Number': shortStringSchema,
    'No. Of Sacks': nonNegativeIntSchema,
    'Total CBM': nonNegativeNumberSchema,
    Weight: nonNegativeNumberSchema,
    Fee: nonNegativeNumberSchema,
    'Shipment Status': z
      .union([shipmentStatusSchema, z.literal(''), z.null()])
      .optional(),
    'Date Created': dateStringSchema,
    'Date Delivered': dateStringSchema,
    Duration: durationSchema,
    Notes: optionalStringSchema,
  })
  .strict()
  .refine(
    (data) => {
      const created = data['Date Created'];
      const delivered = data['Date Delivered'];

      // If both dates exist, delivered must be after created
      if (created && delivered) {
        return delivered >= created;
      }
      return true;
    },
    {
      message: 'Date Delivered must be after Date Created',
      path: ['Date Delivered'],
    }
  );

/**
 * Shipment Database Schema (Database field names)
 */
export const shipmentDbSchema = z
  .object({
    id: z.number().int().positive().optional(),
    shipmentCode: z.string().min(1).max(100),
    cvNumber: z.string().max(100).nullable().optional(),
    noOfSacks: nonNegativeIntSchema,
    totalCBM: nonNegativeNumberSchema,
    weight: nonNegativeNumberSchema,
    fee: nonNegativeNumberSchema,
    shipmentStatus: z.string().min(1).max(100),
    dateCreated: z.string().max(50).nullable().optional(),
    dateDelivered: z.string().max(50).nullable().optional(),
    duration: z.string().max(20).nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

/**
 * Bulk Shipment Schema (array validation)
 * Limits batch size to prevent timeouts
 */
export const bulkShipmentSchema = z
  .array(shipmentDataSchema)
  .min(1, 'At least one shipment is required')
  .max(1000, 'Maximum 1000 shipments per request');

/**
 * Type exports for TypeScript usage
 */
export type ShipmentDataInput = z.infer<typeof shipmentDataSchema>;
export type ShipmentDbInput = z.infer<typeof shipmentDbSchema>;

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
 * Validation helper: Check for duplicate shipment codes
 */
export function detectDuplicateShipmentCodes(
  shipments: Array<{ 'Shipment Code': string }>
): Array<{ code: string; count: number; rows: number[] }> {
  const codeMap = new Map<string, number[]>();

  shipments.forEach((shipment, index) => {
    const code = shipment['Shipment Code'].trim();
    if (!codeMap.has(code)) {
      codeMap.set(code, []);
    }
    const rows = codeMap.get(code);
    if (rows) {
      rows.push(index + 1);
    }
  });

  const duplicates: Array<{ code: string; count: number; rows: number[] }> = [];

  Array.from(codeMap.entries()).forEach(([code, rows]) => {
    if (rows.length > 1) {
      duplicates.push({
        code,
        count: rows.length,
        rows,
      });
    }
  });

  return duplicates;
}
