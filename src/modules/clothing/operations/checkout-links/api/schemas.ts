/**
 * CheckoutLinks API Schemas
 */

import { z } from 'zod';

export const CreateCheckoutLinksSchema = z.object({
  // Add your validation rules here
  // Example:
  // name: z.string().min(1, 'Name is required'),
  // amount: z.number().positive('Amount must be positive'),
});

export const UpdateCheckoutLinksSchema = CreateCheckoutLinksSchema.partial();

export const CheckoutLinksQuerySchema = z.object({
  // Add your query parameters here
  // Example:
  // status: z.enum(['active', 'inactive']).optional(),
  // startDate: z.string().datetime().optional(),
});

export type CreateCheckoutLinksInput = z.infer<
  typeof CreateCheckoutLinksSchema
>;
export type UpdateCheckoutLinksInput = z.infer<
  typeof UpdateCheckoutLinksSchema
>;
export type CheckoutLinksQuery = z.infer<typeof CheckoutLinksQuerySchema>;
