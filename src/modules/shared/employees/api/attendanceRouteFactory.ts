import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { withErrorHandler } from '@/core/api/middleware';
import { ApiResponseUtil } from '@/core/api/response';
import { logger } from '@/lib/logger';
import {
  type AttendanceUpdateInput,
  formatValidationErrors,
  validateAttendance,
  validateAttendanceUpdate,
} from '@/lib/validations/attendance.validation';
import {
  buildAttendanceWhere,
  validateAttendanceBatch,
} from '@/modules/shared/employees/api/attendanceRouteUtils';

const BULK_ATTENDANCE_LIMIT = 10000;

export const attendanceSelect = {
  id: true,
  employeeId: true,
  employeeName: true,
  department: true,
  position: true,
  date: true,
  timeIn: true,
  timeOut: true,
  totalHours: true,
  status: true,
  details: true,
  break1Start: true,
  break1End: true,
  lunchStart: true,
  lunchEnd: true,
  break2Start: true,
  break2End: true,
} as const;

export const attendanceOrderBy = [
  { date: 'desc' },
  { employeeName: 'asc' },
] as const;

type AttendanceFindManyArgs = {
  where: ReturnType<typeof buildAttendanceWhere>;
  select: typeof attendanceSelect;
  orderBy: typeof attendanceOrderBy;
};

type EmployeeFindManyArgs = {
  where: {
    employeeId: { in: string[] };
    deletedAt: null;
  };
  select: { employeeId: true };
};

type EmployeeFindFirstArgs = {
  where: {
    employeeId: string;
    deletedAt: null;
  };
};

interface AttendanceRouteLogMessages {
  created: string;
  bulkCreated: string;
  updated: string;
  deleted: string;
}

export interface AttendanceRouteFactoryConfig<TRecord> {
  attendanceModel: {
    findMany: (args: AttendanceFindManyArgs) => Promise<TRecord[]>;
    create: (data: AttendanceInputLike) => Promise<TRecord>;
    createMany: (records: AttendanceInputLike[]) => Promise<TRecord[]>;
    update: (id: string, data: AttendanceUpdateInputLike) => Promise<TRecord>;
    softDelete: (id: string) => Promise<TRecord>;
  };
  employeeModel: {
    findFirst: (
      args: EmployeeFindFirstArgs
    ) => Promise<{ employeeId: string } | null>;
    findMany: (
      args: EmployeeFindManyArgs
    ) => Promise<Array<{ employeeId: string }>>;
  };
  logMessages: AttendanceRouteLogMessages;
}

type AttendanceInputLike = AttendanceUpdateInput & {
  employeeId: string;
  employeeName: string;
  department: string;
  position: string;
  date: string;
  timeIn: string;
  timeOut: string;
  totalHours: number;
  status: 'present' | 'late' | 'absent' | 'on-leave';
};

type AttendanceUpdateInputLike = AttendanceUpdateInput | { deletedAt: Date };

function buildUnexpectedErrorResponse(message: string) {
  return () => ApiResponseUtil.error(message, 500);
}

function buildMutationErrorResponse(
  message: string,
  options: { includeNotFound?: boolean } = {}
) {
  return (error: unknown) => {
    const mapped = mapAttendanceMutationError(error, options);
    return mapped ?? ApiResponseUtil.error(message, 500);
  };
}

function mapAttendanceMutationError(
  error: unknown,
  options: { includeNotFound?: boolean } = {}
) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  if (options.includeNotFound && error.code === 'P2025') {
    return ApiResponseUtil.error(
      'Attendance record not found or already deleted',
      404
    );
  }

  if (error.code === 'P2002') {
    const target = (error.meta?.target as string[]) || [];
    const detail = target.length
      ? `An attendance record with this ${target.join(', ')} already exists`
      : 'An attendance record with the same unique fields already exists';

    return ApiResponseUtil.error('Duplicate attendance record', 409, detail, {
      field: target[0],
    });
  }

  if (error.code === 'P2003') {
    return ApiResponseUtil.error(
      'Referenced employee not found',
      409,
      'The employee ID does not exist in the database'
    );
  }

  return null;
}

