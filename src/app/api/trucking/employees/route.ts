/* eslint-disable no-console */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import {
  validateEmployee,
  formatValidationErrors,
} from '@/lib/validations/employee.validation';
import { getDatabaseUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

const EMPLOYEE_ID_PREFIX = 'TRK-';

const isValidEmployeeId = (employeeId: string | undefined | null) => {
  return !!employeeId && /^TRK-\d{4,}$/.test(employeeId.trim());
};

async function generateEmployeeId(retryOffset = 0): Promise<string> {
  const latest = await prisma.truckingEmployee.findMany({
    select: { employeeId: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const maxNumber = latest.reduce((max, row) => {
    const match = row.employeeId?.match(/^TRK-(\d{4,})$/);
    if (!match) {
      return max;
    }
    const num = parseInt(match[1], 10);
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 0);

  const nextNumber = (maxNumber + 1 + retryOffset).toString().padStart(4, '0');
  return `${EMPLOYEE_ID_PREFIX}${nextNumber}`;
}

function dbNotConfigured(): string | null {
  try {
    const url = getDatabaseUrl();
    if (/postgresql:\/\/username:password@/i.test(url)) {
      return 'DATABASE_URL still has placeholder username/password';
    }
    return null;
  } catch {
    return 'DATABASE_URL is not set';
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Prisma.TruckingEmployeeWhereInput = {
      deletedAt: null,
    };

    if (department && department !== 'all') {
      where.department = sanitizers.name(department);
    }

    if (status && status !== 'all') {
      where.status = sanitizers.name(status);
    }

    if (search) {
      const sanitizedSearch = sanitizers.name(search);
      where.OR = [
        { name: { contains: sanitizedSearch, mode: 'insensitive' } },
        { firstName: { contains: sanitizedSearch, mode: 'insensitive' } },
        { lastName: { contains: sanitizedSearch, mode: 'insensitive' } },
        { employeeId: { contains: sanitizedSearch, mode: 'insensitive' } },
        { department: { contains: sanitizedSearch, mode: 'insensitive' } },
        { contact: { contains: sanitizedSearch, mode: 'insensitive' } },
        { email: { contains: sanitizedSearch, mode: 'insensitive' } },
      ];
    }

    const employees = await prisma.truckingEmployee.findMany({
      where,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        middleName: true,
        name: true,
        email: true,
        phone: true,
        contact: true,
        department: true,
        position: true,
        jobTitle: true,
        employeeType: true,
        status: true,
        hireDate: true,
        employmentEndDate: true,
        basicSalary: true,
        currentSalary: true,
        allowance: true,
        finalPayPending: true,
        finalPayEffectiveDate: true,
        finalPayNotes: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    logger.info(`✅ [Trucking] Fetched ${employees.length} employees`);
    return NextResponse.json(employees);
  } catch (error) {
    logger.error('Error fetching trucking employees:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch trucking employees',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    logger.info('🔵 [API] POST /api/trucking/employees - Request received');

    const misconfig = dbNotConfigured();
    if (misconfig) {
      return NextResponse.json(
        { error: `Database not configured: ${misconfig}` },
        { status: 503 }
      );
    }

    const body = await request.json();

    const validation = validateEmployee(body);
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

    const baseEmployeeId = isValidEmployeeId(validatedData.employeeId)
      ? validatedData.employeeId.trim()
      : await generateEmployeeId();

    const employeeData: Prisma.TruckingEmployeeCreateInput = {
      employeeId: baseEmployeeId,
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      middleName: validatedData.middleName || null,
      name: validatedData.name,
      phone: validatedData.phone || validatedData.contact,
      contact: validatedData.contact,
      email: validatedData.email || null,
      department: validatedData.department,
      position: validatedData.position,
      jobTitle: validatedData.jobTitle,
      basicSalary: validatedData.basicSalary,
      currentSalary: validatedData.currentSalary || validatedData.basicSalary,
      hireDate: validatedData.hireDate,
      employmentEndDate: validatedData.employmentEndDate || null,
      status: validatedData.status,
      employmentStatus: validatedData.employmentStatus || null,
      employeeType: validatedData.employeeType || null,
      office: validatedData.office || null,
      hiringSource: validatedData.hiringSource || null,
      finalPayPending: validatedData.finalPayPending ?? false,
      finalPayEffectiveDate: validatedData.finalPayEffectiveDate || null,
      finalPayNotes: validatedData.finalPayNotes || null,
      sssNumber: validatedData.sssNumber || null,
      philHealthNumber: validatedData.philHealthNumber || null,
      hdmfNumber: validatedData.hdmfNumber || null,
      tinNumber: validatedData.tinNumber || null,
      gender: validatedData.gender || null,
      education: validatedData.education || null,
      dateOfBirth: validatedData.dateOfBirth || null,
      maritalStatus: validatedData.maritalStatus || null,
      numberOfKids: validatedData.numberOfKids || null,
      drivingLicense: validatedData.drivingLicense || null,
      address: validatedData.address || null,
      emergencyContactPerson: validatedData.emergencyContactPerson || null,
      emergencyContactNumber: validatedData.emergencyContactNumber || null,
      emergencyContact:
        validatedData.emergencyContact ||
        validatedData.emergencyContactNumber ||
        null,
      bankAccount: validatedData.bankAccount || null,
      gcashAccount: validatedData.gcashAccount || null,
      allowance: validatedData.allowance || null,
      paymentSchedule: validatedData.paymentSchedule || null,
      sssMonthlyContribution: validatedData.sssMonthlyContribution || null,
      philHealthMonthlyContribution:
        validatedData.philHealthMonthlyContribution || null,
      pagibigMonthlyContribution:
        validatedData.pagibigMonthlyContribution || null,
      taxMonthlyContribution: validatedData.taxMonthlyContribution || null,
      profilePhoto: validatedData.profilePhoto || null,
    };

    const maxRetries = 5;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const candidateId =
        attempt === 0
          ? employeeData.employeeId
          : await generateEmployeeId(attempt);

      try {
        const employee = await prisma.truckingEmployee.create({
          data: { ...employeeData, employeeId: candidateId },
        });

        logger.success('✅ [API] Trucking employee created', employee.id);
        return NextResponse.json(employee, { status: 201 });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          // Duplicate ID, retry with a freshly generated one
          logger.warn(
            `⚠️ [API] Duplicate trucking employeeId (${candidateId}), retrying with a new id…`
          );
          continue;
        }
        throw error;
      }
    }

    // If we exhausted retries, surface a conflict
    return NextResponse.json(
      {
        error: 'Duplicate employee',
        details: 'Could not generate a unique employee ID after retries',
        code: 'DUPLICATE_ID_RETRIES',
      },
      { status: 409 }
    );
  } catch (error) {
    logger.error('❌ [API] Error creating trucking employee:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            error: 'Duplicate employee',
            details: 'An employee with this identifier already exists',
            code: error.code,
          },
          { status: 409 }
        );
      }
    }

    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    if (msg.includes('authentication failed')) {
      return NextResponse.json(
        {
          error:
            'Database authentication failed. Check DATABASE_URL credentials.',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create trucking employee',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
