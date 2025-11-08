/**
 * CheckoutLinks API Schemas
 */

import { z } from 'zod';

export const CreateCheckoutLinksSchema = z.object({
  weight: z.string(),
  width: z.string(),
  length: z.string(),
  height: z.string(),
  checkoutLinks: z.string().optional().nullable(),
  productPortals: z.string().optional().nullable(),
  productNames: z.string().optional().nullable(),
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

export const CreateItemWeightSchema = z.object({
  itemName: z.string().min(1),
  bulkQuantity: z.number().positive(),
  bulkWeight: z.number().positive(),
});

export const ItemWeightsQuerySchema = z.object({
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
export type CreateItemWeightInput = z.infer<typeof CreateItemWeightSchema>;
export type ItemWeightsQuery = z.infer<typeof ItemWeightsQuerySchema>;
