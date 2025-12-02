import type { z } from 'zod';
import {
  priceDataSchema as basePriceDataSchema,
  priceDbSchema as basePriceDbSchema,
  bulkPriceSchema as baseBulkPriceSchema,
  formatValidationErrors as formatPriceValidationErrors,
  detectOverlappingTiers as detectPriceTierConflicts,
} from '@/lib/validations/price.validation';

export const priceRecordSchema = basePriceDataSchema;
export const priceDatabaseSchema = basePriceDbSchema;
export const bulkPriceRecordSchema = baseBulkPriceSchema;
export const mapPriceValidationErrors = formatPriceValidationErrors;
export const findOverlappingPriceTiers = detectPriceTierConflicts;

export type PriceRecordInput = z.infer<typeof priceRecordSchema>;
export type PriceDatabaseRecordInput = z.infer<typeof priceDatabaseSchema>;
export type BulkPriceRecordInput = z.infer<typeof bulkPriceRecordSchema>;
