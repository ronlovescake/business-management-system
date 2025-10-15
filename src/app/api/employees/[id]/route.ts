import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
    const employee = await prisma.employee.findUnique({
      where: {
        id: parseInt(params.id),
        deletedAt: null,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
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
    console.log(
      '🔵 [API] PUT /api/employees/[id] - Request received for ID:',
      params.id
    );

    const body = await request.json();
    // eslint-disable-next-line no-console
    console.log(
      '📥 [API] Received update data:',
      JSON.stringify(body, null, 2)
    );

    // Check if employee exists
    const existing = await prisma.employee.findUnique({
      where: {
        id: parseInt(params.id),
        deletedAt: null,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      );
    }

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

      updatedAt: new Date(),
    };

    // eslint-disable-next-line no-console
    console.log(
      '💾 [API] Attempting to update employee with data:',
      JSON.stringify(employeeData, null, 2)
    );

    // Update employee
    const employee = await prisma.employee.update({
      where: { id: parseInt(params.id) },
      data: employeeData,
    });

    // eslint-disable-next-line no-console
    console.log('✅ [API] Employee updated successfully:', employee.id);
    return NextResponse.json(employee);
  } catch (error) {
    console.error('❌ [API] Error updating employee:', error);
    console.error('❌ [API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
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
    // Soft delete by setting deletedAt timestamp
    const employee = await prisma.employee.update({
      where: { id: parseInt(params.id) },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, employee });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json(
      { error: 'Failed to delete employee' },
      { status: 500 }
    );
  }
}
