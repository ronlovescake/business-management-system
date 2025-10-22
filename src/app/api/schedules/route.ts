import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
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
    const schedules = await scheduleDelegate.findMany({
      where: { deletedAt: null },
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

    const createInputs: PersistableScheduleInput[] = items.map((item) => ({
      id: randomUUID(),
      ...toCreateInput(item),
    }));

    const ids = createInputs.map((input) => input.id);

    await prisma.schedule.createMany({ data: createInputs });

    const created = await scheduleDelegate.findMany({
      where: { id: { in: ids }, deletedAt: null },
      orderBy: [{ date: 'desc' }, { startTime: 'asc' }],
    });

    const response = created.map(mapScheduleToResponse);

    return NextResponse.json({
      message: `Successfully saved ${response.length} schedule(s)`,
      count: response.length,
      schedules: response,
    });
  } catch (error) {
    logger.error('Failed to create schedules:', error);
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

    const updated = await scheduleDelegate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: 'Schedule updated successfully',
      schedule: mapScheduleToResponse(updated),
    });
  } catch (error) {
    logger.error('Failed to update schedule:', error);

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

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

    return NextResponse.json({
      message: 'Schedule deleted successfully',
      schedule: mapScheduleToResponse(deleted),
    });
  } catch (error) {
    logger.error('Failed to delete schedule:', error);

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2025'
    ) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
