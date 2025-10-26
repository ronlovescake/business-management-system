/* eslint-disable no-console */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';

export const dynamic = 'force-dynamic';

/**
 * GET /api/employees/[id]
 * Fetch a single employee by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = parseInt(params.id);

    if (isNaN(employeeId)) {
      return NextResponse.json(
        { error: 'Invalid employee ID format' },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: {
        id: employeeId,
        deletedAt: null,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found or has been deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    logger.error('Failed to fetch employee', {
      error: error instanceof Error ? error.message : 'Unknown error',
      employeeId: params.id,
    });

    return NextResponse.json(
      { error: 'Failed to fetch employee' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/employees/[id]
 * Update an employee by ID
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = parseInt(params.id);

    if (isNaN(employeeId)) {
      return NextResponse.json(
        { error: 'Invalid employee ID format' },
        { status: 400 }
      );
    }

    const body = await request.json();
    logger.info('Updating employee', {
      employeeId,
      updateFields: Object.keys(body),
    });

    // Check if employee exists
    const existing = await prisma.employee.findUnique({
      where: {
        id: employeeId,
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Employee not found or has been deleted' },
        { status: 404 }
      );
    }

    const currentProfilePhoto =
      (existing as { profilePhoto?: string | null }).profilePhoto ?? null;

    // Check for duplicate email (excluding current employee)
    if (body.email && body.email.trim() !== '') {
      const sanitizedEmail = sanitizers.email(body.email);
      const duplicateEmail = await prisma.employee.findFirst({
        where: {
          email: sanitizedEmail,
          deletedAt: null,
          NOT: {
            id: employeeId, // Exclude current employee
          },
        },
      });

      if (duplicateEmail) {
        return NextResponse.json(
          {
            error: 'Duplicate entry',
            details: 'An employee with this email already exists',
            field: 'email',
          },
          { status: 409 }
        );
      }
    }

    // Check for duplicate phone (excluding current employee)
    if (body.phone && body.phone.trim() !== '') {
      const sanitizedPhone = sanitizers.phone(body.phone);
      const duplicatePhone = await prisma.employee.findFirst({
        where: {
          phone: sanitizedPhone,
          deletedAt: null,
          NOT: {
            id: employeeId, // Exclude current employee
          },
        },
      });

      if (duplicatePhone) {
        return NextResponse.json(
          {
            error: 'Duplicate entry',
            details: 'An employee with this phone number already exists',
            field: 'phone',
          },
          { status: 409 }
        );
      }
    }

    const resolvedProfilePhoto =
      typeof body.profilePhoto === 'string'
        ? body.profilePhoto.trim().length > 0
          ? body.profilePhoto
          : null
        : currentProfilePhoto;

    // Prepare employee data with proper type conversions and sanitization
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const employeeData: any = {
      employeeId: sanitizers.name(body.employeeId),
      firstName: sanitizers.name(
        body.firstName || body.name?.split(' ')[0] || ''
      ),
      lastName: sanitizers.name(
        body.lastName || body.name?.split(' ').slice(1).join(' ') || ''
      ),
      middleName: body.middleName ? sanitizers.name(body.middleName) : null,
      name: sanitizers.name(body.name),
      department: sanitizers.name(body.department),
      position: sanitizers.name(body.position || body.jobTitle),
      jobTitle: sanitizers.name(body.jobTitle || body.position),
      status: sanitizers.name(body.status),
      hireDate: sanitizers.date(body.hireDate),
      phone: sanitizers.phone(body.phone || body.contact),
      contact: sanitizers.phone(body.contact || body.phone),
      email: body.email ? sanitizers.email(body.email) : null,
      address: body.address ? sanitizers.address(body.address) : null,
      emergencyContact:
        body.emergencyContact || body.emergencyContactNumber
          ? sanitizers.phone(
              body.emergencyContact || body.emergencyContactNumber
            )
          : null,
      emergencyContactPerson: body.emergencyContactPerson
        ? sanitizers.name(body.emergencyContactPerson)
        : null,
      emergencyContactNumber:
        body.emergencyContactNumber || body.emergencyContact
          ? sanitizers.phone(
              body.emergencyContactNumber || body.emergencyContact
            )
          : null,

      // Convert string to number for salary fields with sanitization
      basicSalary:
        sanitizers.number(body.basicSalary, { min: 0, decimals: 2 }) ?? 0,
      currentSalary: body.currentSalary
        ? (sanitizers.number(body.currentSalary, { min: 0, decimals: 2 }) ?? 0)
        : body.basicSalary
          ? (sanitizers.number(body.basicSalary, { min: 0, decimals: 2 }) ?? 0)
          : 0,
      allowance: body.allowance
        ? sanitizers.number(body.allowance, { min: 0, decimals: 2 })
        : null,

      // Statutory Monthly Contributions
      sssMonthlyContribution: body.sssMonthlyContribution
        ? sanitizers.number(body.sssMonthlyContribution, {
            min: 0,
            decimals: 2,
          })
        : null,
      philHealthMonthlyContribution: body.philHealthMonthlyContribution
        ? sanitizers.number(body.philHealthMonthlyContribution, {
            min: 0,
            decimals: 2,
          })
        : null,
      pagibigMonthlyContribution: body.pagibigMonthlyContribution
        ? sanitizers.number(body.pagibigMonthlyContribution, {
            min: 0,
            decimals: 2,
          })
        : null,
      taxMonthlyContribution: body.taxMonthlyContribution
        ? sanitizers.number(body.taxMonthlyContribution, {
            min: 0,
            decimals: 2,
          })
        : null,

      // Optional fields
      employmentStatus: body.employmentStatus
        ? sanitizers.name(body.employmentStatus)
        : null,
      employeeType: body.employeeType
        ? sanitizers.name(body.employeeType)
        : null,
      office: body.office ? sanitizers.name(body.office) : null,
      hiringSource: body.hiringSource
        ? sanitizers.name(body.hiringSource)
        : null,
      sssNumber: body.sssNumber ? sanitizers.name(body.sssNumber) : null,
      philHealthNumber: body.philHealthNumber
        ? sanitizers.name(body.philHealthNumber)
        : null,
      hdmfNumber: body.hdmfNumber ? sanitizers.name(body.hdmfNumber) : null,
      tinNumber: body.tinNumber ? sanitizers.name(body.tinNumber) : null,
      gender: body.gender ? sanitizers.name(body.gender) : null,
      education: body.education ? sanitizers.name(body.education) : null,
      dateOfBirth: body.dateOfBirth ? sanitizers.date(body.dateOfBirth) : null,
      maritalStatus: body.maritalStatus
        ? sanitizers.name(body.maritalStatus)
        : null,
      numberOfKids: body.numberOfKids
        ? sanitizers.number(body.numberOfKids, { min: 0 })
        : null,
      drivingLicense: body.drivingLicense
        ? sanitizers.name(body.drivingLicense)
        : null,
      bankAccount: body.bankAccount ? sanitizers.name(body.bankAccount) : null,
      gcashAccount: body.gcashAccount
        ? sanitizers.name(body.gcashAccount)
        : null,
      paymentSchedule: body.paymentSchedule
        ? sanitizers.name(body.paymentSchedule)
        : null,
      profilePhoto: resolvedProfilePhoto,

      updatedAt: new Date(),
    };

    // Update employee
    const employee = await prisma.employee.update({
      where: { id: employeeId },
      data: employeeData,
    });

    logger.info('Employee updated successfully', { employeeId: employee.id });
    return NextResponse.json(employee);
  } catch (error) {
    // Handle Prisma errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        return NextResponse.json(
          {
            error: 'Duplicate entry',
            details: `An employee with this ${target.join(', ')} already exists`,
            field: target[0],
          },
          { status: 409 }
        );
      }

      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Employee not found' },
          { status: 404 }
        );
      }
    }

    logger.error('Failed to update employee', {
      error: error instanceof Error ? error.message : 'Unknown error',
      employeeId: params.id,
    });

    return NextResponse.json(
      { error: 'Failed to update employee' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/employees/[id]
 * Soft delete an employee by ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeId = parseInt(params.id);

    if (isNaN(employeeId)) {
      return NextResponse.json(
        { error: 'Invalid employee ID format' },
        { status: 400 }
      );
    }

    // Soft delete by setting deletedAt timestamp
    const employee = await prisma.employee.update({
      where: {
        id: employeeId,
        deletedAt: null, // Only delete if not already deleted
      },
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info('Employee soft deleted', { employeeId: employee.id });
    return NextResponse.json({ success: true, employee });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Employee not found or already deleted' },
          { status: 404 }
        );
      }
    }

    logger.error('Failed to delete employee', {
      error: error instanceof Error ? error.message : 'Unknown error',
      employeeId: params.id,
    });

    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    );
  }
}
