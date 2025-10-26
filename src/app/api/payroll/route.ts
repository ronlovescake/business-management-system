import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { syncPayrollDeductions } from '@/lib/payroll/deductions';
import { sanitizers } from '@/lib/security/sanitize';
import {
  validatePayroll,
  formatValidationErrors,
} from '@/lib/validations/payroll.validation';

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  // Use sanitizers.number for better validation
  const sanitized = sanitizers.number(value, { min: 0, decimals: 2 });
  return sanitized ?? 0;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeIdParam = searchParams.get('employeeId');
    const normalizedEmployeeId = employeeIdParam
      ? sanitizers.name(employeeIdParam)
      : undefined;

    const payrolls = await prisma.payroll.findMany({
      where: {
        deletedAt: null,
        ...(normalizedEmployeeId ? { employeeId: normalizedEmployeeId } : {}),
      },
      orderBy: [{ periodStart: 'desc' }, { employeeName: 'asc' }],
    });

    // Only sync deductions for pending and approved payrolls
    // Paid payrolls should retain their original deduction values
    const pendingAndApproved = payrolls.filter(
      (p) => p.status === 'pending' || p.status === 'approved'
    );
    const paid = payrolls.filter((p) => p.status === 'paid');

    const syncedPendingAndApproved =
      await syncPayrollDeductions(pendingAndApproved);
    const allPayrolls = [...syncedPendingAndApproved, ...paid];

    // Sort back to original order
    allPayrolls.sort((a, b) => {
      const dateCompare = (b.periodStart || '').localeCompare(
        a.periodStart || ''
      );
      if (dateCompare !== 0) {
        return dateCompare;
      }
      return (a.employeeName || '').localeCompare(b.employeeName || '');
    });

    return NextResponse.json(allPayrolls);
  } catch (error) {
    logger.error('Failed to fetch payrolls', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to fetch payrolls' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle bulk import
    if (Array.isArray(body)) {
      // ========================================================================
      // ⚠️ BATCH SIZE LIMIT - Maximum 10000 records per import
      // ========================================================================
      if (body.length > 10000) {
        return NextResponse.json(
          {
            error: 'Batch size limit exceeded',
            details: `You are trying to import ${body.length} records. Maximum is 10,000 records per import.`,
            suggestion:
              'Please split your import into smaller batches of 10,000 records or less.',
          },
          { status: 413 } // Payload Too Large
        );
      }

      // Validate all records
      const validationErrors: Array<{
        index: number;
        errors: Record<string, string>;
      }> = [];
      const validatedRecords: Array<(typeof body)[0]> = [];
      const employeeIds = new Set<string>();

      for (let i = 0; i < body.length; i++) {
        const payrollData = body[i];

        // Prepare payroll data
        const preparedData = {
          employeeId: payrollData.employeeId ?? null,
          employeeName: payrollData.employeeName || payrollData.employee,
          payPeriod: payrollData.payPeriod,
          periodStart: payrollData.periodStart,
          periodEnd: payrollData.periodEnd,
          basicSalary: toNumber(payrollData.basicSalary),
          allowance: toNumber(payrollData.allowance),
          overtime: toNumber(payrollData.overtime),
          bonuses: toNumber(payrollData.bonuses),
          thirteenthMonth: toNumber(payrollData.thirteenthMonth),
          grossPay: toNumber(payrollData.grossPay),
          sss: toNumber(payrollData.sss),
          philHealth: toNumber(payrollData.philHealth),
          pagIbig: toNumber(payrollData.pagIbig),
          tax: toNumber(payrollData.tax),
          loans: toNumber(payrollData.loans),
          cashAdvance: toNumber(payrollData.cashAdvance),
          lwop: toNumber(payrollData.lwop),
          absentsLates: toNumber(payrollData.absentsLates),
          totalDeductions: toNumber(payrollData.totalDeductions),
          netPay: toNumber(payrollData.netPay),
          status: payrollData.status || 'pending',
          bankGcash: payrollData.bankGcash || '',
          unpaidDays: parseInt(payrollData.unpaidDays) || 0,
          dailyRate: toNumber(payrollData.dailyRate),
          deduction: toNumber(payrollData.deduction),
          notes: payrollData.notes || null,
        };

        const validation = validatePayroll(preparedData);
        if (!validation.success) {
          validationErrors.push({
            index: i,
            errors: formatValidationErrors(validation.error),
          });
        } else {
          validatedRecords.push(validation.data);
          if (preparedData.employeeId) {
            employeeIds.add(preparedData.employeeId);
          }
        }
      }

      if (validationErrors.length > 0) {
        return NextResponse.json(
          {
            error: 'Validation failed for multiple records',
            details: validationErrors,
            validCount: validatedRecords.length,
            invalidCount: validationErrors.length,
          },
          { status: 400 }
        );
      }

      // Check if all referenced employees exist
      if (employeeIds.size > 0) {
        const existingEmployees = await prisma.employee.findMany({
          where: {
            employeeId: { in: Array.from(employeeIds) },
            deletedAt: null,
          },
          select: { employeeId: true },
        });

        const existingIds = new Set(existingEmployees.map((e) => e.employeeId));
        const missingIds = Array.from(employeeIds).filter(
          (id) => !existingIds.has(id)
        );

        if (missingIds.length > 0) {
          return NextResponse.json(
            {
              error: 'Referenced employees not found',
              details: `The following employee IDs do not exist: ${missingIds.join(', ')}`,
              missingEmployeeIds: missingIds,
              suggestion:
                'Please ensure all employees exist before importing payroll records',
            },
            { status: 409 }
          );
        }
      }

      const createdPayrolls = [];

      for (const payrollData of validatedRecords) {
        const payroll = await prisma.payroll.create({
          data: payrollData as Prisma.PayrollCreateInput,
        });
        createdPayrolls.push(payroll);
      }

      logger.info('Bulk payroll records created', {
        count: createdPayrolls.length,
      });

      return NextResponse.json({
        success: true,
        count: createdPayrolls.length,
        records: createdPayrolls,
      });
    }

    // Handle single payroll creation - validate first
    const preparedData = {
      employeeId: body.employeeId ?? null,
      employeeName: body.employeeName || body.employee,
      payPeriod: body.payPeriod,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      basicSalary: toNumber(body.basicSalary),
      allowance: toNumber(body.allowance),
      overtime: toNumber(body.overtime),
      bonuses: toNumber(body.bonuses),
      thirteenthMonth: toNumber(body.thirteenthMonth),
      grossPay: toNumber(body.grossPay),
      sss: toNumber(body.sss),
      philHealth: toNumber(body.philHealth),
      pagIbig: toNumber(body.pagIbig),
      tax: toNumber(body.tax),
      loans: toNumber(body.loans),
      cashAdvance: toNumber(body.cashAdvance),
      lwop: toNumber(body.lwop),
      absentsLates: toNumber(body.absentsLates),
      totalDeductions: toNumber(body.totalDeductions),
      netPay: toNumber(body.netPay),
      status: body.status || 'pending',
      bankGcash: body.bankGcash || '',
      unpaidDays: parseInt(body.unpaidDays) || 0,
      dailyRate: toNumber(body.dailyRate),
      deduction: toNumber(body.deduction),
      notes: body.notes || null,
    };

    const validation = validatePayroll(preparedData);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationErrors(validation.error),
        },
        { status: 400 }
      );
    }

    // Check if employee exists
    if (body.employeeId) {
      const employee = await prisma.employee.findFirst({
        where: {
          employeeId: body.employeeId,
          deletedAt: null,
        },
      });

      if (!employee) {
        return NextResponse.json(
          {
            error: 'Employee not found',
            details: `Employee with ID '${body.employeeId}' does not exist`,
            employeeId: body.employeeId,
          },
          { status: 409 }
        );
      }
    }

    const payroll = await prisma.payroll.create({
      data: validation.data as Prisma.PayrollCreateInput,
    });

    logger.info('Payroll record created', { id: payroll.id });
    return NextResponse.json(payroll);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        return NextResponse.json(
          {
            error: 'Duplicate payroll record',
            details: `A payroll record with this ${target.join(', ')} already exists`,
            field: target[0],
          },
          { status: 409 }
        );
      }

      if (error.code === 'P2003') {
        return NextResponse.json(
          {
            error: 'Referenced employee not found',
            details: 'The employee ID does not exist in the database',
          },
          { status: 409 }
        );
      }
    }

    logger.error('Failed to create payroll', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to create payroll' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    // Check if status is changing to 'paid'
    const existingPayroll = await prisma.payroll.findUnique({
      where: { id },
    });

    if (!existingPayroll) {
      return NextResponse.json({ error: 'Payroll not found' }, { status: 404 });
    }

    const hasProp = (key: string) =>
      Object.prototype.hasOwnProperty.call(updateData, key);

    const updatedRecord: Record<string, unknown> = { ...updateData };

    const assignNumber = (key: string) => {
      if (hasProp(key)) {
        updatedRecord[key] = toNumber(updateData[key]);
      }
    };

    assignNumber('basicSalary');
    assignNumber('allowance');
    assignNumber('overtime');
    assignNumber('bonuses');
    assignNumber('grossPay');
    assignNumber('sss');
    assignNumber('philHealth');
    assignNumber('pagIbig');
    assignNumber('tax');
    assignNumber('loans');
    assignNumber('cashAdvance');
    assignNumber('absentsLates');
    assignNumber('totalDeductions');
    assignNumber('netPay');
    assignNumber('dailyRate');

    if (hasProp('unpaidDays')) {
      updatedRecord.unpaidDays = parseInt(updateData.unpaidDays) || 0;
    }

    assignNumber('lwop');
    assignNumber('deduction');

    const payroll = await prisma.payroll.update({
      where: { id },
      data: {
        ...updatedRecord,
      },
    });

    // If status changed to 'paid', run deduction sync to persist cash advance deductions
    const statusChanged =
      hasProp('status') &&
      updateData.status === 'paid' &&
      existingPayroll.status !== 'paid';

    if (statusChanged) {
      const [syncedPayroll] = await syncPayrollDeductions([payroll]);
      return NextResponse.json(syncedPayroll);
    }

    return NextResponse.json(payroll);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Payroll record not found or already deleted' },
          { status: 404 }
        );
      }

      if (error.code === 'P2002') {
        const target = (error.meta?.target as string[]) || [];
        return NextResponse.json(
          {
            error: 'Duplicate payroll record',
            details: `A payroll record with this ${target.join(', ')} already exists`,
            field: target[0],
          },
          { status: 409 }
        );
      }
    }

    logger.error('Failed to update payroll', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to update payroll' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    // Soft delete
    await prisma.payroll.update({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    logger.info('Payroll record soft deleted', { id });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json(
          { error: 'Payroll record not found or already deleted' },
          { status: 404 }
        );
      }
    }

    logger.error('Failed to delete payroll', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to delete payroll' },
      { status: 500 }
    );
  }
}
