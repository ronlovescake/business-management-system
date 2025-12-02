import type { z } from 'zod';
import {
  shipmentDataSchema as baseShipmentDataSchema,
  shipmentDbSchema as baseShipmentDbSchema,
  bulkShipmentSchema as baseBulkShipmentSchema,
  formatValidationErrors as formatShipmentValidationErrors,
} from '@/lib/validations/shipment.validation';

export const shipmentRecordSchema = baseShipmentDataSchema;
export const shipmentDatabaseSchema = baseShipmentDbSchema;
export const bulkShipmentRecordSchema = baseBulkShipmentSchema;
export const mapShipmentValidationErrors = formatShipmentValidationErrors;

export type ShipmentRecordInput = z.infer<typeof shipmentRecordSchema>;
export type ShipmentDatabaseRecordInput = z.infer<
  typeof shipmentDatabaseSchema
>;
export type BulkShipmentRecordInput = z.infer<typeof bulkShipmentRecordSchema>;
