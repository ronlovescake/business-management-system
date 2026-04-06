import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/core/api/middleware';
import { ApiResponseUtil } from '@/core/api/response';
import { logger } from '@/lib/logger';
import {
  formatValidationErrors,
  scheduleUpdateSchema,
  validateSchedule,
} from '@/lib/validations/schedule.validation';
import {
  ensureScheduleArray,
  mapScheduleToResponse,
  parseScheduleString,
  type PersistableScheduleInput,
  type ScheduleEntity,
  type SchedulePayload,
  type ScheduleUpdateInput,
  toScheduleCreateInput,
  toScheduleUpdateInput,
} from '@/modules/shared/employees/api/scheduleRouteUtils';

const SCHEDULE_BULK_LIMIT = 10000;

export const scheduleSelect = {
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
} as const;

export const scheduleOrderBy = [
  { date: 'desc' },
  { startTime: 'asc' },
] as const;

type SchedulePair = {
  employeeId: string;
  date: string;
};

type ScheduleConflictRecord = {
  employeeId: string;
  date: string;
};

type DuplicateRequestEntry = {
  key: string;
  firstIndex: number;
  duplicateIndexes: number[];
};

interface ScheduleRouteLogMessages {
  created: string;
  updated: string;
  deleted: string;
}

export interface ScheduleRouteFactoryConfig {
  scheduleModel: {
    findAll: () => Promise<ScheduleEntity[]>;
    findByIds: (ids: string[]) => Promise<ScheduleEntity[]>;
    findExistingConflicts: (
      pairs: SchedulePair[]
    ) => Promise<ScheduleConflictRecord[]>;
    findById: (id: string) => Promise<ScheduleEntity | null>;
    findOtherByEmployeeAndDate: (
      id: string,
      employeeId: string,
      date: string
    ) => Promise<{ id: string } | null>;
    createMany: (
      records: PersistableScheduleInput[]
    ) => Promise<{ count: number }>;
    update: (id: string, data: ScheduleUpdateInput) => Promise<ScheduleEntity>;
    softDelete: (id: string) => Promise<ScheduleEntity>;
  };
  employeeModel: {
    findExistingIds: (employeeIds: string[]) => Promise<string[]>;
  };
  logMessages: ScheduleRouteLogMessages;
}

function buildUnexpectedErrorResponse(message: string) {
  return () => ApiResponseUtil.error(message, 500);
}

function buildMutationErrorResponse(
  message: string,
  options: { includeNotFound?: boolean } = {}
) {
  return (error: unknown) => {
    const mapped = mapScheduleMutationError(error, options);
    return mapped ?? ApiResponseUtil.error(message, 500);
  };
}

function mapScheduleMutationError(
  error: unknown,
  options: { includeNotFound?: boolean } = {}
) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  if (options.includeNotFound && error.code === 'P2025') {
    return ApiResponseUtil.error('Schedule not found or already deleted', 404);
  }

  if (error.code === 'P2002') {
    const target = (error.meta?.target as string[]) || [];
    const detail = target.length
      ? `A schedule with this ${target.join(', ')} already exists`
      : 'A schedule with the same unique fields already exists';

    return ApiResponseUtil.error('Duplicate schedule', 409, detail, {
      field: target[0],
    });
  }

  if (error.code === 'P2003') {
    return ApiResponseUtil.error(
      'Referenced employee not found',
      409,
      'One or more employee IDs do not exist in the database'
    );
  }

  return null;
}

function findDuplicateEntries(records: PersistableScheduleInput[]) {
  const seenKeys = new Map<
    string,
    { firstIndex: number; duplicates: number[] }
  >();

  records.forEach((record, index) => {
    const key = `${record.employeeId}__${record.date}`;
    const existing = seenKeys.get(key);

    if (existing) {
      existing.duplicates.push(index);
      return;
    }

    seenKeys.set(key, { firstIndex: index, duplicates: [] });
  });

  return Array.from(seenKeys.entries())
    .filter(([, value]) => value.duplicates.length > 0)
    .map(([key, value]) => ({
      key,
      firstIndex: value.firstIndex,
      duplicateIndexes: value.duplicates,
    })) as DuplicateRequestEntry[];
}

async function extractScheduleId(request: NextRequest) {
  const url = new URL(request.url);
  const queryId = parseScheduleString(url.searchParams.get('id'));
  if (queryId) {
    return queryId;
  }

  try {
    const payload = (await request.json()) as SchedulePayload;
    return parseScheduleString(payload.id);
  } catch {
    return '';
  }
}

