import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getCurrentDateISO } from '@/utils/date';
import { validateMassDeleteConfirmation } from '@/lib/safety/mass-deletion';
import { sanitizers } from '@/lib/security/sanitize';

type LeaveRequestPayload = Record<string, unknown>;

type LeaveStatus = 'pending' | 'approved' | 'rejected';
type PaymentStatus = 'paid' | 'unpaid' | 'not-applicable';

interface LeaveRequestCreateInput {
  employeeId: string;
  employeeName: string;
  leaveType: string;
  paymentStatus: PaymentStatus;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
  status: LeaveStatus;
  appliedDate: string;
  approvedBy: string | null;
  notes: string | null;
}

type LeaveRequestUpdateInput = Partial<LeaveRequestCreateInput>;

interface LeaveRequestRecord extends LeaveRequestCreateInput {
  id: number;
  createdAt?: string;
  updatedAt?: string;
}

interface LeaveRequestDelegate {
  findMany(args?: unknown): Promise<LeaveRequestRecord[]>;
  createMany(args: {
    data: LeaveRequestCreateInput[];
  }): Promise<{ count: number }>;
  update(args: {
    where: { id: number };
    data: LeaveRequestUpdateInput;
  }): Promise<LeaveRequestRecord>;
  deleteMany(args?: unknown): Promise<{ count: number }>;
}

const gmPrisma = prisma as unknown as {
  generalMerchandiseLeaveRequest: LeaveRequestDelegate;
};

const VALID_STATUSES: LeaveStatus[] = ['pending', 'approved', 'rejected'];
const VALID_PAYMENT_STATUSES: PaymentStatus[] = [
  'paid',
  'unpaid',
  'not-applicable',
];

function parseString(value: unknown): string {
  return sanitizers.name(value);
}

function parseOptionalString(value: unknown): string | undefined {
  const parsed = parseString(value);
  return parsed.length === 0 ? undefined : parsed;
}

function parseStatus(value: unknown): LeaveStatus {
  const normalized = parseString(value).toLowerCase();
  return (VALID_STATUSES as string[]).includes(normalized)
    ? (normalized as LeaveStatus)
    : 'pending';
}

function parsePaymentStatus(value: unknown): PaymentStatus {
  const normalized = parseString(value).toLowerCase();
  return (VALID_PAYMENT_STATUSES as string[]).includes(normalized)
    ? (normalized as PaymentStatus)
    : 'unpaid';
}

function calculateNumberOfDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) {
    return 0;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

function normalizeCreatePayload(
  data: LeaveRequestPayload
): LeaveRequestCreateInput {
  const employeeId = parseString(data.employeeId);
  const employeeName = parseString(data.employeeName);
  const leaveType = parseString(data.leaveType);
  const startDate = parseString(data.startDate);
  const endDate = parseString(data.endDate);
  const reason = parseString(data.reason);

  const status = parseStatus(data.status);
  const paymentStatus = parsePaymentStatus(data.paymentStatus);
  const appliedDate = parseString(data.appliedDate || getCurrentDateISO());

  const rawNumber = Number(data.numberOfDays);
  const numberOfDays =
    Number.isFinite(rawNumber) && rawNumber > 0
      ? rawNumber
      : calculateNumberOfDays(startDate, endDate);

  return {
    employeeId,
    employeeName,
    leaveType,
    paymentStatus,
    startDate,
    endDate,
    numberOfDays,
    reason,
    status,
    appliedDate,
    approvedBy: parseOptionalString(data.approvedBy) ?? null,
    notes: parseOptionalString(data.notes) ?? null,
  };
}

function normalizeUpdatePayload(
  data: LeaveRequestPayload
): LeaveRequestUpdateInput {
  const updateData: LeaveRequestUpdateInput = {};

  if (data.employeeId !== undefined) {
    updateData.employeeId = parseString(data.employeeId);
  }
  if (data.employeeName !== undefined) {
    updateData.employeeName = parseString(data.employeeName);
  }
  if (data.leaveType !== undefined) {
    updateData.leaveType = parseString(data.leaveType);
  }
  if (data.paymentStatus !== undefined) {
    updateData.paymentStatus = parsePaymentStatus(data.paymentStatus);
  }
  if (data.startDate !== undefined) {
    updateData.startDate = parseString(data.startDate);
  }
  if (data.endDate !== undefined) {
    updateData.endDate = parseString(data.endDate);
  }
  if (data.reason !== undefined) {
    updateData.reason = parseString(data.reason);
  }
  if (data.status !== undefined) {
    updateData.status = parseStatus(data.status);
  }
  if (data.appliedDate !== undefined) {
    updateData.appliedDate = parseString(data.appliedDate);
  }
  if (data.approvedBy !== undefined) {
    updateData.approvedBy = parseOptionalString(data.approvedBy) ?? null;
  }
  if (data.notes !== undefined) {
    updateData.notes = parseOptionalString(data.notes) ?? null;
  }
  if (data.numberOfDays !== undefined) {
    const numberValue = Number(data.numberOfDays);
    updateData.numberOfDays = Number.isFinite(numberValue)
      ? numberValue
      : undefined;
  } else if (data.startDate !== undefined || data.endDate !== undefined) {
    const startDate = parseString(data.startDate);
    const endDate = parseString(data.endDate);
    const calculatedDays = calculateNumberOfDays(startDate, endDate);
    updateData.numberOfDays = calculatedDays;
  }

  return updateData;
}

function ensureArray<T>(payload: T | T[]): T[] {
  return Array.isArray(payload) ? payload : [payload];
}

function getLeaveRequestClient(): LeaveRequestDelegate {
  return gmPrisma.generalMerchandiseLeaveRequest;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeIdParam = searchParams.get('employeeId');
    const normalizedEmployeeId = employeeIdParam
      ? employeeIdParam.trim()
      : undefined;

    const leaveRequestClient = getLeaveRequestClient();
    const leaveRequests = await leaveRequestClient.findMany({
      where: normalizedEmployeeId
        ? { employeeId: normalizedEmployeeId }
        : undefined,
      orderBy: { startDate: 'desc' },
    });

    const formatted = leaveRequests.map((request) => ({
      id: String(request.id),
      employeeId: request.employeeId,
      employeeName: request.employeeName,
      leaveType: request.leaveType,
      paymentStatus: request.paymentStatus as PaymentStatus,
      startDate: request.startDate,
      endDate: request.endDate,
      numberOfDays: request.numberOfDays,
      reason: request.reason,
      status: request.status as LeaveStatus,
      appliedDate: request.appliedDate,
      approvedBy: request.approvedBy ?? undefined,
      notes: request.notes ?? undefined,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    logger.error('Failed to fetch GM leave requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave requests' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const items = ensureArray(payload);

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Request body must contain one or more leave requests' },
        { status: 400 }
      );
    }

    if (items.length > 10000) {
      return NextResponse.json(
        {
          error: 'Batch size limit exceeded',
          details: `You are trying to import ${items.length} records. Maximum is 10,000 records per import.`,
          suggestion:
            'Please split your import into smaller batches of 10,000 records or less.',
        },
        { status: 413 }
      );
    }

    const normalized = items.map(normalizeCreatePayload);

    const leaveRequestClient = getLeaveRequestClient();
    const result = await leaveRequestClient.createMany({
      data: normalized,
    });

    return NextResponse.json(
      {
        count: result.count,
        message: 'Leave requests created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to create GM leave requests:', error);
    return NextResponse.json(
      { error: 'Failed to create leave requests' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as LeaveRequestPayload;
    const id = Number(body.id);

    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { error: 'Valid leave request ID is required' },
        { status: 400 }
      );
    }

    const updateData = normalizeUpdatePayload(body);

    const leaveRequestClient = getLeaveRequestClient();
    const updated = await leaveRequestClient.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      id: String(updated.id),
    });
  } catch (error) {
    logger.error('Failed to update GM leave request:', error);
    return NextResponse.json(
      { error: 'Failed to update leave request' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as LeaveRequestPayload;
    const id = Number(body.id);

    if (!id || Number.isNaN(id)) {
      return NextResponse.json(
        { error: 'Valid leave request ID is required' },
        { status: 400 }
      );
    }

    const updateData = normalizeUpdatePayload(body);

    const leaveRequestClient = getLeaveRequestClient();
    const updated = await leaveRequestClient.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      id: String(updated.id),
    });
  } catch (error) {
    logger.error('Failed to patch GM leave request:', error);
    return NextResponse.json(
      { error: 'Failed to update leave request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const validation = validateMassDeleteConfirmation(
      request,
      'LEAVE_REQUESTS'
    );
    if (validation) {
      return validation;
    }

    const leaveRequestClient = getLeaveRequestClient();
    const result = await leaveRequestClient.deleteMany();

    return NextResponse.json({
      message: `Successfully deleted ${result.count} leave request records`,
      count: result.count,
    });
  } catch (error) {
    logger.error('Failed to delete GM leave request(s):', error);
    return NextResponse.json(
      { error: 'Failed to delete leave request(s)' },
      { status: 500 }
    );
  }
}
