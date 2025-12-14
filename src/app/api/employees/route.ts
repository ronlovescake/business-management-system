import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { HTTP_STATUS } from '@/shared/constants/api';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import {
  validateEmployee,
  formatValidationErrors,
} from '@/lib/validations/employee.validation';
import { getDatabaseUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Database configuration check
 */
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

/**
 * GET /api/employees
 * Fetch all employees (excluding soft-deleted)
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: Prisma.EmployeeWhereInput = {
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

    const employees = await prisma.employee.findMany({
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

    logger.info('Employees fetched', { total: employees.length });
    return ApiResponse.success(employees, 'Employees fetched');
  } catch (error) {
    logger.error('Error fetching employees', { error });
    return ApiResponse.error(
      'Failed to fetch employees',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : undefined
    );
  }
});

/**
 * POST /api/employees
 * Create a new employee
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  logger.info('🔵 [API] POST /api/employees - Request received');

  const misconfig = dbNotConfigured();
  if (misconfig) {
    return ApiResponse.error(
      `Database not configured: ${misconfig}`,
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
  }

  const body = await request.json();
  logger.debug('📥 [API] Received employee data:', body);

  const validation = validateEmployee(body);
  if (!validation.success) {
    logger.warn('❌ [API] Employee validation failed:', validation.error);
    return ApiResponse.badRequest(
      'Validation failed',
      formatValidationErrors(validation.error)
    );
  }

  const validatedData = validation.data;

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

  logger.debug('💾 [API] Creating employee with validated data');

  try {
    const employee = await prisma.employee.create({
      data: employeeData,
    });

    logger.success('✅ [API] Employee created successfully:', employee.id);
    return ApiResponse.success(
      employee,
      'Employee created successfully',
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error('❌ [API] Error creating employee:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return ApiResponse.conflict(
          'Duplicate employee',
          'An employee with this employee ID already exists',
          'employeeId'
        );
      }
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('authentication failed')) {
        return ApiResponse.error(
          'Database authentication failed. Check DATABASE_URL credentials.',
          HTTP_STATUS.SERVICE_UNAVAILABLE
        );
      }
    }

    return ApiResponse.error(
      'Failed to create employee',
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : undefined
    );
  }
});
