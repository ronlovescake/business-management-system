/* eslint-disable no-console */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma, type TruckingEmployee } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';

export const dynamic = 'force-dynamic';

async function findEmployeeByIdentifier(
  identifier: string
): Promise<TruckingEmployee | null> {
  const trimmedIdentifier = identifier.trim();

  if (!trimmedIdentifier) {
    return null;
  }

  const isNumericId = /^\d+$/.test(trimmedIdentifier);

  const whereClause: Prisma.TruckingEmployeeWhereInput = isNumericId
    ? { id: Number(trimmedIdentifier), deletedAt: null }
    : { employeeId: trimmedIdentifier, deletedAt: null };

  return prisma.truckingEmployee.findFirst({ where: whereClause });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employee = await findEmployeeByIdentifier(params.id);

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found or has been deleted' },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    logger.error('[Trucking] Failed to fetch employee', {
      error: error instanceof Error ? error.message : 'Unknown error',
      employeeId: params.id,
    });

    return NextResponse.json(
      { error: 'Failed to fetch trucking employee' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeRecord = await findEmployeeByIdentifier(params.id);

    if (!employeeRecord) {
      return NextResponse.json(
        { error: 'Employee not found or has been deleted' },
        { status: 404 }
      );
    }

    const employeeNumericId = employeeRecord.id;

    const body = await request.json();
    logger.info('[Trucking] Updating employee', {
      employeeId: employeeNumericId,
      updateFields: Object.keys(body),
    });

    const existing = employeeRecord;

    const currentProfilePhoto =
      (existing as { profilePhoto?: string | null }).profilePhoto ?? null;

    if (body.email && body.email.trim() !== '') {
      const sanitizedEmail = sanitizers.email(body.email);
      const duplicateEmail = await prisma.truckingEmployee.findFirst({
        where: {
          email: sanitizedEmail,
          deletedAt: null,
          NOT: {
            id: employeeNumericId,
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

    if (body.phone && body.phone.trim() !== '') {
      const sanitizedPhone = sanitizers.phone(body.phone);
      const duplicatePhone = await prisma.truckingEmployee.findFirst({
        where: {
          phone: sanitizedPhone,
          deletedAt: null,
          NOT: {
            id: employeeNumericId,
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

    const employeeData: Prisma.TruckingEmployeeUpdateInput = {
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

    const employee = await prisma.truckingEmployee.update({
      where: { id: employeeNumericId },
      data: employeeData,
    });

    logger.info('[Trucking] Employee updated', { employeeId: employee.id });
    return NextResponse.json(employee);
  } catch (error) {
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

    logger.error('Failed to update trucking employee', {
      error: error instanceof Error ? error.message : 'Unknown error',
      employeeId: params.id,
    });

    return NextResponse.json(
      { error: 'Failed to update trucking employee' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const employeeRecord = await findEmployeeByIdentifier(params.id);

    if (!employeeRecord) {
      return NextResponse.json(
        { error: 'Employee not found or already deleted' },
        { status: 404 }
      );
    }

    const employee = await prisma.truckingEmployee.update({
      where: {
        id: employeeRecord.id,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    logger.info('[Trucking] Employee soft deleted', {
      employeeId: employee.id,
    });
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

    logger.error('Failed to delete trucking employee', {
      error: error instanceof Error ? error.message : 'Unknown error',
      employeeId: params.id,
    });

    return NextResponse.json(
      { error: 'Failed to delete trucking employee' },
      { status: 500 }
    );
  }
}
