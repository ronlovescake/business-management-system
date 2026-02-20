import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

const SETTINGS_KEY = 'default';
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_GRACE_MINUTES = 120;

const validationError = (message: string): Error => {
  const error = new Error(message);
  error.name = 'ValidationError';
  return error;
};

export interface GeneralMerchandiseEmployeeAutomationSettings {
  stayInAutoPresenceEnabled: boolean;
  stayInAutoPresenceTime: string;
  stayInAutoPresenceTimezone: string;
  stayInAutoPresenceGraceMinutes: number;
}

export interface GeneralMerchandiseEmployeeAutomationSettingsUpdate {
  stayInAutoPresenceEnabled?: boolean;
  stayInAutoPresenceTime?: string;
  stayInAutoPresenceTimezone?: string;
  stayInAutoPresenceGraceMinutes?: number;
}

const DEFAULT_SETTINGS: GeneralMerchandiseEmployeeAutomationSettings = {
  stayInAutoPresenceEnabled: true,
  stayInAutoPresenceTime: '02:00',
  stayInAutoPresenceTimezone: 'Asia/Manila',
  stayInAutoPresenceGraceMinutes: 0,
};

type GeneralMerchandiseEmployeeAutomationSettingRecord = {
  stayInAutoPresenceEnabled: boolean;
  stayInAutoPresenceTime: string;
  stayInAutoPresenceTimezone: string;
  stayInAutoPresenceGraceMinutes: number;
};

type GMEmployeeAutomationSettingsClient = Pick<
  typeof prisma,
  'generalMerchandiseEmployeeAutomationSetting'
>;

const gmClient: GMEmployeeAutomationSettingsClient = prisma;

const mapRecordToSettings = (
  record: GeneralMerchandiseEmployeeAutomationSettingRecord | null
): GeneralMerchandiseEmployeeAutomationSettings => {
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
  input: GeneralMerchandiseEmployeeAutomationSettingsUpdate
): Partial<GeneralMerchandiseEmployeeAutomationSettings> => {
  const next: Partial<GeneralMerchandiseEmployeeAutomationSettings> = {};

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

const ensureDefaultRecord = async () =>
  gmClient.generalMerchandiseEmployeeAutomationSetting.upsert({
    where: { key: SETTINGS_KEY },
    update: {},
    create: {
      key: SETTINGS_KEY,
      stayInAutoPresenceEnabled: DEFAULT_SETTINGS.stayInAutoPresenceEnabled,
      stayInAutoPresenceTime: DEFAULT_SETTINGS.stayInAutoPresenceTime,
      stayInAutoPresenceTimezone: DEFAULT_SETTINGS.stayInAutoPresenceTimezone,
      stayInAutoPresenceGraceMinutes:
        DEFAULT_SETTINGS.stayInAutoPresenceGraceMinutes,
    },
  });

const isMissingRelationError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2021' || error.code === 'P2003');

export async function getGeneralMerchandiseEmployeeAutomationSettings(): Promise<GeneralMerchandiseEmployeeAutomationSettings> {
  try {
    const record = await ensureDefaultRecord();
    return mapRecordToSettings(
      record as GeneralMerchandiseEmployeeAutomationSettingRecord
    );
  } catch (error) {
    if (isMissingRelationError(error)) {
      return { ...DEFAULT_SETTINGS };
    }

    throw error;
  }
}

export async function updateGeneralMerchandiseEmployeeAutomationSettings(
  input: GeneralMerchandiseEmployeeAutomationSettingsUpdate
): Promise<GeneralMerchandiseEmployeeAutomationSettings> {
  const sanitized = sanitizeUpdate(input);

  if (Object.keys(sanitized).length === 0) {
    return getGeneralMerchandiseEmployeeAutomationSettings();
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
    const record =
      await gmClient.generalMerchandiseEmployeeAutomationSetting.upsert({
        where: { key: SETTINGS_KEY },
        update: updateData,
        create: createData,
      });

    return mapRecordToSettings(
      record as GeneralMerchandiseEmployeeAutomationSettingRecord
    );
  } catch (error) {
    if (isMissingRelationError(error)) {
      return { ...DEFAULT_SETTINGS };
    }

    throw error;
  }
}

export function getDefaultGeneralMerchandiseEmployeeAutomationSettings(): GeneralMerchandiseEmployeeAutomationSettings {
  return { ...DEFAULT_SETTINGS };
}
