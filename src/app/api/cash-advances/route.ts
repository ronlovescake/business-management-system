import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { CashAdvanceCycle } from '@/lib/payroll/cashAdvanceSchedule';
import {
  determineCycleFromDate,
  ensureNextPayday,
} from '@/lib/payroll/cashAdvanceSchedule';

const toDecimal = (value: unknown) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  try {
    return new Prisma.Decimal(value as Prisma.Decimal.Value);
  } catch (error) {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return null;
    }
    return new Prisma.Decimal(parsed);
  }
};

const toDate = (value: unknown) => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const serializeRecord = (record: {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: Prisma.Decimal;
  termsMonths: number | null;
  monthlyPayment: Prisma.Decimal | null;
  settledAmount: Prisma.Decimal | null;
  remainingBalance: Prisma.Decimal | null;
  purpose: string | null;
  notes: string | null;
  requestDate: Date | null;
  status: string;
  approvedBy: string | null;
  approvedDate: Date | null;
  rejectedBy: string | null;
  rejectedDate: Date | null;
  rejectionReason: string | null;
  deductionCycle: CashAdvanceCycle | null;
  nextDeductionDate: Date | null;
  lastDeductedDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) => {
  const amount = Number(record.amount);
  const settled = record.settledAmount ? Number(record.settledAmount) : 0;
  const remaining = record.remainingBalance
    ? Number(record.remainingBalance)
    : Math.max(amount - settled, 0);

  return {
    id: record.id,
    employeeId: record.employeeId,
    employeeName: record.employeeName,
    amount,
    termsMonths: record.termsMonths,
    monthlyPayment: record.monthlyPayment
      ? Number(record.monthlyPayment)
      : null,
    settledAmount: settled,
    remainingBalance: remaining,
    purpose: record.purpose,
    notes: record.notes,
    requestDate: record.requestDate
      ? record.requestDate.toISOString().slice(0, 10)
      : null,
    status: record.status,
    approvedBy: record.approvedBy,
    approvedDate: record.approvedDate
      ? record.approvedDate.toISOString()
      : null,
    rejectedBy: record.rejectedBy,
    rejectedDate: record.rejectedDate
      ? record.rejectedDate.toISOString()
      : null,
    rejectionReason: record.rejectionReason,
    deductionCycle: record.deductionCycle,
    nextDeductionDate: record.nextDeductionDate
      ? record.nextDeductionDate.toISOString()
      : null,
    lastDeductedDate: record.lastDeductedDate
      ? record.lastDeductedDate.toISOString()
      : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');

    const records = await prisma.cashAdvanceRecord.findMany({
      where: {
        status: status && status !== 'all' ? status : undefined,
        employeeId: employeeId ?? undefined,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    return NextResponse.json(records.map(serializeRecord));
  } catch (error) {
    console.error('Error fetching cash advances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cash advances' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const amount = toDecimal(body.amount) ?? new Prisma.Decimal(0);
    const settledAmount =
      toDecimal(body.settledAmount) ?? new Prisma.Decimal(0);
    const remainingBalance =
      toDecimal(body.remainingBalance) ?? amount.minus(settledAmount);

    const status = typeof body.status === 'string' ? body.status : 'pending';
    let approvedDate = toDate(body.approvedDate);
    if (status === 'approved' && !approvedDate) {
      approvedDate = new Date();
    }

    let deductionCycle: CashAdvanceCycle | null = null;
    let nextDeductionDate: Date | null = null;

    if (status === 'approved' && approvedDate) {
      const schedule = ensureNextPayday(approvedDate);
      deductionCycle = schedule.cycle;
      nextDeductionDate = schedule.date;
    }

    const record = await prisma.cashAdvanceRecord.create({
      data: {
        employeeId: body.employeeId,
        employeeName: body.employeeName ?? body.employee ?? '',
        amount,
        termsMonths:
          body.termsMonths !== undefined && body.termsMonths !== null
            ? parseInt(body.termsMonths, 10)
            : null,
        monthlyPayment: toDecimal(body.monthlyPayment),
        settledAmount,
        remainingBalance,
        purpose: body.purpose || null,
        notes: body.notes || null,
        requestDate: toDate(body.requestDate),
        status,
        approvedBy: body.approvedBy || null,
        approvedDate,
        rejectedBy: body.rejectedBy || null,
        rejectedDate: toDate(body.rejectedDate),
        rejectionReason: body.rejectionReason || null,
        deductionCycle: deductionCycle ?? undefined,
        nextDeductionDate: nextDeductionDate ?? undefined,
        lastDeductedDate: null,
      },
    });

    return NextResponse.json(serializeRecord(record), { status: 201 });
  } catch (error) {
    console.error('Error creating cash advance:', error);
    return NextResponse.json(
      { error: 'Failed to create cash advance' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Cash advance ID is required' },
        { status: 400 }
      );
    }

    const existing = await prisma.cashAdvanceRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Cash advance not found' },
        { status: 404 }
      );
    }

    const data: Prisma.CashAdvanceRecordUpdateInput = {};

    if (body.employeeId !== undefined) {
      data.employeeId = body.employeeId;
    }
    if (body.employeeName !== undefined) {
      data.employeeName = body.employeeName ?? body.employee;
    } else if (body.employee !== undefined) {
      data.employeeName = body.employee;
    }

    const amount =
      body.amount !== undefined ? toDecimal(body.amount) : undefined;
    if (amount !== undefined && amount !== null) {
      data.amount = amount;
    }

    if (body.termsMonths !== undefined) {
      data.termsMonths =
        body.termsMonths !== null ? parseInt(body.termsMonths, 10) : null;
    }

    const monthlyPayment =
      body.monthlyPayment !== undefined
        ? toDecimal(body.monthlyPayment)
        : undefined;
    if (monthlyPayment !== undefined && monthlyPayment !== null) {
      data.monthlyPayment = monthlyPayment;
    }

    const settledAmount =
      body.settledAmount !== undefined
        ? toDecimal(body.settledAmount)
        : undefined;
    if (body.settledAmount !== undefined) {
      data.settledAmount = settledAmount;
    }

    const remainingBalance =
      body.remainingBalance !== undefined
        ? toDecimal(body.remainingBalance)
        : undefined;
    if (body.remainingBalance !== undefined) {
      data.remainingBalance = remainingBalance;
    }

    if (body.purpose !== undefined) {
      data.purpose = body.purpose;
    }
    if (body.notes !== undefined) {
      data.notes = body.notes;
    }
    if (body.requestDate !== undefined) {
      data.requestDate = toDate(body.requestDate);
    }

    if (body.approvedBy !== undefined) {
      data.approvedBy = body.approvedBy;
    }
    let approvedDateValue =
      body.approvedDate !== undefined
        ? toDate(body.approvedDate)
        : existing.approvedDate;
    if (body.approvedDate !== undefined) {
      data.approvedDate = approvedDateValue;
    }

    if (body.rejectedBy !== undefined) {
      data.rejectedBy = body.rejectedBy;
    }
    if (body.rejectedDate !== undefined) {
      data.rejectedDate = toDate(body.rejectedDate);
    }
    if (body.rejectionReason !== undefined) {
      data.rejectionReason = body.rejectionReason;
    }

    if (body.lastDeductedDate !== undefined) {
      data.lastDeductedDate = toDate(body.lastDeductedDate);
    }

    let nextStatus =
      body.status !== undefined ? String(body.status) : existing.status;
    if (body.status !== undefined) {
      data.status = nextStatus;
    }

    if (nextStatus === 'approved') {
      if (!approvedDateValue) {
        approvedDateValue = new Date();
        data.approvedDate = approvedDateValue;
      }
    }

    let nextDeductionDateUpdate: Date | null | undefined;
    let deductionCycleUpdate: CashAdvanceCycle | null | undefined;

    if (body.nextDeductionDate !== undefined) {
      const parsed = toDate(body.nextDeductionDate);
      nextDeductionDateUpdate = parsed;
      if (parsed) {
        deductionCycleUpdate = determineCycleFromDate(parsed);
      }
    }

    if (body.deductionCycle !== undefined) {
      const value = String(body.deductionCycle);
      if (value === 'FIRST_HALF' || value === 'SECOND_HALF') {
        deductionCycleUpdate = value;
      }
    }

    if (nextStatus === 'approved') {
      const needsSchedule =
        existing.status !== 'approved' || existing.nextDeductionDate === null;

      if (needsSchedule && approvedDateValue) {
        const schedule = ensureNextPayday(approvedDateValue);
        nextDeductionDateUpdate = schedule.date;
        deductionCycleUpdate = schedule.cycle;
      }
    } else if (existing.status === 'approved' && nextStatus !== 'approved') {
      nextDeductionDateUpdate = null;
      deductionCycleUpdate = null;
    }

    const remainingBalanceValue = (() => {
      if (remainingBalance !== undefined) {
        return Number(remainingBalance ?? 0);
      }
      if (existing.remainingBalance !== null) {
        return Number(existing.remainingBalance);
      }
      const settled = existing.settledAmount
        ? Number(existing.settledAmount)
        : 0;
      return Math.max(Number(existing.amount) - settled, 0);
    })();

    if (remainingBalanceValue <= 0) {
      nextStatus = 'paid';
      data.status = 'paid';
      nextDeductionDateUpdate = null;
      deductionCycleUpdate = null;
      if (remainingBalance === undefined) {
        data.remainingBalance = new Prisma.Decimal(0);
      }
    }

    if (nextDeductionDateUpdate !== undefined) {
      data.nextDeductionDate = nextDeductionDateUpdate;
    }
    if (deductionCycleUpdate !== undefined) {
      data.deductionCycle = deductionCycleUpdate;
    }

    const record = await prisma.cashAdvanceRecord.update({
      where: { id },
      data,
    });

    return NextResponse.json(serializeRecord(record));
  } catch (error) {
    console.error('Error updating cash advance:', error);
    return NextResponse.json(
      { error: 'Failed to update cash advance' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Cash advance ID is required' },
        { status: 400 }
      );
    }

    await prisma.cashAdvanceRecord.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cash advance:', error);
    return NextResponse.json(
      { error: 'Failed to delete cash advance' },
      { status: 500 }
    );
  }
}
