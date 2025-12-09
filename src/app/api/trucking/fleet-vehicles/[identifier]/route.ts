import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import {
  getFleetVehicle,
  updateFleetVehicle,
} from '@/modules/trucking/operations/fleet-registry/api/fleetVehiclesService';
import { fleetVehiclePayloadSchema } from '@/modules/trucking/operations/fleet-registry/api/fleetVehiclesValidation';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: {
    identifier: string;
  };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const data = await getFleetVehicle(params.identifier);
  if (!data) {
    return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    const payload = fleetVehiclePayloadSchema.parse(body);
    const data = await updateFleetVehicle(params.identifier, payload);

    if (!data) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof ZodError) {
      const flattened = error.flatten();
      const firstFieldError = Object.values(flattened.fieldErrors)
        .flat()
        .find((message): message is string => Boolean(message));
      return NextResponse.json(
        { error: firstFieldError ?? 'Validation failed', details: flattened },
        { status: 422 }
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Another vehicle already uses this ID or plate number.' },
          { status: 409 }
        );
      }
    }

    logger.error('Failed to update fleet vehicle', { error });
    return NextResponse.json(
      { error: 'Failed to update fleet vehicle' },
      { status: 500 }
    );
  }
}
