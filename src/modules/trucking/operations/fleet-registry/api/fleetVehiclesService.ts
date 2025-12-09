import type { Prisma, TruckingFleetRegistry } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { FleetRegistryRecord } from '../types/fleetRegistry.types';
import type { FleetVehiclePayload } from './fleetVehiclesValidation';

const fallback = (value?: string | null) => value ?? '';

const normalizeIdentifier = (value: string) => value.trim();

const toRecord = (vehicle: TruckingFleetRegistry): FleetRegistryRecord => ({
  id: vehicle.id,
  truckId: vehicle.truckId,
  maker: vehicle.maker,
  model: vehicle.model,
  year: vehicle.year,
  plateNo: vehicle.plateNo,
  bodyNo: fallback(vehicle.bodyNo),
  chassisNo: fallback(vehicle.chassisNo),
  orCrInfo: fallback(vehicle.orCrInfo),
  ltoRegisterDate: fallback(vehicle.ltoRegisterDate),
  engineNo: fallback(vehicle.engineNo),
  capacity: fallback(vehicle.capacity),
  passengerCapacity: fallback(vehicle.passengerCapacity),
  grossWeight: fallback(vehicle.grossWeight),
  netWeight: fallback(vehicle.netWeight),
  bodyType: fallback(vehicle.bodyType),
  series: fallback(vehicle.series),
  classification: fallback(vehicle.classification),
  vehicleType: vehicle.vehicleType,
  fuelType: vehicle.fuelType,
  status: vehicle.status as FleetRegistryRecord['status'],
  remarks: vehicle.remarks ?? '',
  ownershipType: (vehicle.ownershipType ?? undefined) as
    | FleetRegistryRecord['ownershipType']
    | undefined,
  acquisitionDate: vehicle.acquisitionDate ?? undefined,
  purchaseCost: vehicle.purchaseCost ?? undefined,
  insuranceProvider: vehicle.insuranceProvider ?? undefined,
  insuranceExpiry: vehicle.insuranceExpiry ?? undefined,
  gpsTrackerId: vehicle.gpsTrackerId ?? undefined,
  depotLocation: vehicle.depotLocation ?? undefined,
  driverAssigned: vehicle.driverAssigned ?? undefined,
  createdAt: vehicle.createdAt?.toISOString(),
  updatedAt: vehicle.updatedAt?.toISOString(),
});

const mapPayloadToModelFields = (payload: FleetVehiclePayload) => ({
  truckId: payload.truckId.trim().toUpperCase(),
  maker: payload.maker.trim(),
  model: payload.model.trim(),
  year: payload.year,
  plateNo: payload.plateNo.trim().toUpperCase(),
  bodyNo: payload.bodyNo,
  chassisNo: payload.chassisNo,
  orCrInfo: payload.orCrInfo,
  ltoRegisterDate: payload.ltoRegisterDate.trim(),
  engineNo: payload.engineNo,
  capacity: payload.capacity,
  passengerCapacity: payload.passengerCapacity,
  grossWeight: payload.grossWeight,
  netWeight: payload.netWeight,
  bodyType: payload.bodyType,
  series: payload.series,
  classification: payload.classification,
  vehicleType: payload.vehicleType.trim(),
  fuelType: payload.fuelType.trim(),
  status: payload.status,
  remarks: payload.remarks,
  ownershipType: payload.ownershipType,
  acquisitionDate: payload.acquisitionDate,
  purchaseCost: payload.purchaseCost,
  insuranceProvider: payload.insuranceProvider,
  insuranceExpiry: payload.insuranceExpiry,
  gpsTrackerId: payload.gpsTrackerId,
  depotLocation: payload.depotLocation,
  driverAssigned: payload.driverAssigned,
});

const buildCreateData = (
  payload: FleetVehiclePayload
): Prisma.TruckingFleetRegistryCreateInput => {
  return mapPayloadToModelFields(payload);
};

const buildUpdateData = (
  payload: FleetVehiclePayload
): Prisma.TruckingFleetRegistryUpdateInput => {
  return mapPayloadToModelFields(payload);
};

export async function listFleetVehicles(): Promise<FleetRegistryRecord[]> {
  const vehicles = await prisma.truckingFleetRegistry.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  return vehicles.map(toRecord);
}

export async function createFleetVehicle(
  payload: FleetVehiclePayload
): Promise<FleetRegistryRecord> {
  const data = buildCreateData(payload);
  const created = await prisma.truckingFleetRegistry.create({ data });
  logger.info('Fleet vehicle created', { truckId: created.truckId });
  return toRecord(created);
}

export async function getFleetVehicle(
  identifier: string
): Promise<FleetRegistryRecord | null> {
  const normalized = normalizeIdentifier(identifier);
  const vehicle = await prisma.truckingFleetRegistry.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { id: normalized },
        { truckId: { equals: normalized, mode: 'insensitive' } },
      ],
    },
  });
  return vehicle ? toRecord(vehicle) : null;
}

export async function updateFleetVehicle(
  identifier: string,
  payload: FleetVehiclePayload
): Promise<FleetRegistryRecord | null> {
  const normalized = normalizeIdentifier(identifier);
  const existing = await prisma.truckingFleetRegistry.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { id: normalized },
        { truckId: { equals: normalized, mode: 'insensitive' } },
      ],
    },
  });

  if (!existing) {
    return null;
  }

  const data = buildUpdateData(payload);
  const updated = await prisma.truckingFleetRegistry.update({
    where: { id: existing.id },
    data,
  });

  logger.info('Fleet vehicle updated', { truckId: updated.truckId });
  return toRecord(updated);
}
