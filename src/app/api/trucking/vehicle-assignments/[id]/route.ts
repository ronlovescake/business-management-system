import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';
import {
  updateVehicleAssignment,
  softDeleteVehicleAssignment,
} from '@/modules/trucking/operations/vehicle-assignments/api/vehicleAssignmentsService';
import { vehicleAssignmentUpdateSchema } from '@/modules/trucking/operations/vehicle-assignments/api/vehicleAssignmentsValidation';

export const dynamic = 'force-dynamic';

const isMissingVehicleAssignmentsStorage = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021') {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('trucking_vehicle_assignments') ||
    message.includes('TruckingVehicleAssignmentStatus') ||
    message.includes('TruckingVehicleAssignment')
  );
};

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const payload = vehicleAssignmentUpdateSchema.parse(body);
    const data = await updateVehicleAssignment(params.id, payload);
    return NextResponse.json({ data });
  } catch (error) {
    if (isMissingVehicleAssignmentsStorage(error)) {
      return NextResponse.json(
        {
          error:
            'Vehicle assignments storage is not initialized. Apply database migrations before updating assignments.',
        },
        { status: 503 }
      );
    }

    if (error instanceof ZodError) {
      const flattened = error.flatten();
      const firstFieldError = Object.values(flattened.fieldErrors)
        .flat()
        .find((message): message is string => Boolean(message));
      const message = firstFieldError ?? 'Validation failed';

      return NextResponse.json(
        { error: message, details: flattened },
        { status: 422 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      return NextResponse.json(
        { error: `Database error (${error.code})` },
        { status: 409 }
      );
    }

    logger.error('Failed to update vehicle assignment', { error });
    return NextResponse.json(
      { error: 'Failed to update vehicle assignment' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Soft delete only. This avoids data loss and keeps history available.
    await softDeleteVehicleAssignment(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingVehicleAssignmentsStorage(error)) {
      return NextResponse.json(
        {
          error:
            'Vehicle assignments storage is not initialized. Apply database migrations before deleting assignments.',
        },
        { status: 503 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    logger.error('Failed to delete vehicle assignment', { error });
    return NextResponse.json(
      { error: 'Failed to delete vehicle assignment' },
      { status: 500 }
    );
  }
}