export function createScheduleRoutes(config: ScheduleRouteFactoryConfig) {
  const GET = withErrorHandler(
    async () => {
      const schedules = await config.scheduleModel.findAll();
      return ApiResponseUtil.success(schedules.map(mapScheduleToResponse));
    },
    {
      onError: buildUnexpectedErrorResponse('Failed to fetch schedules'),
    }
  );

  const POST = withErrorHandler(
    async (request: NextRequest) => {
      const payload = await request.json();
      const items = ensureScheduleArray(payload);

      if (items.length === 0) {
        return ApiResponseUtil.error(
          'Request body must contain schedule data',
          400
        );
      }

      if (items.length > SCHEDULE_BULK_LIMIT) {
        return ApiResponseUtil.payloadTooLarge(
          items.length,
          SCHEDULE_BULK_LIMIT
        );
      }

      const validationErrors: Array<{
        index: number;
        errors: Record<string, string>;
      }> = [];
      const validatedInputs: PersistableScheduleInput[] = [];
      const employeeIds = new Set<string>();

      items.forEach((item, index) => {
        try {
          const createInput = toScheduleCreateInput(item);
          const validation = validateSchedule(createInput);

          if (!validation.success) {
            validationErrors.push({
              index,
              errors: formatValidationErrors(validation.error),
            });
            return;
          }

          validatedInputs.push({
            id: randomUUID(),
            ...validation.data,
            notes: validation.data.notes ?? null,
            templateId: validation.data.templateId ?? null,
            recurrenceId: validation.data.recurrenceId ?? null,
          });
          employeeIds.add(createInput.employeeId);
        } catch (error) {
          validationErrors.push({
            index,
            errors: {
              _error:
                error instanceof Error
                  ? error.message
                  : 'Invalid schedule data',
            },
          });
        }
      });

      if (validationErrors.length > 0) {
        return ApiResponseUtil.error(
          'Validation failed for multiple records',
          400,
          `Valid: ${validatedInputs.length}, Invalid: ${validationErrors.length}`,
          {
            meta: {
              details: validationErrors,
              validCount: validatedInputs.length,
              invalidCount: validationErrors.length,
            },
          }
        );
      }

      const duplicateEntries = findDuplicateEntries(validatedInputs);
      if (duplicateEntries.length > 0) {
        return ApiResponseUtil.error(
          'Duplicate schedules in request',
          409,
          'Each employee can only have one schedule per date. Remove duplicates and try again.',
          {
            meta: { duplicates: duplicateEntries },
          }
        );
      }

      const pairs = validatedInputs.map(({ employeeId, date }) => ({
        employeeId,
        date,
      }));

      if (pairs.length > 0) {
        const existingConflicts =
          await config.scheduleModel.findExistingConflicts(pairs);

        if (existingConflicts.length > 0) {
          return ApiResponseUtil.error(
            'Duplicate schedules exist',
            409,
            'A schedule already exists for one or more employee/date combinations.',
            {
              meta: { conflicts: existingConflicts },
            }
          );
        }
      }

      if (employeeIds.size > 0) {
        const existingIds = new Set(
          await config.employeeModel.findExistingIds(Array.from(employeeIds))
        );
        const missingIds = Array.from(employeeIds).filter(
          (employeeId) => !existingIds.has(employeeId)
        );

        if (missingIds.length > 0) {
          return ApiResponseUtil.error(
            'Referenced employees not found',
            409,
            `The following employee IDs do not exist: ${missingIds.join(', ')}`,
            {
              suggestion:
                'Please ensure all employees exist before importing schedules',
              meta: { missingEmployeeIds: missingIds },
            }
          );
        }
      }

      await config.scheduleModel.createMany(validatedInputs);

      const created = await config.scheduleModel.findByIds(
        validatedInputs.map((record) => record.id)
      );
      const schedules = created.map(mapScheduleToResponse);

      logger.info(config.logMessages.created, { count: schedules.length });

      return ApiResponseUtil.success(
        {
          count: schedules.length,
          schedules,
        },
        `Successfully saved ${schedules.length} schedule(s)`,
        201
      );
    },
    {
      onError: buildMutationErrorResponse('Failed to create schedules'),
    }
  );

  const PATCH = withErrorHandler(
    async (request: NextRequest) => {
      const payload = (await request.json()) as SchedulePayload & {
        id?: string;
      };
      const id = parseScheduleString(payload.id);

      if (!id) {
        return ApiResponseUtil.error('Schedule ID is required', 400);
      }

      const existing = await config.scheduleModel.findById(id);
      if (!existing) {
        return ApiResponseUtil.error(
          'Schedule not found or already deleted',
          404
        );
      }

      const updateData = toScheduleUpdateInput(payload);
      if (Object.keys(updateData).length === 0) {
        return ApiResponseUtil.error(
          'No valid fields supplied for update',
          400
        );
      }

      const validation = scheduleUpdateSchema.safeParse(updateData);
      if (!validation.success) {
        return ApiResponseUtil.error('Validation failed', 400, undefined, {
          validationErrors: formatValidationErrors(validation.error),
        });
      }

      const targetEmployeeId =
        validation.data.employeeId ?? existing.employeeId;
      const targetDate = validation.data.date ?? existing.date;

      const conflicting = await config.scheduleModel.findOtherByEmployeeAndDate(
        id,
        targetEmployeeId,
        targetDate
      );

      if (conflicting) {
        return ApiResponseUtil.error(
          'Duplicate schedule',
          409,
          'Another schedule already exists for this employee and date.'
        );
      }

      const updated = await config.scheduleModel.update(id, validation.data);

      logger.info(config.logMessages.updated, { id });

      return ApiResponseUtil.success(
        { schedule: mapScheduleToResponse(updated) },
        'Schedule updated successfully'
      );
    },
    {
      onError: buildMutationErrorResponse('Failed to update schedule', {
        includeNotFound: true,
      }),
    }
  );

  const DELETE = withErrorHandler(
    async (request: NextRequest) => {
      const id = await extractScheduleId(request);

      if (!id) {
        return ApiResponseUtil.error('Schedule ID is required', 400);
      }

      const deleted = await config.scheduleModel.softDelete(id);

      logger.info(config.logMessages.deleted, { id });

      return ApiResponseUtil.success(
        { schedule: mapScheduleToResponse(deleted) },
        'Schedule deleted successfully'
      );
    },
    {
      onError: buildMutationErrorResponse('Failed to delete schedule', {
        includeNotFound: true,
      }),
    }
  );

  return { GET, POST, PATCH, DELETE };
}
