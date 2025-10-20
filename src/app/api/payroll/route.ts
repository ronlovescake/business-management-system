import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { syncPayrollDeductions } from '@/lib/payroll/deductions';

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === 'object' && 'toString' in (value as object)) {
    const parsed = parseFloat((value as { toString(): string }).toString());
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export async function GET(_request: NextRequest) {
  try {
    const payrolls = await prisma.payroll.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ periodStart: 'desc' }, { employeeName: 'asc' }],
    });

    const syncedPayrolls = await syncPayrollDeductions(payrolls);

    return NextResponse.json(syncedPayrolls);
  } catch (error) {
    console.error('Error fetching payrolls:', error);
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
      const createdPayrolls = [];

      for (const payrollData of body) {
        const payroll = await prisma.payroll.create({
          data: {
            employeeId: payrollData.employeeId,
            employeeName: payrollData.employeeName || payrollData.employee,
            payPeriod: payrollData.payPeriod,
            periodStart: payrollData.periodStart,
            periodEnd: payrollData.periodEnd,
            basicSalary: toNumber(payrollData.basicSalary),
            allowance: toNumber(payrollData.allowance),
            overtime: toNumber(payrollData.overtime),
            bonuses: toNumber(payrollData.bonuses),
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
          },
        });

        createdPayrolls.push(payroll);
      }

      return NextResponse.json({
        success: true,
        count: createdPayrolls.length,
        records: createdPayrolls,
      });
    }

    // Handle single payroll creation
    const payroll = await prisma.payroll.create({
      data: {
        employeeId: body.employeeId,
        employeeName: body.employeeName || body.employee,
        payPeriod: body.payPeriod,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
        basicSalary: toNumber(body.basicSalary),
        allowance: toNumber(body.allowance),
        overtime: toNumber(body.overtime),
        bonuses: toNumber(body.bonuses),
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
      },
    });

    return NextResponse.json(payroll);
  } catch (error) {
    console.error('Error creating payroll:', error);
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

    return NextResponse.json(payroll);
  } catch (error) {
    console.error('Error updating payroll:', error);
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
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting payroll:', error);
    return NextResponse.json(
      { error: 'Failed to delete payroll' },
      { status: 500 }
    );
  }
}
