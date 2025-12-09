import { z } from 'zod';
import type { FleetStatus } from '../types/fleetRegistry.types';

const fleetStatusValues = [
  'active',
  'maintenance',
  'inactive',
  'retired',
] as const satisfies Readonly<[FleetStatus, ...FleetStatus[]]>;

const optionalTrimmedString = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  });

export const fleetVehiclePayloadSchema = z.object({
  truckId: z.string().trim().min(1, 'Vehicle ID is required'),
  maker: z.string().trim().min(1, 'Maker is required'),
  model: z.string().trim().min(1, 'Model is required'),
  year: z.coerce.number().int().min(1900).max(3000),
  plateNo: z.string().trim().min(1, 'Plate number is required'),
  bodyNo: optionalTrimmedString,
  chassisNo: optionalTrimmedString,
  orCrInfo: optionalTrimmedString,
  ltoRegisterDate: z.string().trim().min(1, 'LTO register date is required'),
  engineNo: optionalTrimmedString,
  capacity: optionalTrimmedString,
  passengerCapacity: optionalTrimmedString,
  grossWeight: optionalTrimmedString,
  netWeight: optionalTrimmedString,
  bodyType: optionalTrimmedString,
  series: optionalTrimmedString,
  classification: optionalTrimmedString,
  vehicleType: z.string().trim().min(1, 'Vehicle type is required'),
  fuelType: z.string().trim().min(1, 'Fuel type is required'),
  status: z.enum(fleetStatusValues),
  remarks: optionalTrimmedString,
  ownershipType: optionalTrimmedString,
  acquisitionDate: optionalTrimmedString,
  purchaseCost: optionalTrimmedString,
  insuranceProvider: optionalTrimmedString,
  insuranceExpiry: optionalTrimmedString,
  gpsTrackerId: optionalTrimmedString,
  depotLocation: optionalTrimmedString,
  driverAssigned: optionalTrimmedString,
});

export type FleetVehiclePayload = z.infer<typeof fleetVehiclePayloadSchema>;
