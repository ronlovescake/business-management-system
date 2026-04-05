import { Prisma } from '@prisma/client';
import { normalizePayrollCutoffDays } from './payrollCutoffDays';
import { logger } from '@/lib/logger';
import type {
  EmployeeAutomationExecutionResult,
  EmployeeAutomationOverview,
  EmployeeAutomationRunRecord,
  EmployeeAutomationSettings,
  EmployeeAutomationSettingsUpdate,
  EmployeeAutomationTriggerSource,
} from './types';

const SETTINGS_KEY = 'default';
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_GRACE_MINUTES = 120;
const DEFAULT_TIME = '02:00';
const DEFAULT_TIMEZONE = 'Asia/Manila';
const SCHEMA_MISMATCH_MESSAGE =
  'Employee automation database schema is out of date. Run npm run db:push or apply the latest Prisma migration, then reload this page.';

type SettingsRecord = {
  stayInAutoPresenceEnabled: boolean;
  stayInAutoPresenceTime: string;
  stayInAutoPresenceTimezone: string;
  stayInAutoPresenceGraceMinutes: number;
  payrollAutoGenerationEnabled: boolean;
  payrollAutoGenerationTime: string;
  payrollAutoGenerationTimezone: string;
  payrollAutoGenerationCutoffDays: number[];
};

type SettingsDelegate<RecordType extends SettingsRecord> = {
  findUnique?(args: unknown): Promise<RecordType | null>;
  upsert(args: unknown): Promise<RecordType>;
};

type RunRecord = {
  id: string;
  createdAt: Date;
  automationType: string;
  triggerSource: string;
  status: string;
  periodKey: string | null;
  targetDate: string | null;
  payrollPeriodStart: string | null;
  payrollPeriodEnd: string | null;
  message: string | null;
  processed: number;
  inserted: number;
  skipped: number;
  triggeredByUserId: string | null;
  triggeredByUserName: string | null;
  metadata?: Prisma.JsonValue | null;
};

type RunDelegate<RecordType extends RunRecord> = {
  findMany(args: unknown): Promise<RecordType[]>;
  findFirst(args: unknown): Promise<RecordType | null>;
  create(args: unknown): Promise<RecordType>;
};

const validationError = (message: string): Error => {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
};

const schemaMismatchError = (): Error => {
  const error = new Error(SCHEMA_MISMATCH_MESSAGE);
  error.name = 'SchemaMismatchError';
  return error;
};

function isMissingAutomationSchemaError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2021' || error.code === 'P2022';
  }

  const message = (error as { message?: string })?.message ?? '';
  return message.includes('does not exist');
}

export const DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS: EmployeeAutomationSettings =
  {
    stayInAutoPresenceEnabled: true,
    stayInAutoPresenceTime: DEFAULT_TIME,
    stayInAutoPresenceTimezone: DEFAULT_TIMEZONE,
    stayInAutoPresenceGraceMinutes: 0,
    payrollAutoGenerationEnabled: false,
    payrollAutoGenerationTime: DEFAULT_TIME,
    payrollAutoGenerationTimezone: DEFAULT_TIMEZONE,
    payrollAutoGenerationCutoffDays: [],
  };

function validateTime(value: string): string {
  if (!TIME_REGEX.test(value)) {
    throw validationError(
      'Invalid time format. Expected HH:mm in 24-hour format.'
    );
  }

  return value;
}

function validateTimezone(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw validationError('Timezone cannot be empty.');
  }

  return trimmed;
}

function validateGraceMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    throw validationError('Grace minutes must be a finite number.');
  }

  const sanitized = Math.max(0, Math.floor(value));
  if (sanitized > MAX_GRACE_MINUTES) {
    throw validationError(
      `Grace minutes cannot exceed ${MAX_GRACE_MINUTES}. Received: ${value}`
    );
  }

  return sanitized;
}

function validateCutoffDays(value: unknown): number[] {
  try {
    return normalizePayrollCutoffDays(value);
  } catch (error) {
    throw validationError(
      error instanceof Error
        ? error.message
        : 'Payroll cutoff dates are invalid.'
    );
  }
}

function validateFinalSettings(settings: EmployeeAutomationSettings): void {
  if (
    settings.payrollAutoGenerationEnabled &&
    settings.payrollAutoGenerationCutoffDays.length === 0
  ) {
    throw validationError(
      'Add at least one payroll cutoff date before enabling payroll automation.'
    );
  }
}

