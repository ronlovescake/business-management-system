import { z } from 'zod';

export const transactionDataSchema = z.object({
  'Order Date': z.string().min(1).max(50),
  Customers: z.string().min(1).max(255),
  'Product Code': z.string().min(1).max(100),
  Quantity: z.number().min(0),
  'Unit Price': z.number().min(0),
  Discount: z.number().min(0),
  Adjustment: z.number().min(0),
  'Line Total': z.number().min(0),
  'Order Status': z.string().min(1).max(100),
  Notes: z.string().max(1000).nullable(),
  'Invoice Date': z.string().max(50).nullable(),
  'Packed Date': z.string().max(50).nullable(),
  'Shipment Code': z.string().max(100).nullable(),
});

export const transactionArraySchema = z.array(transactionDataSchema).min(1);

export const transactionUpdateSchema = transactionDataSchema.partial().extend({
  id: z.number().int().positive(),
});
