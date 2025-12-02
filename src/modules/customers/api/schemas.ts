import type { z } from 'zod';
import {
  customerDataSchema as baseCustomerDataSchema,
  partialCustomerDataSchema as basePartialCustomerDataSchema,
  bulkCustomerSchema as baseBulkCustomerSchema,
  customerQuerySchema as baseCustomerQuerySchema,
  customerAdditionalInfoSchema as baseAdditionalInfoSchema,
  customerAdditionalInfoAddSchema as baseAdditionalInfoAddSchema,
  formatValidationErrors as formatCustomerValidationErrors,
} from '@/lib/validations/customer.validation';

export const customerRecordSchema = baseCustomerDataSchema;
export const partialCustomerRecordSchema = basePartialCustomerDataSchema;
export const bulkCustomerRecordSchema = baseBulkCustomerSchema;
export const customerQuerySchema = baseCustomerQuerySchema;
export const customerAdditionalInfoSchema = baseAdditionalInfoSchema;
export const customerAdditionalInfoAddSchema = baseAdditionalInfoAddSchema;
export const mapCustomerValidationErrors = formatCustomerValidationErrors;

export type CustomerRecordInput = z.infer<typeof customerRecordSchema>;
export type PartialCustomerRecordInput = z.infer<
  typeof partialCustomerRecordSchema
>;
export type BulkCustomerRecordInput = z.infer<typeof bulkCustomerRecordSchema>;
export type CustomerQueryInput = z.infer<typeof customerQuerySchema>;
export type CustomerAdditionalInfoInput = z.infer<
  typeof customerAdditionalInfoSchema
>;
export type CustomerAdditionalInfoAddInput = z.infer<
  typeof customerAdditionalInfoAddSchema
>;
