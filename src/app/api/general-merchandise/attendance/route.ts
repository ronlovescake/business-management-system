import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ApiResponseUtil } from '@/core/api/response';
import { sanitizers } from '@/lib/security/sanitize';
import {
  validateAttendance,
  validateAttendanceUpdate,
  formatValidationErrors,
} from '@/lib/validations/attendance.validation';

type GMAttendanceClient = Pick<
  typeof prisma,
  'generalMerchandiseAttendance' | 'generalMerchandiseEmployee'
>;

type GMAttendanceCreateData = Parameters<
  typeof prisma.generalMerchandiseAttendance.create
>[0]['data'];
type GMAttendanceUpdateData = Parameters<
  typeof prisma.generalMerchandiseAttendance.update
>[0]['data'];

const gmClient: GMAttendanceClient = prisma;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (employeeId) {
      const normalizedEmployeeId = sanitizers.productCode(employeeId);
      if (normalizedEmployeeId) {
        where.employeeId = normalizedEmployeeId.toUpperCase();
      }
    }

    if (status && status !== 'all') {
      where.status = sanitizers.name(status);
    }

    if (startDate) {
      if (!where.date) {
        where.date = {};
      }
      (where.date as Record<string, unknown>).gte = sanitizers.date(startDate);
    }

    if (endDate) {
      if (!where.date) {
        where.date = {};
      }
      (where.date as Record<string, unknown>).lte = sanitizers.date(endDate);
    }

    const attendance = await gmClient.generalMerchandiseAttendance.findMany({
      where,
      select: {
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
      },
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });

    return ApiResponseUtil.success(attendance);
  } catch (error) {
    logger.error('Failed to fetch GM attendance records', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return ApiResponseUtil.error('Failed to fetch attendance records', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (Array.isArray(body)) {
      if (body.length > 10000) {
        return ApiResponseUtil.error(
          'Batch size limit exceeded',
          413,
          `You are trying to import ${body.length} records. Maximum is 10,000 records per import.`,
          {
            suggestion:
              'Please split your import into smaller batches of 10,000 records or less.',
          }
        );
      }

      const validationErrors: Array<{
        index: number;
        errors: Record<string, string>;
      }> = [];
      const validatedRecords: Array<(typeof body)[0]> = [];
      const employeeIds = new Set<string>();

      for (let i = 0; i < body.length; i++) {
        const record = body[i];
        const validation = validateAttendance(record);

        if (!validation.success) {
          validationErrors.push({
            index: i,
            errors: formatValidationErrors(validation.error),
          });
        } else {
          validatedRecords.push(validation.data);
          if (record.employeeId) {
            employeeIds.add(record.employeeId);
          }
        }
      }

      if (validationErrors.length > 0) {
        return ApiResponseUtil.error(
          'Validation failed for multiple records',
          400,
          undefined,
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
        const existingEmployees =
          await gmClient.generalMerchandiseEmployee.findMany({
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

      const records = await prisma.$transaction(
        validatedRecords.map((record) =>
          gmClient.generalMerchandiseAttendance.create({
            data: record as GMAttendanceCreateData,
          })
        )
      );

      logger.info('GM bulk attendance records created', {
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
      const employee = await gmClient.generalMerchandiseEmployee.findFirst({
        where: {
          employeeId: validatedData.employeeId,
          deletedAt: null,
        },
      });

      if (!employee) {
        return ApiResponseUtil.error(
          'Employee not found',
          409,
          `Employee ID ${validatedData.employeeId} does not exist`
        );
      }
    }

    const record = await gmClient.generalMerchandiseAttendance.create({
      data: validatedData as GMAttendanceCreateData,
    });

    return ApiResponseUtil.success(record, undefined, 201);
  } catch (error) {
    logger.error('Failed to create GM attendance record', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return ApiResponseUtil.error('Failed to create attendance record', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    const id = typeof body?.id === 'string' ? body.id : '';

    if (!id) {
      return ApiResponseUtil.error('Attendance ID is required', 400);
    }

    const validation = validateAttendanceUpdate(body);
    if (!validation.success) {
      return ApiResponseUtil.error('Validation failed', 400, undefined, {
        validationErrors: formatValidationErrors(validation.error),
      });
    }

    const updates = validation.data;

    const record = await gmClient.generalMerchandiseAttendance.update({
      where: { id },
      data: updates as GMAttendanceUpdateData,
    });

    return ApiResponseUtil.success(record);
  } catch (error) {
    logger.error('Failed to update GM attendance record', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return ApiResponseUtil.error('Failed to update attendance record', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return ApiResponseUtil.error('Attendance ID is required', 400);
    }

    await gmClient.generalMerchandiseAttendance.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return ApiResponseUtil.ok();
  } catch (error) {
    logger.error('Failed to delete GM attendance record', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return ApiResponseUtil.error('Failed to delete attendance record', 500);
  }
}
