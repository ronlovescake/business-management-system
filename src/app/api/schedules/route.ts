import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import {
  validateSchedule,
  formatValidationErrors,
  scheduleUpdateSchema,
} from '@/lib/validations/schedule.validation';

const SHIFT_TYPES = new Set(['morning', 'afternoon', 'night', 'full-day']);
const SCHEDULE_STATUSES = new Set(['scheduled', 'completed', 'cancelled']);
const SCHEDULE_SOURCES = new Set(['manual', 'template', 'recurrence']);

type SchedulePayload = Record<string, unknown>;

type ScheduleCreateInput = {
  employeeId: string;
  employeeName: string;
  date: string;
  shiftType: string;
  startTime: string;
  break1?: string | null;
  lunch?: string | null;
  break2?: string | null;
  endTime: string;
  position: string;
  department: string;
  status: string;
  notes: string | null;
  source: string;
  templateId: string | null;
  recurrenceId: string | null;
  isOverride: boolean;
};

type ScheduleUpdateInput = Partial<ScheduleCreateInput> & {
  deletedAt?: Date | string | null;
};

type PersistableScheduleInput = ScheduleCreateInput & { id: string };

type ScheduleEntity = ScheduleCreateInput & {
  id: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt: Date | string | null;
};

type ScheduleResponse = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  shiftType: string;
  startTime: string;
  break1?: string;
  lunch?: string;
  break2?: string;
  endTime: string;
  position: string;
  department: string;
  status: string;
  notes?: string;
  source: string;
  templateId?: string;
  recurrenceId?: string;
  isOverride: boolean;
};

const parseString = (value: unknown): string => {
  return sanitizers.name(value);
};

const parseOptionalString = (value: unknown): string | undefined => {
  const parsed = parseString(value);
  return parsed.length > 0 ? parsed : undefined;
};

const normalizeShiftType = (value: unknown): string => {
  const normalized = parseString(value).toLowerCase();
  return SHIFT_TYPES.has(normalized) ? normalized : 'morning';
};

const normalizeStatus = (value: unknown): string => {
  const normalized = parseString(value).toLowerCase();
  return SCHEDULE_STATUSES.has(normalized) ? normalized : 'scheduled';
};

const normalizeSource = (value: unknown): string => {
  const normalized = parseString(value).toLowerCase();
  return SCHEDULE_SOURCES.has(normalized) ? normalized : 'manual';
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = parseString(value).toLowerCase();
  if (normalized.length === 0) {
    return false;
  }

  return ['true', '1', 'yes', 'y'].includes(normalized);
};

const toCreateInput = (payload: SchedulePayload): ScheduleCreateInput => {
  const employeeId = parseString(payload.employeeId);
  const employeeName = parseString(payload.employeeName);
  const date = parseString(payload.date);
  const startTime = parseString(payload.startTime);
  const endTime = parseString(payload.endTime);
  const position = parseString(payload.position);
  const department = parseString(payload.department);

  if (
    !employeeId ||
    !employeeName ||
    !date ||
    !startTime ||
    !endTime ||
    !position ||
    !department
  ) {
    throw new Error('Missing required schedule fields');
  }

  return {
    employeeId,
    employeeName,
    date,
    shiftType: normalizeShiftType(payload.shiftType),
    startTime,
    break1: parseOptionalString(payload.break1) ?? null,
    lunch: parseOptionalString(payload.lunch) ?? null,
    break2: parseOptionalString(payload.break2) ?? null,
    endTime,
    position,
    department,
    status: normalizeStatus(payload.status),
    notes: parseOptionalString(payload.notes) ?? null,
    source: normalizeSource(payload.source),
    templateId: parseOptionalString(payload.templateId) ?? null,
    recurrenceId: parseOptionalString(payload.recurrenceId) ?? null,
    isOverride: parseBoolean(payload.isOverride),
  };
};

