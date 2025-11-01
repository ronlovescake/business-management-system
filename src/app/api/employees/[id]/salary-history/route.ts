import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

type EmployeeIdentifier = {
  id: number | null;
  employeeId: string | null;
  name: string | null;
};

interface SalaryHistoryRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  effectiveDate: string;
  basicSalary: number;
  allowance: number;
  totalSalary: number;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
}

type SalaryHistoryDelegate = {
  findMany: (...args: unknown[]) => Promise<unknown>;
  create: (...args: unknown[]) => Promise<unknown>;
};

const salaryHistoryModel = (
  prisma as unknown as {
    salaryHistory: SalaryHistoryDelegate;
  }
).salaryHistory;

async function resolveEmployee(
  identifier: string
): Promise<EmployeeIdentifier | null> {
  const isNumeric = /^\d+$/.test(identifier.trim());

  if (isNumeric) {
    const numericId = Number(identifier);
    const employee = await prisma.employee.findFirst({
      where: {
        id: numericId,
        deletedAt: null,
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
      },
    });

    return employee ?? null;
  }

  const employee = await prisma.employee.findFirst({
    where: {
      employeeId: identifier,
      deletedAt: null,
    },
    select: {
      id: true,
      employeeId: true,
      name: true,
    },
  });

  return employee ?? null;
}

// GET - Fetch salary history for an employee
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employee = await resolveEmployee(params.id);

    if (!employee?.employeeId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const salaryHistory = (await salaryHistoryModel.findMany({
      where: {
        employeeId: employee.employeeId,
        deletedAt: null,
      },
      orderBy: {
        effectiveDate: 'desc',
      },
    })) as SalaryHistoryRecord[];

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
    const employee = await resolveEmployee(params.id);

    if (!employee?.employeeId) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    const body = await request.json();

    const { effectiveDate, basicSalary, allowance, reason, notes } = body;

    // Validate required fields
    if (!effectiveDate || basicSalary === undefined) {
      return NextResponse.json(
        { error: 'Effective date and basic salary are required' },
        { status: 400 }
      );
    }

    const allowanceValue = typeof allowance === 'number' ? allowance : 0;
    const totalSalary = basicSalary + allowanceValue;

    const salaryRecord = (await salaryHistoryModel.create({
      data: {
        employeeId: employee.employeeId,
        employeeName: employee.name ?? 'Unknown Employee',
        effectiveDate,
        basicSalary,
        allowance: allowanceValue,
        totalSalary,
        reason: reason || null,
        notes: notes || null,
      },
    })) as SalaryHistoryRecord;

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
