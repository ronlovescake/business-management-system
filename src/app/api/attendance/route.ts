import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import {
  validateAttendance,
  formatValidationErrors,
} from '@/lib/validations/attendance.validation';

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

    // Sanitize query parameters
    if (employeeId) {
      where.employeeId = sanitizers.productCode(employeeId);
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

    // ========================================================================
    // ⚠️ QUERY OPTIMIZATION - Use select to fetch only needed fields
    // ========================================================================
    // Fetch only essential fields for list view (exclude break times if not needed)
    // ========================================================================
    const attendance = await prisma.attendance.findMany({
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
        // Break times included (needed for timesheet calculations)
        break1Start: true,
        break1End: true,
        lunchStart: true,
        lunchEnd: true,
        break2Start: true,
        break2End: true,
        // Exclude notes (can be fetched separately if needed)
      },
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });

    return NextResponse.json(attendance);
  } catch (error) {
    logger.error('Failed to fetch attendance records', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to fetch attendance records' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle bulk create
    if (Array.isArray(body)) {
      // ========================================================================
      // ⚠️ BATCH SIZE LIMIT - Maximum 10000 records per import
      // ========================================================================
      if (body.length > 10000) {
        return NextResponse.json(
          {
            error: 'Batch size limit exceeded',
            details: `You are trying to import ${body.length} records. Maximum is 10,000 records per import.`,
            suggestion:
              'Please split your import into smaller batches of 10,000 records or less.',
          },
          { status: 413 } // Payload Too Large
        );
      }

      // Validate all records
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

      // Check if all referenced employees exist
      if (employeeIds.size > 0) {
        const existingEmployees = await prisma.employee.findMany({
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
      }

      // Use individual creates in a transaction to get the created records back
      const records = await prisma.$transaction(
        validatedRecords.map((record) =>
          prisma.attendance.create({
            data: record as Prisma.AttendanceCreateInput,
          })
        )
      );

      logger.info('Bulk attendance records created', {
        count: records.length,
      });

      return NextResponse.json({
        success: true,
        count: records.length,
        records: records,
      });
    }

    // Single create - validate first
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

    // Check if employee exists
    if (body.employeeId) {
      const employee = await prisma.employee.findFirst({
        where: {
          employeeId: body.employeeId,
          deletedAt: null,
        },
      });

      if (!employee) {
        return NextResponse.json(
          {
            error: 'Employee not found',
            details: `Employee with ID '${body.employeeId}' does not exist`,
            employeeId: body.employeeId,
          },
          { status: 409 }
        );
      }
    }

    const attendance = await prisma.attendance.create({
      data: validation.data,
    });

    logger.info('Attendance record created', { id: attendance.id });
    return NextResponse.json(attendance);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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
    }

    logger.error('Failed to create attendance record', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to create attendance record' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Attendance ID is required' },
        { status: 400 }
      );
    }

    // Validate update data
    const validation = validateAttendance(updateData);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationErrors(validation.error),
        },
        { status: 400 }
      );
    }

    const attendance = await prisma.attendance.update({
      where: { id, deletedAt: null },
      data: validation.data,
    });

    logger.info('Attendance record updated', { id: attendance.id });
    return NextResponse.json(attendance);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
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
    }

    logger.error('Failed to update attendance record', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to update attendance record' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Attendance ID is required' },
        { status: 400 }
      );
    }

    // Soft delete
    const attendance = await prisma.attendance.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    logger.info('Attendance record soft deleted', { id: attendance.id });
    return NextResponse.json(attendance);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Attendance record not found or already deleted' },
          { status: 404 }
        );
      }
    }

    logger.error('Failed to delete attendance record', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to delete attendance record' },
      { status: 500 }
    );
  }
}