const toUpdateInput = (payload: SchedulePayload): ScheduleUpdateInput => {
  const data: ScheduleUpdateInput = {};

  if (payload.employeeId !== undefined) {
    data.employeeId = parseString(payload.employeeId);
  }
  if (payload.employeeName !== undefined) {
    data.employeeName = parseString(payload.employeeName);
  }
  if (payload.date !== undefined) {
    data.date = parseString(payload.date);
  }
  if (payload.shiftType !== undefined) {
    data.shiftType = normalizeShiftType(payload.shiftType);
  }
  if (payload.startTime !== undefined) {
    data.startTime = parseString(payload.startTime);
  }
  if (payload.break1 !== undefined) {
    data.break1 = parseOptionalString(payload.break1) ?? null;
  }
  if (payload.lunch !== undefined) {
    data.lunch = parseOptionalString(payload.lunch) ?? null;
  }
  if (payload.break2 !== undefined) {
    data.break2 = parseOptionalString(payload.break2) ?? null;
  }
  if (payload.endTime !== undefined) {
    data.endTime = parseString(payload.endTime);
  }
  if (payload.position !== undefined) {
    data.position = parseString(payload.position);
  }
  if (payload.department !== undefined) {
    data.department = parseString(payload.department);
  }
  if (payload.status !== undefined) {
    data.status = normalizeStatus(payload.status);
  }
  if (payload.notes !== undefined) {
    data.notes = parseOptionalString(payload.notes) ?? null;
  }
  if (payload.source !== undefined) {
    data.source = normalizeSource(payload.source);
  }
  if (payload.templateId !== undefined) {
    data.templateId = parseOptionalString(payload.templateId) ?? null;
  }
  if (payload.recurrenceId !== undefined) {
    data.recurrenceId = parseOptionalString(payload.recurrenceId) ?? null;
  }
  if (payload.isOverride !== undefined) {
    data.isOverride = parseBoolean(payload.isOverride);
  }

  return data;
};

const mapScheduleToResponse = (schedule: ScheduleEntity): ScheduleResponse => ({
  id: schedule.id,
  employeeId: schedule.employeeId,
  employeeName: schedule.employeeName,
  date: schedule.date,
  shiftType: schedule.shiftType,
  startTime: schedule.startTime,
  break1: schedule.break1 ?? undefined,
  lunch: schedule.lunch ?? undefined,
  break2: schedule.break2 ?? undefined,
  endTime: schedule.endTime,
  position: schedule.position,
  department: schedule.department,
  status: schedule.status,
  notes: schedule.notes ?? undefined,
  source: schedule.source,
  templateId: schedule.templateId ?? undefined,
  recurrenceId: schedule.recurrenceId ?? undefined,
  isOverride: schedule.isOverride,
});

const ensureArray = (payload: unknown): SchedulePayload[] => {
  if (Array.isArray(payload)) {
    return payload as SchedulePayload[];
  }

  return payload ? [payload as SchedulePayload] : [];
};

const getScheduleDelegate = (client: unknown) =>
  (
    client as {
      schedule: {
        findMany: (args: unknown) => Promise<ScheduleEntity[]>;
        create: (args: {
          data: ScheduleCreateInput;
        }) => Promise<ScheduleEntity>;
        update: (args: {
          where: { id: string };
          data: ScheduleUpdateInput;
        }) => Promise<ScheduleEntity>;
      };
    }
  ).schedule;

const scheduleDelegate = getScheduleDelegate(prisma);

