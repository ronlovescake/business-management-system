import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  validateSchedule,
  formatValidationErrors,
  scheduleUpdateSchema,
} from '@/lib/validations/schedule.validation';
import {
  ensureScheduleArray,
  mapScheduleToResponse,
  parseScheduleString,
  type PersistableScheduleInput,
  type ScheduleCreateInput,
  type SchedulePayload,
  type ScheduleResponse,
  toScheduleCreateInput,
  toScheduleUpdateInput,
} from '@/modules/shared/employees/api/scheduleRouteUtils';

const scheduleDelegate = prisma.generalMerchandiseSchedule;

export async function GET() {
  try {
    const schedules = await scheduleDelegate.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        employeeId: true,
        employeeName: true,
        date: true,
        shiftType: true,
        startTime: true,
        break1: true,
        lunch: true,
        break2: true,
        endTime: true,
        position: true,
        department: true,
        status: true,
        notes: true,
        source: true,
        templateId: true,
        recurrenceId: true,
        isOverride: true,
      },
      orderBy: { date: 'desc' },
    });

    const response = schedules.map(mapScheduleToResponse);
    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to fetch GM schedules', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to fetch schedules' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const items = ensureScheduleArray(payload);

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Request body must contain one or more schedules' },
        { status: 400 }
      );
    }

    if (items.length > 10000) {
      return NextResponse.json(
        {
          error: 'Batch size limit exceeded',
          details: `You are trying to import ${items.length} records. Maximum is 10,000 records per import.`,
          suggestion:
            'Please split your import into smaller batches of 10,000 records or less.',
        },
        { status: 413 }
      );
    }

    const created: ScheduleResponse[] = [];
    const validationErrors: Record<string, string | Record<string, string>> =
      {};

    for (let index = 0; index < items.length; index += 1) {
      const raw = items[index];

      try {
        const record = toScheduleCreateInput(raw);
        const validation = validateSchedule(record);

        if (!validation.success) {
          validationErrors[`record_${index}`] =
            formatValidationErrors(validation.error) ||
            'Validation failed for schedule';
          continue;
        }

        const normalizedData: ScheduleCreateInput = {
          ...validation.data,
          notes: validation.data.notes ?? null,
          templateId: validation.data.templateId ?? null,
          recurrenceId: validation.data.recurrenceId ?? null,
        };

        const data: PersistableScheduleInput = {
          id: randomUUID(),
          ...normalizedData,
        };

        const schedule = await scheduleDelegate.create({ data });
        created.push(mapScheduleToResponse(schedule));
      } catch (error) {
        validationErrors[`record_${index}`] =
          error instanceof Error ? error.message : 'Invalid schedule payload';
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationErrors,
          createdCount: created.length,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Failed to create GM schedule(s)', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to create schedule(s)' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = (await request.json()) as SchedulePayload;
    const scheduleId = parseScheduleString(payload.id);

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const updatePayload = toScheduleUpdateInput(payload);
    const validation = scheduleUpdateSchema.safeParse(updatePayload);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const schedule = await scheduleDelegate.update({
      where: { id: scheduleId },
      data: validation.data,
    });

    return NextResponse.json(mapScheduleToResponse(schedule));
  } catch (error) {
    logger.error('Failed to update GM schedule', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json()) as SchedulePayload;
    const scheduleId = parseScheduleString(payload.id);

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const updatePayload = toScheduleUpdateInput(payload);

    const schedule = await scheduleDelegate.update({
      where: { id: scheduleId },
      data: updatePayload,
    });

    return NextResponse.json(mapScheduleToResponse(schedule));
  } catch (error) {
    logger.error('Failed to patch GM schedule', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const payload = (await request.json()) as SchedulePayload;
    const scheduleId = parseScheduleString(payload.id);

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const schedule = await scheduleDelegate.update({
      where: { id: scheduleId },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(mapScheduleToResponse(schedule));
  } catch (error) {
    logger.error('Failed to delete GM schedule', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
