/**
 * CheckoutLinks API Schemas
 */

import { z } from 'zod';

export const CreateCheckoutLinksSchema = z.object({
  weight: z.string().min(1, 'Weight is required'),
  width: z.string().min(1, 'Width is required'),
  length: z.string().min(1, 'Length is required'),
  height: z.string().min(1, 'Height is required'),
  checkoutLinks: z.string().optional().nullable(),
  productPortals: z.string().optional().nullable(),
  productNames: z.string().min(1, 'Product names is required'),
});

export const BulkCreateCheckoutLinksSchema = z.object({
  items: z.array(CreateCheckoutLinksSchema),
});

export const UpdateCheckoutLinksSchema = CreateCheckoutLinksSchema.partial();

export const CheckoutLinksQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});

export type CreateCheckoutLinksInput = z.infer<
  typeof CreateCheckoutLinksSchema
>;
export type BulkCreateCheckoutLinksInput = z.infer<
  typeof BulkCreateCheckoutLinksSchema
>;
export type UpdateCheckoutLinksInput = z.infer<
  typeof UpdateCheckoutLinksSchema
>;
export type CheckoutLinksQuery = z.infer<typeof CheckoutLinksQuerySchema>;
