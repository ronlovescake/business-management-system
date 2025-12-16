import { z } from 'zod';

export const vehicleAssignmentStatusSchema = z.enum([
  'scheduled',
  'active',
  'completed',
  'cancelled',
]);

export const vehicleAssignmentDraftSchema = z
  .object({
    vehicleId: z.string().min(1, 'Vehicle ID is required'),
    plateNo: z.string().min(1, 'Plate number is required'),
    driver: z.string().min(1, 'Driver is required'),
    helper: z.string().min(1, 'Helper is required'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    status: vehicleAssignmentStatusSchema,
    route: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

export const vehicleAssignmentUpdateSchema = z
  .object({
    vehicleId: z.string().min(1).optional(),
    plateNo: z.string().min(1).optional(),
    driver: z.string().min(1).optional(),
    helper: z.string().min(1).optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    status: vehicleAssignmentStatusSchema.optional(),
    route: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  })
  .strict();

export type VehicleAssignmentDraftPayload = z.infer<
  typeof vehicleAssignmentDraftSchema
>;

export type VehicleAssignmentUpdatePayload = z.infer<
  typeof vehicleAssignmentUpdateSchema
>;
