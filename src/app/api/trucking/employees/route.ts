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
        basicSalary: true,
        currentSalary: true,
        allowance: true,
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

    const employeeData: Prisma.TruckingEmployeeCreateInput = {
      employeeId: validatedData.employeeId,
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
      status: validatedData.status,
      employmentStatus: validatedData.employmentStatus || null,
      employeeType: validatedData.employeeType || null,
      office: validatedData.office || null,
      hiringSource: validatedData.hiringSource || null,
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

    const existingById = await prisma.truckingEmployee.findFirst({
      where: { employeeId: validatedData.employeeId },
      select: { id: true, deletedAt: true },
    });

    if (existingById && !existingById.deletedAt) {
      return NextResponse.json(
        {
          error: 'Duplicate employee',
          details: 'An active employee with this identifier already exists',
          code: 'DUPLICATE_ACTIVE',
        },
        { status: 409 }
      );
    }

    if (existingById && existingById.deletedAt) {
      const restored = await prisma.truckingEmployee.update({
        where: { id: existingById.id },
        data: {
          ...employeeData,
          deletedAt: null,
        },
      });

      logger.success('✅ [API] Trucking employee restored', restored.id);
      return NextResponse.json(restored, { status: 201 });
    }

    const employee = await prisma.truckingEmployee.create({
      data: employeeData,
    });

    logger.success('✅ [API] Trucking employee created', employee.id);
    return NextResponse.json(employee, { status: 201 });
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
