import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  cashAdvanceService,
  CashAdvanceQuerySchema,
} from '@/modules/clothing/employees/cash-advance/api';

/**
 * Cash Advances API Route
 *
 * Handles CRUD operations for cash advances using service layer:
 * - GET: Fetch all cash advances with optional filters
 * - POST: Create a new cash advance
 * - PUT: Update an existing cash advance
 * - DELETE: Delete a cash advance or all cash advances
 */

/**
 * GET /api/cash-advances
 *
 * Fetch all cash advances with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get('status');
    const employeeIdParam = searchParams.get('employeeId');

    // Build query from search params
    const queryParams = {
      status: statusParam && statusParam !== 'all' ? statusParam : undefined,
      employeeId: employeeIdParam || undefined,
    };

    // Remove undefined values
    const query = Object.fromEntries(
      Object.entries(queryParams).filter(([_, v]) => v !== undefined)
    );

    // Validate query params
    const validatedQuery =
      Object.keys(query).length > 0 ? CashAdvanceQuerySchema.parse(query) : {};

    // Fetch cash advances using service
    const cashAdvances =
      Object.keys(validatedQuery).length > 0
        ? await cashAdvanceService.findWithFilters(validatedQuery)
        : await cashAdvanceService.findAll();

    return NextResponse.json(cashAdvances);
  } catch (error) {
    logger.error('Failed to fetch cash advances', { error });
    return NextResponse.json(
      {
        error: 'Failed to fetch cash advances',
        details: error instanceof Error ? error.message : String(error),
      },
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
