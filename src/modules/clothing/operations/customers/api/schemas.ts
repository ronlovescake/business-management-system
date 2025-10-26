/**
 * Customer Validation Schemas
 *
 * Zod schemas for customer data validation
 */

import { z } from 'zod';

/**
 * Customer status enum
 */
export const CustomerStatusSchema = z.enum([
  'active',
  'inactive',
  'pending',
  'suspended',
]);
export type CustomerStatus = z.infer<typeof CustomerStatusSchema>;

/**
 * Schema for creating a new customer
 */
export const CustomerCreateSchema = z.object({
  date: z.string().max(50),
  customerName: z.string().min(1, 'Customer name is required').max(255),
  phoneNumber: z.string().max(100),
  address: z.string().max(500),
  facebook: z.string().max(255),
  emailAddress: z.string().email('Invalid email').max(255),
  businessName: z.string().max(255),
  taxNumber: z.string().max(100),
  businessAddress: z.string().max(500),
  businessContactNumber: z.string().max(100),
  customerStatus: CustomerStatusSchema.default('active'),
});

export type CustomerCreateInput = z.infer<typeof CustomerCreateSchema>;

/**
 * Schema for updating a customer
 */
export const CustomerUpdateSchema = CustomerCreateSchema.partial().extend({
  id: z.number().int().positive(),
});

export type CustomerUpdateInput = z.infer<typeof CustomerUpdateSchema>;

/**
 * Schema for batch create
 */
export const CustomerBatchCreateSchema = z
  .array(CustomerCreateSchema)
  .max(10000);

/**
 * Query filters schema
 */
export const CustomerQuerySchema = z.object({
  customerName: z.string().optional(),
  phoneNumber: z.string().optional(),
  customerStatus: CustomerStatusSchema.optional(),
  businessName: z.string().optional(),
});

export type CustomerQuery = z.infer<typeof CustomerQuerySchema>;
