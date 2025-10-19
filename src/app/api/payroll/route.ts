import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(_request: NextRequest) {
  try {
    const payrolls = await prisma.payroll.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ periodStart: 'desc' }, { employeeName: 'asc' }],
    });

    return NextResponse.json(payrolls);
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
            basicSalary: parseFloat(payrollData.basicSalary) || 0,
            allowance: parseFloat(payrollData.allowance) || 0,
            overtime: parseFloat(payrollData.overtime) || 0,
            bonuses: parseFloat(payrollData.bonuses) || 0,
            grossPay: parseFloat(payrollData.grossPay) || 0,
            sss: parseFloat(payrollData.sss) || 0,
            philHealth: parseFloat(payrollData.philHealth) || 0,
            pagIbig: parseFloat(payrollData.pagIbig) || 0,
            tax: parseFloat(payrollData.tax) || 0,
            loans: parseFloat(payrollData.loans) || 0,
            cashAdvance: parseFloat(payrollData.cashAdvance) || 0,
            lwop: parseFloat(payrollData.lwop) || 0,
            absentsLates: parseFloat(payrollData.absentsLates) || 0,
            totalDeductions: parseFloat(payrollData.totalDeductions) || 0,
            netPay: parseFloat(payrollData.netPay) || 0,
            status: payrollData.status || 'pending',
            bankGcash: payrollData.bankGcash || '',
            unpaidDays: parseInt(payrollData.unpaidDays) || 0,
            dailyRate: parseFloat(payrollData.dailyRate) || 0,
            deduction: parseFloat(payrollData.deduction) || 0,
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
        basicSalary: parseFloat(body.basicSalary) || 0,
        allowance: parseFloat(body.allowance) || 0,
        overtime: parseFloat(body.overtime) || 0,
        bonuses: parseFloat(body.bonuses) || 0,
        grossPay: parseFloat(body.grossPay) || 0,
        sss: parseFloat(body.sss) || 0,
        philHealth: parseFloat(body.philHealth) || 0,
        pagIbig: parseFloat(body.pagIbig) || 0,
        tax: parseFloat(body.tax) || 0,
        loans: parseFloat(body.loans) || 0,
        cashAdvance: parseFloat(body.cashAdvance) || 0,
        lwop: parseFloat(body.lwop) || 0,
        absentsLates: parseFloat(body.absentsLates) || 0,
        totalDeductions: parseFloat(body.totalDeductions) || 0,
        netPay: parseFloat(body.netPay) || 0,
        status: body.status || 'pending',
        bankGcash: body.bankGcash || '',
        unpaidDays: parseInt(body.unpaidDays) || 0,
        dailyRate: parseFloat(body.dailyRate) || 0,
        deduction: parseFloat(body.deduction) || 0,
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

    const payroll = await prisma.payroll.update({
      where: { id },
      data: {
        ...updateData,
        basicSalary: parseFloat(updateData.basicSalary),
        allowance: parseFloat(updateData.allowance),
        overtime: parseFloat(updateData.overtime),
        bonuses: parseFloat(updateData.bonuses),
        grossPay: parseFloat(updateData.grossPay),
        sss: parseFloat(updateData.sss),
        philHealth: parseFloat(updateData.philHealth),
        pagIbig: parseFloat(updateData.pagIbig),
        tax: parseFloat(updateData.tax),
        loans: parseFloat(updateData.loans),
        cashAdvance: parseFloat(updateData.cashAdvance),
        lwop: parseFloat(updateData.lwop),
        absentsLates: parseFloat(updateData.absentsLates),
        totalDeductions: parseFloat(updateData.totalDeductions),
        netPay: parseFloat(updateData.netPay),
        unpaidDays: parseInt(updateData.unpaidDays) || 0,
        dailyRate: parseFloat(updateData.dailyRate) || 0,
        deduction: parseFloat(updateData.deduction) || 0,
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
