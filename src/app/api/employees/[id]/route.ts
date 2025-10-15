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
    const body = await request.json();

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

    // Update employee
    const employee = await prisma.employee.update({
      where: { id: parseInt(params.id) },
      data: {
        ...body,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error('Error updating employee:', error);
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
