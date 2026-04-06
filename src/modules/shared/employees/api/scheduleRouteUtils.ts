import { sanitizers } from '@/lib/security/sanitize';

const SHIFT_TYPES = new Set(['morning', 'afternoon', 'night', 'full-day']);
const SCHEDULE_STATUSES = new Set(['scheduled', 'completed', 'cancelled']);
const SCHEDULE_SOURCES = new Set(['manual', 'template', 'recurrence']);

export type SchedulePayload = Record<string, unknown>;

export type ScheduleCreateInput = {
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

export type ScheduleUpdateInput = Partial<ScheduleCreateInput> & {
  deletedAt?: Date | string | null;
};

export type PersistableScheduleInput = ScheduleCreateInput & { id: string };

export type ScheduleEntity = ScheduleCreateInput & {
  id: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  deletedAt?: Date | string | null;
};

export type ScheduleResponse = {
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

export const parseScheduleString = (value: unknown): string => {
  return sanitizers.name(value);
};

const parseOptionalString = (value: unknown): string | undefined => {
  const parsed = parseScheduleString(value);
  return parsed.length > 0 ? parsed : undefined;
};

const normalizeShiftType = (value: unknown): string => {
  const normalized = parseScheduleString(value).toLowerCase();
  return SHIFT_TYPES.has(normalized) ? normalized : 'morning';
};

const normalizeStatus = (value: unknown): string => {
  const normalized = parseScheduleString(value).toLowerCase();
  return SCHEDULE_STATUSES.has(normalized) ? normalized : 'scheduled';
};

const normalizeSource = (value: unknown): string => {
  const normalized = parseScheduleString(value).toLowerCase();
  return SCHEDULE_SOURCES.has(normalized) ? normalized : 'manual';
};

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = parseScheduleString(value).toLowerCase();
  if (normalized.length === 0) {
    return false;
  }

  return ['true', '1', 'yes', 'y'].includes(normalized);
};

export const toScheduleCreateInput = (
  payload: SchedulePayload
): ScheduleCreateInput => {
  const employeeId = parseScheduleString(payload.employeeId);
  const employeeName = parseScheduleString(payload.employeeName);
  const date = parseScheduleString(payload.date);
  const startTime = parseScheduleString(payload.startTime);
  const endTime = parseScheduleString(payload.endTime);
  const position = parseScheduleString(payload.position);
  const department = parseScheduleString(payload.department);

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

export const toScheduleUpdateInput = (
  payload: SchedulePayload
): ScheduleUpdateInput => {
  const data: ScheduleUpdateInput = {};

  if (payload.employeeId !== undefined) {
    data.employeeId = parseScheduleString(payload.employeeId);
  }
  if (payload.employeeName !== undefined) {
    data.employeeName = parseScheduleString(payload.employeeName);
  }
  if (payload.date !== undefined) {
    data.date = parseScheduleString(payload.date);
  }
  if (payload.shiftType !== undefined) {
    data.shiftType = normalizeShiftType(payload.shiftType);
  }
  if (payload.startTime !== undefined) {
    data.startTime = parseScheduleString(payload.startTime);
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
    data.endTime = parseScheduleString(payload.endTime);
  }
  if (payload.position !== undefined) {
    data.position = parseScheduleString(payload.position);
  }
  if (payload.department !== undefined) {
    data.department = parseScheduleString(payload.department);
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

export const mapScheduleToResponse = (
  schedule: ScheduleEntity
): ScheduleResponse => ({
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

export const ensureScheduleArray = (payload: unknown): SchedulePayload[] => {
  if (Array.isArray(payload)) {
    return payload as SchedulePayload[];
  }

  return payload ? [payload as SchedulePayload] : [];
};
