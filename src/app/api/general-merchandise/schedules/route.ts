import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
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

const gmPrisma = prisma as unknown as {
  generalMerchandiseSchedule: typeof prisma.schedule;
};

const getScheduleDelegate = (client: unknown) =>
  (
    client as {
      generalMerchandiseSchedule: {
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
  ).generalMerchandiseSchedule;

const scheduleDelegate = getScheduleDelegate(gmPrisma);

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
    const items = ensureArray(payload);

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
        const record = toCreateInput(raw);
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
    const scheduleId = parseString(payload.id);

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const updatePayload = toUpdateInput(payload);
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
    const scheduleId = parseString(payload.id);

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'Schedule ID is required' },
        { status: 400 }
      );
    }

    const updatePayload = toUpdateInput(payload);

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
    const scheduleId = parseString(payload.id);

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