export function sanitizeEmployeeAutomationSettingsUpdate(
  input: EmployeeAutomationSettingsUpdate
): Partial<EmployeeAutomationSettings> {
  const next: Partial<EmployeeAutomationSettings> = {};

  if (input.stayInAutoPresenceEnabled !== undefined) {
    next.stayInAutoPresenceEnabled = Boolean(input.stayInAutoPresenceEnabled);
  }

  if (input.stayInAutoPresenceTime !== undefined) {
    next.stayInAutoPresenceTime = validateTime(input.stayInAutoPresenceTime);
  }

  if (input.stayInAutoPresenceTimezone !== undefined) {
    next.stayInAutoPresenceTimezone = validateTimezone(
      input.stayInAutoPresenceTimezone
    );
  }

  if (input.stayInAutoPresenceGraceMinutes !== undefined) {
    next.stayInAutoPresenceGraceMinutes = validateGraceMinutes(
      input.stayInAutoPresenceGraceMinutes
    );
  }

  if (input.payrollAutoGenerationEnabled !== undefined) {
    next.payrollAutoGenerationEnabled = Boolean(
      input.payrollAutoGenerationEnabled
    );
  }

  if (input.payrollAutoGenerationTime !== undefined) {
    next.payrollAutoGenerationTime = validateTime(
      input.payrollAutoGenerationTime
    );
  }

  if (input.payrollAutoGenerationTimezone !== undefined) {
    next.payrollAutoGenerationTimezone = validateTimezone(
      input.payrollAutoGenerationTimezone
    );
  }

  if (input.payrollAutoGenerationCutoffDays !== undefined) {
    next.payrollAutoGenerationCutoffDays = validateCutoffDays(
      input.payrollAutoGenerationCutoffDays
    );
  }

  return next;
}

function mapSettingsRecord(record: SettingsRecord): EmployeeAutomationSettings {
  return {
    stayInAutoPresenceEnabled: record.stayInAutoPresenceEnabled,
    stayInAutoPresenceTime: record.stayInAutoPresenceTime,
    stayInAutoPresenceTimezone: record.stayInAutoPresenceTimezone,
    stayInAutoPresenceGraceMinutes: record.stayInAutoPresenceGraceMinutes,
    payrollAutoGenerationEnabled: record.payrollAutoGenerationEnabled,
    payrollAutoGenerationTime: record.payrollAutoGenerationTime,
    payrollAutoGenerationTimezone: record.payrollAutoGenerationTimezone,
    payrollAutoGenerationCutoffDays: validateCutoffDays(
      record.payrollAutoGenerationCutoffDays ?? []
    ),
  };
}

function buildSettingsCreateData(
  settings: Partial<EmployeeAutomationSettings>
): SettingsRecord {
  return {
    stayInAutoPresenceEnabled:
      settings.stayInAutoPresenceEnabled ??
      DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS.stayInAutoPresenceEnabled,
    stayInAutoPresenceTime:
      settings.stayInAutoPresenceTime ??
      DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS.stayInAutoPresenceTime,
    stayInAutoPresenceTimezone:
      settings.stayInAutoPresenceTimezone ??
      DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS.stayInAutoPresenceTimezone,
    stayInAutoPresenceGraceMinutes:
      settings.stayInAutoPresenceGraceMinutes ??
      DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS.stayInAutoPresenceGraceMinutes,
    payrollAutoGenerationEnabled:
      settings.payrollAutoGenerationEnabled ??
      DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS.payrollAutoGenerationEnabled,
    payrollAutoGenerationTime:
      settings.payrollAutoGenerationTime ??
      DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS.payrollAutoGenerationTime,
    payrollAutoGenerationTimezone:
      settings.payrollAutoGenerationTimezone ??
      DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS.payrollAutoGenerationTimezone,
    payrollAutoGenerationCutoffDays:
      settings.payrollAutoGenerationCutoffDays ??
      DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS.payrollAutoGenerationCutoffDays,
  };
}

function mapRunRecord(record: RunRecord): EmployeeAutomationRunRecord {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    automationType:
      record.automationType as EmployeeAutomationRunRecord['automationType'],
    triggerSource:
      record.triggerSource as EmployeeAutomationRunRecord['triggerSource'],
    status: record.status as EmployeeAutomationRunRecord['status'],
    periodKey: record.periodKey,
    targetDate: record.targetDate,
    payrollPeriodStart: record.payrollPeriodStart,
    payrollPeriodEnd: record.payrollPeriodEnd,
    message: record.message,
    processed: record.processed,
    inserted: record.inserted,
    skipped: record.skipped,
    triggeredByUserId: record.triggeredByUserId,
    triggeredByUserName: record.triggeredByUserName,
    metadata: record.metadata ?? undefined,
  };
}

export async function readEmployeeAutomationSettings<
  RecordType extends SettingsRecord,
