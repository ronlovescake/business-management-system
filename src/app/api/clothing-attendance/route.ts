import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * GET /api/clothing-attendance
 * Fetch all attendance records
 */
export async function GET() {
  try {
    const attendance = await prisma.attendance.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });

    return NextResponse.json(attendance);
  } catch (error) {
    logger.error('Error fetching attendance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attendance records' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clothing-attendance
 * Create attendance records (single or batch)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle both single record and batch records
    const records = Array.isArray(body) ? body : [body];

    // Validate required fields
    for (const record of records) {
      if (
        !record.employeeId ||
        !record.employeeName ||
        !record.department ||
        !record.position ||
        !record.date ||
        !record.timeIn ||
        !record.timeOut ||
        record.totalHours === undefined ||
        !record.status
      ) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }
    }

    // Create attendance records
    const created = await prisma.attendance.createMany({
      data: records.map((record) => ({
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        department: record.department,
        position: record.position,
        date: record.date,
        timeIn: record.timeIn,
        timeOut: record.timeOut,
        break1Start: record.break1Start || null,
        break1End: record.break1End || null,
        lunchStart: record.lunchStart || null,
        lunchEnd: record.lunchEnd || null,
        break2Start: record.break2Start || null,
        break2End: record.break2End || null,
        totalHours: record.totalHours,
        status: record.status,
        details: record.details || null,
        notes: record.notes || null,
      })),
      skipDuplicates: false,
    });

    return NextResponse.json(
      {
        message: `Created ${created.count} attendance record(s)`,
        count: created.count,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Error creating attendance:', error);
    return NextResponse.json(
      { error: 'Failed to create attendance records' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/clothing-attendance
 * Update an attendance record
 */
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

    const updated = await prisma.attendance.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Attendance record updated successfully',
      attendance: updated,
    });
  } catch (error) {
    logger.error('Error updating attendance:', error);
    return NextResponse.json(
      { error: 'Failed to update attendance record' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clothing-attendance
 * Soft delete an attendance record
 */
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

    await prisma.attendance.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: 'Attendance record deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting attendance:', error);
    return NextResponse.json(
      { error: 'Failed to delete attendance record' },
      { status: 500 }
    );
  }
}
