import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';
import {
  createVehicleAssignment,
  listVehicleAssignments,
} from '@/modules/trucking/operations/vehicle-assignments/api/vehicleAssignmentsService';
import { vehicleAssignmentDraftSchema } from '@/modules/trucking/operations/vehicle-assignments/api/vehicleAssignmentsValidation';

export const dynamic = 'force-dynamic';

const isMissingVehicleAssignmentsStorage = (error: unknown): boolean => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2021: "The table does not exist in the current database."
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

export async function GET() {
  try {
    const data = await listVehicleAssignments();
    return NextResponse.json({ data });
  } catch (error) {
    if (isMissingVehicleAssignmentsStorage(error)) {
      // Keep the UI working even if migrations haven't been applied yet.
      // Writes will still fail until the migration is deployed.
      logger.warn('Vehicle assignments storage not initialized', { error });
      return NextResponse.json({
        data: [],
        warning:
          'Vehicle assignments storage is not initialized. Apply database migrations to enable persistence.',
      });
    }

    logger.error('Failed to list vehicle assignments', { error });
    return NextResponse.json(
      { error: 'Failed to list vehicle assignments' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = vehicleAssignmentDraftSchema.parse(body);
    const data = await createVehicleAssignment(payload);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (isMissingVehicleAssignmentsStorage(error)) {
      return NextResponse.json(
        {
          error:
            'Vehicle assignments storage is not initialized. Apply database migrations before creating assignments.',
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
      return NextResponse.json(
        { error: `Database error (${error.code})` },
        { status: 409 }
      );
    }

    logger.error('Failed to create vehicle assignment', { error });
    return NextResponse.json(
      { error: 'Failed to create vehicle assignment' },
      { status: 500 }
    );
  }
}
