import { z } from 'zod';
import { ORDER_STATUS_OPTIONS } from '@/lib/transactions/order-status';

const orderStatusSchema = z.union([
  z.enum(ORDER_STATUS_OPTIONS),
  z.literal(''),
]);

export const transactionDataSchema = z.object({
  'Order Date': z.string().min(1).max(50),
  Customers: z.string().max(255), // allow empty string when only product is provided
  'Product Code': z.string().max(100), // allow empty string when only customer is provided
  Quantity: z.number().min(0),
  'Unit Price': z.number().min(0),
  Discount: z.number().min(0),
  Adjustment: z.number().min(0),
  'Line Total': z.number().min(0),
  'Order Status': orderStatusSchema,
  Notes: z.string().max(1000).nullable(),
  'Invoice Date': z.string().max(50).nullable(),
  'Packed Date': z.string().max(50).nullable(),
  'Shipment Code': z.string().max(100).nullable(),
});

const transactionUpdateFields = z.object({
  'Order Date': z.string().max(50),
  Customers: z.string().max(255),
  'Product Code': z.string().max(100),
  Quantity: z.number().min(0),
  'Unit Price': z.number().min(0),
  Discount: z.number().min(0),
  Adjustment: z.number().min(0),
  'Line Total': z.number().min(0),
  'Order Status': orderStatusSchema,
  Notes: z.string().max(1000).nullable(),
  'Invoice Date': z.string().max(50).nullable(),
  'Packed Date': z.string().max(50).nullable(),
  'Shipment Code': z.string().max(100).nullable(),
});

export const transactionArraySchema = z.array(transactionDataSchema).min(1);

export const transactionUpdateSchema = transactionUpdateFields
  .partial()
  .extend({
    id: z.number().int().positive(),
  });
