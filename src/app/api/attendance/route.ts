import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
      where.employeeId = employeeId;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (startDate) {
      if (!where.date) {
        where.date = {};
      }
      (where.date as Record<string, unknown>).gte = startDate;
    }

    if (endDate) {
      if (!where.date) {
        where.date = {};
      }
      (where.date as Record<string, unknown>).lte = endDate;
    }

    const attendance = await prisma.attendance.findMany({
      where,
      orderBy: [{ date: 'desc' }, { employeeName: 'asc' }],
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance:', error);
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
      // Use individual creates in a transaction to get the created records back
      const records = await prisma.$transaction(
        body.map((record) => prisma.attendance.create({ data: record }))
      );

      return NextResponse.json({
        success: true,
        count: records.length,
        records: records,
      });
    }

    // Single create
    const attendance = await prisma.attendance.create({
      data: body,
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error creating attendance:', error);
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

    const attendance = await prisma.attendance.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error updating attendance:', error);
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
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error deleting attendance:', error);
    return NextResponse.json(
      { error: 'Failed to delete attendance record' },
      { status: 500 }
    );
  }
}
