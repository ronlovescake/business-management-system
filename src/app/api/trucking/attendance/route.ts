import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { withErrorHandler } from '@/core/api/middleware';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import {
  validateAttendance,
  validateAttendanceUpdate,
  formatValidationErrors,
} from '@/lib/validations/attendance.validation';

type TruckingAttendanceClient = Pick<
  typeof prisma,
  'truckingAttendance' | 'truckingEmployee'
>;

type TruckingAttendanceCreateData = Parameters<
  typeof prisma.truckingAttendance.create
>[0]['data'];

type TruckingAttendanceUpdateData = Parameters<
  typeof prisma.truckingAttendance.update
>[0]['data'];

type AttendanceBatchValidationError = {
  index: number;
  errors: Record<string, string>;
};

const truckingClient: TruckingAttendanceClient = prisma;

const attendanceSelect = {
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
};

const attendanceOrderBy: Prisma.TruckingAttendanceOrderByWithRelationInput[] = [
  { date: 'desc' },
  { employeeName: 'asc' },
];

export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const attendance = await truckingClient.truckingAttendance.findMany({
      where: buildAttendanceWhere(searchParams),
      select: attendanceSelect,
      orderBy: attendanceOrderBy,
    });

    return NextResponse.json(attendance);
  } catch (error) {
    logger.error('Failed to fetch trucking attendance records', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to fetch attendance records' },
      { status: 500 }
    );
  }
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();

    if (Array.isArray(body)) {
      if (body.length > 10000) {
        return NextResponse.json(
          {
            error: 'Batch size limit exceeded',
            details: `You are trying to import ${body.length} records. Maximum is 10,000 records per import.`,
            suggestion:
              'Please split your import into smaller batches of 10,000 records or less.',
          },
          { status: 413 }
        );
      }

      const { validationErrors, validatedRecords, employeeIds } =
        validateAttendanceBatch(body);

      if (validationErrors.length > 0) {
        return NextResponse.json(
          {
            error: 'Validation failed for multiple records',
            details: validationErrors,
            validCount: validatedRecords.length,
            invalidCount: validationErrors.length,
          },
          { status: 400 }
        );
      }

      const missingIds = await findMissingEmployeeIds(employeeIds);
      if (missingIds.length > 0) {
        return NextResponse.json(
          {
            error: 'Referenced employees not found',
            details: `The following employee IDs do not exist: ${missingIds.join(', ')}`,
            missingEmployeeIds: missingIds,
            suggestion:
              'Please ensure all employees exist before importing attendance records',
          },
          { status: 409 }
        );
      }

      const records = await prisma.$transaction(
        validatedRecords.map((record) =>
          truckingClient.truckingAttendance.create({
            data: record as TruckingAttendanceCreateData,
          })
        )
      );

      logger.info('Bulk trucking attendance records created', {
        count: records.length,
      });

      return NextResponse.json({
        success: true,
        count: records.length,
        records,
      });
    }

    const validation = validateAttendance(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationErrors(validation.error),
        },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    if (validatedData.employeeId) {
      const employee = await truckingClient.truckingEmployee.findFirst({
        where: {
          employeeId: validatedData.employeeId,
          deletedAt: null,
        },
      });

      if (!employee) {
        return NextResponse.json(
          {
            error: 'Employee not found',
            details: `Employee with ID '${validatedData.employeeId}' does not exist`,
            employeeId: validatedData.employeeId,
          },
          { status: 409 }
        );
      }
    }

    const attendance = await truckingClient.truckingAttendance.create({
      data: validatedData as TruckingAttendanceCreateData,
    });

    logger.info('Trucking attendance record created', { id: attendance.id });
    return NextResponse.json(attendance);
  } catch (error) {
    const knownErrorResponse = mapAttendanceMutationError(error);
    if (knownErrorResponse) {
      return knownErrorResponse;
    }

    logger.error('Failed to create trucking attendance record', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to create attendance record' },
      { status: 500 }
    );
  }
});

