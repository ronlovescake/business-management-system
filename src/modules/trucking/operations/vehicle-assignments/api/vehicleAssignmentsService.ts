import { prisma } from '@/lib/db';
import type {
  VehicleAssignmentDraftPayload,
  VehicleAssignmentUpdatePayload,
} from './vehicleAssignmentsValidation';

export type VehicleAssignmentDto = {
  id: string;
  vehicleId: string;
  plateNo: string;
  driver: string;
  helper: string;
  startDate: string;
  endDate: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  route?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const toDto = (record: {
  id: string;
  vehicleId: string;
  plateNo: string;
  driver: string;
  helper: string;
  startDate: string;
  endDate: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  route: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): VehicleAssignmentDto => ({
  id: record.id,
  vehicleId: record.vehicleId,
  plateNo: record.plateNo,
  driver: record.driver,
  helper: record.helper,
  startDate: record.startDate,
  endDate: record.endDate,
  status: record.status,
  route: record.route ?? undefined,
  notes: record.notes ?? undefined,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});

export async function listVehicleAssignments(): Promise<
  VehicleAssignmentDto[]
> {
  const rows = await prisma.truckingVehicleAssignment.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      vehicleId: true,
      plateNo: true,
      driver: true,
      helper: true,
      startDate: true,
      endDate: true,
      status: true,
      route: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return rows.map(toDto);
}

export async function createVehicleAssignment(
  payload: VehicleAssignmentDraftPayload
): Promise<VehicleAssignmentDto> {
  const record = await prisma.truckingVehicleAssignment.create({
    data: {
      vehicleId: payload.vehicleId.trim().toUpperCase(),
      plateNo: payload.plateNo.trim().toUpperCase(),
      driver: payload.driver.trim(),
      helper: payload.helper.trim(),
      startDate: payload.startDate.trim(),
      endDate: payload.endDate.trim(),
      status: payload.status,
      route: payload.route?.trim() || null,
      notes: payload.notes?.trim() || null,
    },
    select: {
      id: true,
      vehicleId: true,
      plateNo: true,
      driver: true,
      helper: true,
      startDate: true,
      endDate: true,
      status: true,
      route: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return toDto(record);
}

export async function updateVehicleAssignment(
  id: string,
  payload: VehicleAssignmentUpdatePayload
): Promise<VehicleAssignmentDto> {
  const record = await prisma.truckingVehicleAssignment.update({
    where: { id },
    data: {
      vehicleId:
        payload.vehicleId === undefined
          ? undefined
          : payload.vehicleId.trim().toUpperCase(),
      plateNo:
        payload.plateNo === undefined
          ? undefined
          : payload.plateNo.trim().toUpperCase(),
      driver: payload.driver === undefined ? undefined : payload.driver.trim(),
      helper: payload.helper === undefined ? undefined : payload.helper.trim(),
      startDate:
        payload.startDate === undefined ? undefined : payload.startDate.trim(),
      endDate:
        payload.endDate === undefined ? undefined : payload.endDate.trim(),
      status: payload.status,
      route:
        payload.route === undefined ? undefined : payload.route?.trim() || null,
      notes:
        payload.notes === undefined ? undefined : payload.notes?.trim() || null,
    },
    select: {
      id: true,
      vehicleId: true,
      plateNo: true,
      driver: true,
      helper: true,
      startDate: true,
      endDate: true,
      status: true,
      route: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return toDto(record);
}

export async function softDeleteVehicleAssignment(id: string): Promise<void> {
  await prisma.truckingVehicleAssignment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