export async function GET() {
  try {
    // ========================================================================
    // ⚠️ QUERY OPTIMIZATION - Use select to fetch only needed fields
    // ========================================================================
    // Fetch only essential fields for schedule list view
    // ========================================================================
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
        // Exclude advanced features not commonly used in list view:
        // - source, templateId, recurrenceId, isOverride
        // - notes (can be fetched separately if needed)
      },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
    });

    return NextResponse.json(schedules.map(mapScheduleToResponse));
  } catch (error) {
    logger.error('Failed to fetch schedules:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch schedules',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const items = ensureArray(payload);

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Request body must contain schedule data' },
        { status: 400 }
      );
    }

    // ========================================================================
    // ⚠️ BATCH SIZE LIMIT - Maximum 10000 records per import
    // ========================================================================
    if (items.length > 10000) {
      return NextResponse.json(
        {
          error: 'Batch size limit exceeded',
          details: `You are trying to import ${items.length} records. Maximum is 10,000 records per import.`,
          suggestion:
            'Please split your import into smaller batches of 10,000 records or less.',
        },
        { status: 413 } // Payload Too Large
      );
    }

    // Validate all records
    const validationErrors: Array<{
      index: number;
      errors: Record<string, string>;
    }> = [];
    const validatedInputs: ScheduleCreateInput[] = [];
    const employeeIds = new Set<string>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Convert to create input first
      let createInput: ScheduleCreateInput;
      try {
        createInput = toCreateInput(item);
      } catch (error) {
        validationErrors.push({
          index: i,
          errors: {
            _error:
              error instanceof Error ? error.message : 'Invalid schedule data',
          },
        });
        continue;
      }

      // Validate with schema
      const validation = validateSchedule(createInput);
      if (!validation.success) {
        validationErrors.push({
          index: i,
          errors: formatValidationErrors(validation.error),
        });
      } else {
        validatedInputs.push(validation.data as ScheduleCreateInput);
        employeeIds.add(createInput.employeeId);
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation failed for multiple records',
          details: validationErrors,
          validCount: validatedInputs.length,
          invalidCount: validationErrors.length,
        },
        { status: 400 }
      );
    }

    // Check if all referenced employees exist
    if (employeeIds.size > 0) {
      const existingEmployees = await prisma.employee.findMany({
        where: {
          employeeId: { in: Array.from(employeeIds) },
          deletedAt: null,
        },
        select: { employeeId: true },
      });

      const existingIds = new Set(existingEmployees.map((e) => e.employeeId));
      const missingIds = Array.from(employeeIds).filter(
        (id) => !existingIds.has(id)
      );

      if (missingIds.length > 0) {
        return NextResponse.json(
          {
            error: 'Referenced employees not found',
            details: `The following employee IDs do not exist: ${missingIds.join(', ')}`,
            missingEmployeeIds: missingIds,
            suggestion:
              'Please ensure all employees exist before importing schedules',
          },
          { status: 409 }
        );
      }
    }

    const createInputs: PersistableScheduleInput[] = validatedInputs.map(
      (input) => ({
        id: randomUUID(),
        ...input,
      })
    );

    const ids = createInputs.map((input) => input.id);

    await prisma.schedule.createMany({
      data: createInputs,
      skipDuplicates: true,
    });

    const created = await scheduleDelegate.findMany({
      where: { id: { in: ids }, deletedAt: null },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
    });

    const response = created.map(mapScheduleToResponse);

    logger.info('Schedules created', { count: response.length });

    return NextResponse.json({
      message: `Successfully saved ${response.length} schedule(s)`,
      count: response.length,
      schedules: response,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        return NextResponse.json(
          {
            error: 'Duplicate schedule',
            details: `A schedule with this ${target.join(', ')} already exists`,
            field: target[0],
          },
          { status: 409 }
        );
      }

      if (error.code === 'P2003') {
        return NextResponse.json(
          {
            error: 'Referenced employee not found',
            details: 'One or more employee IDs do not exist in the database',
          },
          { status: 409 }
        );
      }
    }

    logger.error('Failed to create schedules', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        error: 'Failed to create schedules',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = (await request.json()) as SchedulePayload & { id?: string };
    const id = parseString(payload.id);

    if (!id) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const updateData = toUpdateInput(payload);

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields supplied for update' },
        { status: 400 }
      );
    }

    // Validate update data (partial schema for updates)
    const validation = scheduleUpdateSchema.safeParse(updateData);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationErrors(validation.error),
        },
        { status: 400 }
      );
    }

    const updated = await scheduleDelegate.update({
      where: { id },
      data: validation.data as ScheduleUpdateInput,
    });

    logger.info('Schedule updated', { id });

    return NextResponse.json({
      message: 'Schedule updated successfully',
      schedule: mapScheduleToResponse(updated),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Schedule not found or already deleted' },
          { status: 404 }
        );
      }

      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        return NextResponse.json(
          {
            error: 'Duplicate schedule',
            details: `A schedule with this ${target.join(', ')} already exists`,
            field: target[0],
          },
          { status: 409 }
        );
      }
    }

    logger.error('Failed to update schedule', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        error: 'Failed to update schedule',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseString(searchParams.get('id'));

    if (!id) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const deleted = await scheduleDelegate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info('Schedule soft deleted', { id });

    return NextResponse.json({
      message: 'Schedule deleted successfully',
      schedule: mapScheduleToResponse(deleted),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Schedule not found or already deleted' },
          { status: 404 }
        );
      }
    }

    logger.error('Failed to delete schedule', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
