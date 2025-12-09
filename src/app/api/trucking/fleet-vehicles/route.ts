import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '@/lib/logger';
import {
  createFleetVehicle,
  listFleetVehicles,
} from '@/modules/trucking/operations/fleet-registry/api/fleetVehiclesService';
import { fleetVehiclePayloadSchema } from '@/modules/trucking/operations/fleet-registry/api/fleetVehiclesValidation';

export async function GET() {
  const data = await listFleetVehicles();
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = fleetVehiclePayloadSchema.parse(body);
    const data = await createFleetVehicle(payload);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
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
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A vehicle with this ID already exists.' },
          { status: 409 }
        );
      }
    }

    logger.error('Failed to create fleet vehicle', { error });
    return NextResponse.json(
      { error: 'Failed to create fleet vehicle' },
      { status: 500 }
    );
  }
}