export function createAttendanceRoutes<TRecord>(
  config: AttendanceRouteFactoryConfig<TRecord>
) {
  const GET = withErrorHandler(
    async (request: NextRequest) => {
      const { searchParams } = new URL(request.url);
      const attendance = await config.attendanceModel.findMany({
        where: buildAttendanceWhere(searchParams),
        select: attendanceSelect,
        orderBy: attendanceOrderBy,
      });

      return ApiResponseUtil.success(attendance);
    },
    {
      onError: buildUnexpectedErrorResponse(
        'Failed to fetch attendance records'
      ),
    }
  );

  const POST = withErrorHandler(
    async (request: NextRequest) => {
      const body = await request.json();

      if (Array.isArray(body)) {
        if (body.length > BULK_ATTENDANCE_LIMIT) {
          return ApiResponseUtil.payloadTooLarge(
            body.length,
            BULK_ATTENDANCE_LIMIT
          );
        }

        const { validationErrors, validatedRecords, employeeIds } =
          validateAttendanceBatch(body);

        if (validationErrors.length > 0) {
          return ApiResponseUtil.error(
            'Validation failed for multiple records',
            400,
            `Valid: ${validatedRecords.length}, Invalid: ${validationErrors.length}`,
            {
              meta: {
                details: validationErrors,
                validCount: validatedRecords.length,
                invalidCount: validationErrors.length,
              },
            }
          );
        }

        if (employeeIds.size > 0) {
          const existingEmployees = await config.employeeModel.findMany({
            where: {
              employeeId: { in: Array.from(employeeIds) },
              deletedAt: null,
            },
            select: { employeeId: true },
          });

          const existingIds = new Set(
            existingEmployees.map((employee) => employee.employeeId)
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
                  'Please ensure all employees exist before importing attendance records',
                meta: { missingEmployeeIds: missingIds },
              }
            );
          }
        }

        const records =
          await config.attendanceModel.createMany(validatedRecords);

        logger.info(config.logMessages.bulkCreated, {
          count: records.length,
        });

        return ApiResponseUtil.success({
          count: records.length,
          records,
        });
      }

      const validation = validateAttendance(body);
      if (!validation.success) {
        return ApiResponseUtil.error('Validation failed', 400, undefined, {
          validationErrors: formatValidationErrors(validation.error),
        });
      }

      const validatedData = validation.data;

      if (validatedData.employeeId) {
        const employee = await config.employeeModel.findFirst({
          where: {
            employeeId: validatedData.employeeId,
            deletedAt: null,
          },
        });

        if (!employee) {
          return ApiResponseUtil.error(
            'Employee not found',
            409,
            `Employee with ID '${validatedData.employeeId}' does not exist`,
            {
              meta: { employeeId: validatedData.employeeId },
            }
          );
        }
      }

      const attendance = await config.attendanceModel.create(validatedData);

      logger.info(config.logMessages.created, { id: getRecordId(attendance) });

      return ApiResponseUtil.success(attendance, undefined, 201);
    },
    {
      onError: buildMutationErrorResponse('Failed to create attendance record'),
    }
  );

  const PATCH = withErrorHandler(
    async (request: NextRequest) => {
      const body = await request.json();
      const id = typeof body?.id === 'string' ? body.id : '';

      if (!id) {
        return ApiResponseUtil.error('Attendance ID is required', 400);
      }

      const { id: _id, ...updateData } = body as AttendanceUpdateInput & {
        id?: string;
      };
      const validation = validateAttendanceUpdate(updateData);

      if (!validation.success) {
        return ApiResponseUtil.error('Validation failed', 400, undefined, {
          validationErrors: formatValidationErrors(validation.error),
        });
      }

      const attendance = await config.attendanceModel.update(
        id,
        validation.data
      );

      logger.info(config.logMessages.updated, { id: getRecordId(attendance) });

      return ApiResponseUtil.success(attendance);
    },
    {
      onError: buildMutationErrorResponse(
        'Failed to update attendance record',
        {
          includeNotFound: true,
        }
      ),
    }
  );

  const DELETE = withErrorHandler(
    async (request: NextRequest) => {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return ApiResponseUtil.error('Attendance ID is required', 400);
      }

      const attendance = await config.attendanceModel.softDelete(id);

      logger.info(config.logMessages.deleted, { id: getRecordId(attendance) });

      return ApiResponseUtil.ok();
    },
    {
      onError: buildMutationErrorResponse(
        'Failed to delete attendance record',
        {
          includeNotFound: true,
        }
      ),
    }
  );

  return { GET, POST, PATCH, DELETE };
}

function getRecordId(record: unknown) {
  if (record && typeof record === 'object' && 'id' in record) {
    return String(record.id);
  }

  return undefined;
}
