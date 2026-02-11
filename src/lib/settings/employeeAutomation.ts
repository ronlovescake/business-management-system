import { Prisma } from '@prisma/client';
import type { EmployeeAutomationSetting } from '@prisma/client';
import { prisma } from '@/lib/db';

const SETTINGS_KEY = 'default';
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_GRACE_MINUTES = 120;

const validationError = (message: string): Error => {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
};

export interface EmployeeAutomationSettings {
  stayInAutoPresenceEnabled: boolean;
  stayInAutoPresenceTime: string; // HH:mm 24-hour format
  stayInAutoPresenceTimezone: string;
  stayInAutoPresenceGraceMinutes: number;
}

export interface EmployeeAutomationSettingsUpdate {
  stayInAutoPresenceEnabled?: boolean;
  stayInAutoPresenceTime?: string;
  stayInAutoPresenceTimezone?: string;
  stayInAutoPresenceGraceMinutes?: number;
}

const DEFAULT_SETTINGS: EmployeeAutomationSettings = {
  stayInAutoPresenceEnabled: true,
  stayInAutoPresenceTime: '02:00',
  stayInAutoPresenceTimezone: 'Asia/Manila',
  stayInAutoPresenceGraceMinutes: 0,
};

const mapRecordToSettings = (
  record: EmployeeAutomationSetting | null
): EmployeeAutomationSettings => {
  if (!record) {
    return { ...DEFAULT_SETTINGS };
  }

  return {
    stayInAutoPresenceEnabled: record.stayInAutoPresenceEnabled,
    stayInAutoPresenceTime: record.stayInAutoPresenceTime,
    stayInAutoPresenceTimezone: record.stayInAutoPresenceTimezone,
    stayInAutoPresenceGraceMinutes: record.stayInAutoPresenceGraceMinutes,
  };
};

const validateTime = (value: string): string => {
  if (!TIME_REGEX.test(value)) {
    throw validationError(
      'Invalid time format. Expected HH:mm in 24-hour format.'
    );
  }
  return value;
};

const validateGraceMinutes = (value: number): number => {
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
};

const sanitizeUpdate = (
  input: EmployeeAutomationSettingsUpdate
): Partial<EmployeeAutomationSettings> => {
  const next: Partial<EmployeeAutomationSettings> = {};

  if (input.stayInAutoPresenceEnabled !== undefined) {
    next.stayInAutoPresenceEnabled = Boolean(input.stayInAutoPresenceEnabled);
  }

  if (input.stayInAutoPresenceTime !== undefined) {
    next.stayInAutoPresenceTime = validateTime(input.stayInAutoPresenceTime);
  }

  if (input.stayInAutoPresenceTimezone !== undefined) {
    const trimmed = input.stayInAutoPresenceTimezone.trim();
    if (!trimmed) {
      throw validationError('Timezone cannot be empty.');
    }
    next.stayInAutoPresenceTimezone = trimmed;
  }

  if (input.stayInAutoPresenceGraceMinutes !== undefined) {
    next.stayInAutoPresenceGraceMinutes = validateGraceMinutes(
      input.stayInAutoPresenceGraceMinutes
    );
  }

  return next;
};

const isMissingRelationError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2021' || error.code === 'P2003');

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

const createDefaultRecord = async () =>
  prisma.employeeAutomationSetting.create({
    data: {
      key: SETTINGS_KEY,
      stayInAutoPresenceEnabled: DEFAULT_SETTINGS.stayInAutoPresenceEnabled,
      stayInAutoPresenceTime: DEFAULT_SETTINGS.stayInAutoPresenceTime,
      stayInAutoPresenceTimezone: DEFAULT_SETTINGS.stayInAutoPresenceTimezone,
      stayInAutoPresenceGraceMinutes:
        DEFAULT_SETTINGS.stayInAutoPresenceGraceMinutes,
    },
  });

const ensureDefaultRecord = async () => {
  const existing = await prisma.employeeAutomationSetting.findUnique({
    where: { key: SETTINGS_KEY },
  });

  if (existing) {
    return existing;
  }

  try {
    return await createDefaultRecord();
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const record = await prisma.employeeAutomationSetting.findUnique({
        where: { key: SETTINGS_KEY },
      });

      if (record) {
        return record;
      }
    }

    throw error;
  }
};

export async function getEmployeeAutomationSettings(): Promise<EmployeeAutomationSettings> {
  try {
    const record = await ensureDefaultRecord();
    return mapRecordToSettings(record);
  } catch (error) {
    if (isMissingRelationError(error)) {
      return { ...DEFAULT_SETTINGS };
    }

    throw error;
  }
}

export async function updateEmployeeAutomationSettings(
  input: EmployeeAutomationSettingsUpdate
): Promise<EmployeeAutomationSettings> {
  const sanitized = sanitizeUpdate(input);

  if (Object.keys(sanitized).length === 0) {
    return getEmployeeAutomationSettings();
  }

  const createData = {
    key: SETTINGS_KEY,
    stayInAutoPresenceEnabled:
      sanitized.stayInAutoPresenceEnabled ??
      DEFAULT_SETTINGS.stayInAutoPresenceEnabled,
    stayInAutoPresenceTime:
      sanitized.stayInAutoPresenceTime ??
      DEFAULT_SETTINGS.stayInAutoPresenceTime,
    stayInAutoPresenceTimezone:
      sanitized.stayInAutoPresenceTimezone ??
      DEFAULT_SETTINGS.stayInAutoPresenceTimezone,
    stayInAutoPresenceGraceMinutes:
      sanitized.stayInAutoPresenceGraceMinutes ??
      DEFAULT_SETTINGS.stayInAutoPresenceGraceMinutes,
  };

  const updateData = {
    ...('stayInAutoPresenceEnabled' in sanitized
      ? { stayInAutoPresenceEnabled: sanitized.stayInAutoPresenceEnabled }
      : {}),
    ...('stayInAutoPresenceTime' in sanitized
      ? { stayInAutoPresenceTime: sanitized.stayInAutoPresenceTime }
      : {}),
    ...('stayInAutoPresenceTimezone' in sanitized
      ? { stayInAutoPresenceTimezone: sanitized.stayInAutoPresenceTimezone }
      : {}),
    ...('stayInAutoPresenceGraceMinutes' in sanitized
      ? {
          stayInAutoPresenceGraceMinutes:
            sanitized.stayInAutoPresenceGraceMinutes,
        }
      : {}),
  };

  try {
    const record = await prisma.$transaction(async (tx) => {
      const existing = await tx.employeeAutomationSetting.findUnique({
        where: { key: SETTINGS_KEY },
      });

      if (!existing) {
        return tx.employeeAutomationSetting.create({ data: createData });
      }

      return tx.employeeAutomationSetting.update({
        where: { key: SETTINGS_KEY },
        data: updateData,
      });
    });

    return mapRecordToSettings(record);
  } catch (error) {
    if (isMissingRelationError(error)) {
      return { ...DEFAULT_SETTINGS };
    }

    if (isUniqueConstraintError(error)) {
      const record = await prisma.employeeAutomationSetting.findUnique({
        where: { key: SETTINGS_KEY },
      });

      if (record) {
        const updated = await prisma.employeeAutomationSetting.update({
          where: { key: SETTINGS_KEY },
          data: updateData,
        });
        return mapRecordToSettings(updated);
      }
    }

    throw error;
  }
}

export function getDefaultEmployeeAutomationSettings(): EmployeeAutomationSettings {
  return { ...DEFAULT_SETTINGS };
}