export const PATCH = withErrorHandler(async (request: NextRequest) => {
  try {
    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id : '';

    if (!id) {
      return NextResponse.json(
        { error: 'Attendance ID is required' },
        { status: 400 }
      );
    }

    const { id: _, ...updateData } = body;

    const validation = validateAttendanceUpdate(updateData);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationErrors(validation.error),
        },
        { status: 400 }
      );
    }

    const existingRecord = await truckingClient.truckingAttendance.findUnique({
      where: { id },
    });
    if (!existingRecord || existingRecord.deletedAt) {
      return NextResponse.json(
        { error: 'Attendance record not found or already deleted' },
        { status: 404 }
      );
    }

    const attendance = await truckingClient.truckingAttendance.update({
      where: { id },
      data: validation.data as TruckingAttendanceUpdateData,
    });

    logger.info('Trucking attendance record updated', { id: attendance.id });
    return NextResponse.json(attendance);
  } catch (error) {
    const knownErrorResponse = mapAttendanceMutationError(error, {
      includeNotFound: true,
    });
    if (knownErrorResponse) {
      return knownErrorResponse;
    }

    logger.error('Failed to update trucking attendance record', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to update attendance record' },
      { status: 500 }
    );
  }
});

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Attendance ID is required' },
        { status: 400 }
      );
    }

    const existingRecord = await truckingClient.truckingAttendance.findUnique({
      where: { id },
    });
    if (!existingRecord || existingRecord.deletedAt) {
      return NextResponse.json(
        { error: 'Attendance record not found or already deleted' },
        { status: 404 }
      );
    }

    const attendance = await truckingClient.truckingAttendance.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    logger.info('Trucking attendance record soft deleted', {
      id: attendance.id,
    });
    return NextResponse.json(attendance);
  } catch (error) {
    const knownErrorResponse = mapAttendanceMutationError(error, {
      includeNotFound: true,
    });
    if (knownErrorResponse) {
      return knownErrorResponse;
    }

    logger.error('Failed to delete trucking attendance record', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to delete attendance record' },
      { status: 500 }
    );
  }
});

function buildAttendanceWhere(searchParams: URLSearchParams) {
  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  const employeeId = searchParams.get('employeeId');
  const status = searchParams.get('status');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (employeeId) {
    const normalizedEmployeeId = sanitizers.productCode(employeeId);
    if (normalizedEmployeeId) {
      where.employeeId = normalizedEmployeeId.toUpperCase();
    }
  }

  if (status && status !== 'all') {
    where.status = sanitizers.name(status);
  }

  if (startDate || endDate) {
    const dateFilter: Record<string, unknown> = {};

    if (startDate) {
      dateFilter.gte = sanitizers.date(startDate);
    }

    if (endDate) {
      dateFilter.lte = sanitizers.date(endDate);
    }

    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }
  }

  return where;
}

function validateAttendanceBatch(records: unknown[]) {
  const validationErrors: AttendanceBatchValidationError[] = [];
  const validatedRecords: unknown[] = [];
  const employeeIds = new Set<string>();

  records.forEach((record, index) => {
    const validation = validateAttendance(record);

    if (!validation.success) {
      validationErrors.push({
        index,
        errors: formatValidationErrors(validation.error),
      });
      return;
    }

    validatedRecords.push(validation.data);

    if (
      validation.data &&
      typeof validation.data === 'object' &&
      'employeeId' in validation.data &&
      typeof validation.data.employeeId === 'string' &&
      validation.data.employeeId
    ) {
      employeeIds.add(validation.data.employeeId);
    }
  });

  return {
    validationErrors,
    validatedRecords,
    employeeIds,
  };
}

async function findMissingEmployeeIds(employeeIds: Set<string>) {
  if (employeeIds.size === 0) {
    return [];
  }

  const existingEmployees = await truckingClient.truckingEmployee.findMany({
    where: {
      employeeId: { in: Array.from(employeeIds) },
      deletedAt: null,
    },
    select: { employeeId: true },
  });

  const existingIds = new Set(
    existingEmployees.map((employee) => employee.employeeId)
  );

  return Array.from(employeeIds).filter(
    (employeeId) => !existingIds.has(employeeId)
  );
}

function mapAttendanceMutationError(
  error: unknown,
  options: { includeNotFound?: boolean } = {}
) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }

  if (options.includeNotFound && error.code === 'P2025') {
    return NextResponse.json(
      { error: 'Attendance record not found or already deleted' },
      { status: 404 }
    );
  }

  if (error.code === 'P2002') {
    const target = (error.meta?.target as string[]) || [];
    return NextResponse.json(
      {
        error: 'Duplicate attendance record',
        details: `An attendance record with this ${target.join(', ')} already exists`,
        field: target[0],
      },
      { status: 409 }
    );
  }

  if (error.code === 'P2003') {
    return NextResponse.json(
      {
        error: 'Referenced employee not found',
        details: 'The employee ID does not exist in the database',
      },
      { status: 409 }
    );
  }

  return null;
}