>(delegate: SettingsDelegate<RecordType>): Promise<EmployeeAutomationSettings> {
  try {
    const record = await delegate.upsert({
      where: { key: SETTINGS_KEY },
      update: {},
      create: {
        key: SETTINGS_KEY,
        ...buildSettingsCreateData(DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS),
      },
    });

    return mapSettingsRecord(record);
  } catch (error) {
    if (isMissingAutomationSchemaError(error)) {
      logger.warn(
        'Employee automation settings schema is missing or outdated; using default settings until the database is updated.',
        {
          hint: SCHEMA_MISMATCH_MESSAGE,
          error,
        }
      );
      return { ...DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS };
    }

    throw error;
  }
}

export async function saveEmployeeAutomationSettings<
  RecordType extends SettingsRecord,
>(
  delegate: SettingsDelegate<RecordType>,
  input: EmployeeAutomationSettingsUpdate
): Promise<EmployeeAutomationSettings> {
  try {
    const sanitized = sanitizeEmployeeAutomationSettingsUpdate(input);
    const existing = delegate.findUnique
      ? await delegate.findUnique({ where: { key: SETTINGS_KEY } })
      : null;
    const merged: EmployeeAutomationSettings = {
      ...(existing
        ? mapSettingsRecord(existing)
        : DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS),
      ...sanitized,
    };

    validateFinalSettings(merged);

    const record = await delegate.upsert({
      where: { key: SETTINGS_KEY },
      update: sanitized,
      create: {
        key: SETTINGS_KEY,
        ...buildSettingsCreateData(sanitized),
      },
    });

    return mapSettingsRecord(record);
  } catch (error) {
    if (isMissingAutomationSchemaError(error)) {
      throw schemaMismatchError();
    }

    throw error;
  }
}

export async function listEmployeeAutomationRuns<RecordType extends RunRecord>(
  delegate: RunDelegate<RecordType>,
  limit = 20
): Promise<EmployeeAutomationRunRecord[]> {
  try {
    const records = await delegate.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return records.map(mapRunRecord);
  } catch (error) {
    if (isMissingAutomationSchemaError(error)) {
      logger.warn(
        'Employee automation run-history schema is missing or outdated; returning an empty history list.',
        {
          hint: SCHEMA_MISMATCH_MESSAGE,
          error,
        }
      );
      return [];
    }

    throw error;
  }
}

export async function readEmployeeAutomationOverview<
  SettingsRecordType extends SettingsRecord,
  RunRecordType extends RunRecord,
>(
  settingsDelegate: SettingsDelegate<SettingsRecordType>,
  runDelegate: RunDelegate<RunRecordType>
): Promise<EmployeeAutomationOverview> {
  const [settings, history] = await Promise.all([
    readEmployeeAutomationSettings(settingsDelegate),
    listEmployeeAutomationRuns(runDelegate),
  ]);

  return {
    settings,
    history,
  };
}

export async function hasRecordedAutomationRunForPeriod<
  RecordType extends RunRecord,
>(
  delegate: RunDelegate<RecordType>,
  automationType: EmployeeAutomationRunRecord['automationType'],
  periodKey: string
): Promise<boolean> {
  try {
    const record = await delegate.findFirst({
      where: {
        automationType,
        periodKey,
      },
      orderBy: { createdAt: 'desc' },
    });

    return Boolean(record);
  } catch (error) {
    if (isMissingAutomationSchemaError(error)) {
      logger.warn(
        'Employee automation run-history schema is missing during dedupe check; treating the period as not yet recorded.',
        {
          hint: SCHEMA_MISMATCH_MESSAGE,
          error,
        }
      );
      return false;
    }

    throw error;
  }
}

export async function recordEmployeeAutomationRun<RecordType extends RunRecord>(
  delegate: RunDelegate<RecordType>,
  result: EmployeeAutomationExecutionResult,
  triggerSource: EmployeeAutomationTriggerSource,
  actor?: {
    userId?: string | null;
    userName?: string | null;
  }
): Promise<EmployeeAutomationRunRecord> {
  try {
    const record = await delegate.create({
      data: {
        automationType: result.automationType,
        triggerSource,
        status: result.status,
        periodKey: result.periodKey ?? null,
        targetDate: result.targetDate ?? null,
        payrollPeriodStart: result.payrollPeriodStart ?? null,
        payrollPeriodEnd: result.payrollPeriodEnd ?? null,
        message: result.message,
        processed: result.processed ?? 0,
        inserted: result.inserted ?? 0,
        skipped: result.skipped ?? 0,
        triggeredByUserId: actor?.userId ?? null,
        triggeredByUserName: actor?.userName ?? null,
        metadata:
          result.metadata === undefined
            ? Prisma.JsonNull
            : (result.metadata as Prisma.InputJsonValue),
      } as Omit<RecordType, 'id' | 'createdAt'>,
    });

    return mapRunRecord(record);
  } catch (error) {
    if (isMissingAutomationSchemaError(error)) {
      throw schemaMismatchError();
    }

    throw error;
  }
}
