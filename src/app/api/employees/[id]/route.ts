/* eslint-disable no-console */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

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
      const duplicateEmail = await prisma.employee.findFirst({
        where: {
          email: body.email,
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
      const duplicatePhone = await prisma.employee.findFirst({
        where: {
          phone: body.phone,
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

    // Prepare employee data with proper type conversions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const employeeData: any = {
      employeeId: body.employeeId,
      firstName: body.firstName || body.name?.split(' ')[0] || '',
      lastName: body.lastName || body.name?.split(' ').slice(1).join(' ') || '',
      middleName: body.middleName || null,
      name: body.name,
      department: body.department,
      position: body.position || body.jobTitle,
      jobTitle: body.jobTitle || body.position,
      status: body.status,
      hireDate: body.hireDate,
      phone: body.phone || body.contact,
      contact: body.contact || body.phone,
      email: body.email || null,
      address: body.address || null,
      emergencyContact:
        body.emergencyContact || body.emergencyContactNumber || null,
      emergencyContactPerson: body.emergencyContactPerson || null,
      emergencyContactNumber:
        body.emergencyContactNumber || body.emergencyContact || null,

      // Convert string to number for salary fields
      basicSalary: body.basicSalary ? parseFloat(body.basicSalary) : 0,
      currentSalary: body.currentSalary
        ? parseFloat(body.currentSalary)
        : body.basicSalary
          ? parseFloat(body.basicSalary)
          : 0,
      allowance: body.allowance ? parseFloat(body.allowance) : null,

      // Statutory Monthly Contributions
      sssMonthlyContribution: body.sssMonthlyContribution
        ? parseFloat(body.sssMonthlyContribution)
        : null,
      philHealthMonthlyContribution: body.philHealthMonthlyContribution
        ? parseFloat(body.philHealthMonthlyContribution)
        : null,
      pagibigMonthlyContribution: body.pagibigMonthlyContribution
        ? parseFloat(body.pagibigMonthlyContribution)
        : null,
      taxMonthlyContribution: body.taxMonthlyContribution
        ? parseFloat(body.taxMonthlyContribution)
        : null,

      // Optional fields
      employmentStatus: body.employmentStatus || null,
      employeeType: body.employeeType || null,
      office: body.office || null,
      hiringSource: body.hiringSource || null,
      sssNumber: body.sssNumber || null,
      philHealthNumber: body.philHealthNumber || null,
      hdmfNumber: body.hdmfNumber || null,
      tinNumber: body.tinNumber || null,
      gender: body.gender || null,
      education: body.education || null,
      dateOfBirth: body.dateOfBirth || null,
      maritalStatus: body.maritalStatus || null,
      numberOfKids: body.numberOfKids ? parseInt(body.numberOfKids) : null,
      drivingLicense: body.drivingLicense || null,
      bankAccount: body.bankAccount || null,
      gcashAccount: body.gcashAccount || null,
      paymentSchedule: body.paymentSchedule || null,
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
