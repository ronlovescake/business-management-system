import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Fetch salary history for an employee
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;

    const salaryHistory = await prisma.salaryHistory.findMany({
      where: {
        employeeId,
        deletedAt: null,
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    });

    return NextResponse.json(salaryHistory);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error fetching salary history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch salary history' },
      { status: 500 }
    );
  }
}

// POST - Add new salary adjustment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = params.id;
    const body = await request.json();

    const { effectiveDate, basicSalary, allowance, reason, notes } = body;

    // Validate required fields
    if (!effectiveDate || basicSalary === undefined) {
      return NextResponse.json(
        { error: 'Effective date and basic salary are required' },
        { status: 400 }
      );
    }

    // Get employee info
    const employee = await prisma.employee.findUnique({
      where: { employeeId },
      select: { name: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const totalSalary = basicSalary + (allowance || 0);

    const salaryRecord = await prisma.salaryHistory.create({
      data: {
        employeeId,
        employeeName: employee.name,
        effectiveDate,
        basicSalary,
        allowance: allowance || 0,
        totalSalary,
        reason: reason || null,
        notes: notes || null,
      },
    });

    return NextResponse.json(salaryRecord, { status: 201 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error creating salary record:', error);
    return NextResponse.json(
      { error: 'Failed to create salary record' },
      { status: 500 }
    );
  }
}
