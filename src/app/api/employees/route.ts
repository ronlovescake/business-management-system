import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    if (department && department !== 'all') {
      where.department = department;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
        { department: { contains: search, mode: 'insensitive' } },
        { contact: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Failed to fetch employees' },
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
    console.log('🔵 [API] POST /api/employees - Request received');

    const body = await request.json();
    // eslint-disable-next-line no-console
    console.log(
      '📥 [API] Received employee data:',
      JSON.stringify(body, null, 2)
    );

    // Prepare data with proper type conversions
    const employeeData = {
      employeeId: body.employeeId,
      firstName: body.firstName,
      lastName: body.lastName,
      middleName: body.middleName || null,
      name: body.name,
      phone: body.phone,
      contact: body.contact || body.phone,
      email: body.email || null,
      department: body.department,
      position: body.position,
      jobTitle: body.jobTitle || body.position,
      basicSalary: parseFloat(body.basicSalary) || 0,
      currentSalary: body.currentSalary ? parseFloat(body.currentSalary) : null,
      hireDate: body.hireDate,
      status: body.status,
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
      address: body.address || null,
      emergencyContactPerson: body.emergencyContactPerson || null,
      emergencyContactNumber: body.emergencyContactNumber || null,
      emergencyContact:
        body.emergencyContact || body.emergencyContactNumber || null,
      bankAccount: body.bankAccount || null,
      gcashAccount: body.gcashAccount || null,
      allowance: body.allowance ? parseFloat(body.allowance) : null,
      paymentSchedule: body.paymentSchedule || null,
    };

    // eslint-disable-next-line no-console
    console.log(
      '💾 [API] Attempting to create employee with data:',
      JSON.stringify(employeeData, null, 2)
    );

    console.log('🔵 [API] Calling prisma.employee.create...');
    const employee = await prisma.employee.create({
      data: employeeData,
    });

    // eslint-disable-next-line no-console
    console.log('✅ [API] Employee created successfully:', employee.id);
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error('❌ [API] Error creating employee:', error);
    console.error('❌ [API] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    });

    // If it's a Prisma error, log more details
    if (error && typeof error === 'object' && 'code' in error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.error('❌ [API] Prisma error code:', (error as any).code);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.error('❌ [API] Prisma error meta:', (error as any).meta);
    }

    return NextResponse.json(
      {
        error: 'Failed to create employee',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
