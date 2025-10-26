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

export const dynamic = 'force-dynamic';

/**
 * Database configuration check
 */
function dbNotConfigured(): string | null {
  const url = process.env.DATABASE_URL || '';
  if (!url) {
    return 'DATABASE_URL is not set';
  }
  if (/postgresql:\/\/username:password@/i.test(url)) {
    return 'DATABASE_URL still has placeholder username/password';
  }
  return null;
}

/**
 * GET /api/employees
 * Fetch all employees (excluding soft-deleted)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      deletedAt: null,
    };

    // Sanitize filter parameters
    if (department && department !== 'all') {
      where.department = sanitizers.name(department);
    }

    if (status && status !== 'all') {
      where.status = sanitizers.name(status);
    }

    if (search) {
      // Sanitize search query to prevent injection
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

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    logger.info(`✅ Fetched ${employees.length} employees`);
    return NextResponse.json(employees);
  } catch (error) {
    logger.error('Error fetching employees:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch employees',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/employees
 * Create a new employee
 */
export async function POST(request: NextRequest) {
  try {
    logger.info('🔵 [API] POST /api/employees - Request received');

    // ========================================================================
    // ⚠️ DATABASE CONFIGURATION CHECK
    // ========================================================================
    const misconfig = dbNotConfigured();
    if (misconfig) {
      return NextResponse.json(
        { error: `Database not configured: ${misconfig}` },
        { status: 503 }
      );
    }

    const body = await request.json();
    logger.debug('📥 [API] Received employee data:', body);

    // ========================================================================
    // ⚠️ DATA VALIDATION - Zod Schema
    // ========================================================================
    const validation = validateEmployee(body);
    if (!validation.success) {
      logger.warn('❌ [API] Employee validation failed:', validation.error);
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationErrors(validation.error),
        },
        { status: 400 }
      );
    }

    const validatedData = validation.data;

    // Prepare data with proper type conversions
    const employeeData = {
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

    logger.debug('💾 [API] Creating employee with validated data');

    const employee = await prisma.employee.create({
      data: employeeData,
    });

    logger.success('✅ [API] Employee created successfully:', employee.id);
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    logger.error('❌ [API] Error creating employee:', error);

    // ========================================================================
    // ⚠️ ENHANCED ERROR HANDLING - Prisma Error Codes
    // ========================================================================
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = Unique constraint failed
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            error: 'Duplicate employee',
            details: 'An employee with this employee ID already exists',
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
        error: 'Failed to create employee',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
