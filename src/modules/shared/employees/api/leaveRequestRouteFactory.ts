import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/core/api/middleware';
import { validateMassDeleteConfirmation } from '@/lib/safety/mass-deletion';
import { getCurrentDateISO } from '@/utils/date';
import { sanitizers } from '@/lib/security/sanitize';

type LeaveRequestPayload = Record<string, unknown>;

type LeaveStatus = 'pending' | 'approved' | 'rejected';
type PaymentStatus = 'paid' | 'unpaid' | 'not-applicable';

export interface LeaveRequestCreateInput {
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

export type LeaveRequestUpdateInput = Partial<LeaveRequestCreateInput>;

type LeaveRequestEntityLike = {
  id: number | string;
  employeeId: string | null;
  employeeName: string;
  leaveType: string;
  paymentStatus: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  reason: string;
  status: string;
  appliedDate: string;
  approvedBy?: string | null;
  notes?: string | null;
};

type RouteContext = {
  params: { id: string };
};

type EmployeeIdsResult = Array<{ employeeId: string }>;

const BULK_LIMIT = 10000;
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
  } else if (data.startDate !== undefined && data.endDate !== undefined) {
    updateData.numberOfDays = calculateNumberOfDays(
      parseString(data.startDate),
      parseString(data.endDate)
    );
  }

  return updateData;
}

function ensureArray<T>(payload: T | T[]): T[] {
  return Array.isArray(payload) ? payload : [payload];
}

function formatLeaveRequest<TRecord extends LeaveRequestEntityLike>(
  request: TRecord
) {
  return {
    id: String(request.id),
    employeeId: request.employeeId ?? '',
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
  };
}

function parseId(value: string) {
  const numericId = Number.parseInt(value, 10);
  return Number.isNaN(numericId) ? null : numericId;
}

function buildCreateErrorResponse(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[]) || [];
      return NextResponse.json(
        {
          error: 'Duplicate leave request',
          details: `A leave request with this ${target.join(', ')} already exists`,
          field: target[0],
        },
        { status: 409 }
      );
    }

    if (error.code === 'P2003') {
      return NextResponse.json(
        {
          error: 'Referenced employee not found',
          details: 'One or more employee IDs do not exist in the database',
        },
        { status: 409 }
      );
    }
  }

  return NextResponse.json(
    {
      error: 'Failed to import leave requests',
      details: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
}

function buildUpdateErrorResponse(error: unknown, message: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return NextResponse.json(
      { error: 'Leave request not found or already deleted' },
      { status: 404 }
    );
  }

  return NextResponse.json(
    {
      error: message,
      details: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
}

function buildDeleteByIdErrorResponse(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return NextResponse.json(
      { error: 'Leave request not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { error: 'Failed to delete leave request' },
    { status: 500 }
  );
}

export interface LeaveRequestRouteFactoryConfig<
  TRecord extends LeaveRequestEntityLike,
> {
  leaveRequestModel: {
    findMany: (args: {
      where?: { employeeId: string };
      orderBy: { startDate: 'desc' };
    }) => Promise<TRecord[]>;
    findActiveById: (id: number) => Promise<TRecord | null>;
    createMany: (data: LeaveRequestCreateInput[]) => Promise<{ count: number }>;
    update: (id: number, data: LeaveRequestUpdateInput) => Promise<TRecord>;
    softDelete: (id: number) => Promise<TRecord>;
    softDeleteAll: () => Promise<{ count: number }>;
  };
  employeeModel: {
    findExistingIds: (employeeIds: string[]) => Promise<EmployeeIdsResult>;
  };
}

export function createLeaveRequestRoutes<
  TRecord extends LeaveRequestEntityLike,
>(config: LeaveRequestRouteFactoryConfig<TRecord>) {
  const GET = withErrorHandler(
    async (request: NextRequest) => {
      const { searchParams } = new URL(request.url);
      const employeeIdParam = searchParams.get('employeeId');
      const employeeId = employeeIdParam ? employeeIdParam.trim() : undefined;

      const leaveRequests = await config.leaveRequestModel.findMany({
        where: employeeId ? { employeeId } : undefined,
        orderBy: { startDate: 'desc' },
      });

      return NextResponse.json(leaveRequests.map(formatLeaveRequest));
    },
    {
      onError: () =>
        NextResponse.json(
          { error: 'Failed to fetch leave requests' },
          { status: 500 }
        ),
    }
  );

  const POST = withErrorHandler(
    async (request: NextRequest) => {
      const payload = await request.json();
      const items = ensureArray(payload);

      if (items.length === 0) {
        return NextResponse.json(
          { error: 'Request body must contain one or more leave requests' },
          { status: 400 }
        );
      }

      if (items.length > BULK_LIMIT) {
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

      const data = items.map((item) => {
        const normalized = normalizeCreatePayload(item as LeaveRequestPayload);

        if (
          !normalized.employeeId ||
          !normalized.employeeName ||
          !normalized.leaveType ||
          !normalized.startDate ||
          !normalized.endDate ||
          !normalized.reason
        ) {
          return null;
        }

        if (!normalized.numberOfDays || normalized.numberOfDays <= 0) {
          normalized.numberOfDays = calculateNumberOfDays(
            normalized.startDate,
            normalized.endDate
          );
        }

        return normalized;
      });

      if (data.some((item) => item === null)) {
        return NextResponse.json(
          {
            error: 'Failed to import leave requests',
            details: 'Missing required fields for leave request',
          },
          { status: 400 }
        );
      }

      const normalizedData = data as LeaveRequestCreateInput[];
      const employeeIds = Array.from(
        new Set(normalizedData.map((item) => item.employeeId))
      );

      if (employeeIds.length > 0) {
        const existingEmployees =
          await config.employeeModel.findExistingIds(employeeIds);
        const existingIds = new Set(
          existingEmployees.map((employee) => employee.employeeId)
        );
        const missingIds = employeeIds.filter((id) => !existingIds.has(id));

        if (missingIds.length > 0) {
          return NextResponse.json(
            {
              error: 'Referenced employees not found',
              details: `The following employee IDs do not exist: ${missingIds.join(', ')}`,
              missingEmployeeIds: missingIds,
              suggestion:
                'Please ensure all employees exist before importing leave requests',
            },
            { status: 409 }
          );
        }
      }

      const result = await config.leaveRequestModel.createMany(normalizedData);

      return NextResponse.json({
        message: `Successfully imported ${result.count} leave request records`,
        count: result.count,
      });
    },
    {
      onError: (error) => buildCreateErrorResponse(error),
    }
  );

  const PUT = withErrorHandler(
    async (request: NextRequest) => {
      const payload = await request.json();

      if (Array.isArray(payload)) {
        const items = payload as Array<LeaveRequestPayload & { id?: string }>;

        if (items.length === 0) {
          return NextResponse.json(
            { error: 'Expected array of leave requests to update' },
            { status: 400 }
          );
        }

        const updates = await Promise.all(
          items.map(async (item) => {
            const id = parseString(item.id);
            if (!id) {
              throw new Error('Leave request ID is required for updates');
            }

            const updateData = normalizeUpdatePayload(item);
            if (Object.keys(updateData).length === 0) {
              return null;
            }

            return config.leaveRequestModel.update(
              parseInt(id, 10),
              updateData
            );
          })
        );

        const updatedCount = updates.filter(Boolean).length;

        return NextResponse.json({
          message: `Successfully updated ${updatedCount} leave requests`,
          count: updatedCount,
        });
      }

      const body = payload as LeaveRequestPayload;
      const id = parseId(String(body.id ?? ''));

      if (!id) {
        return NextResponse.json(
          { error: 'Valid leave request ID is required' },
          { status: 400 }
        );
      }

      const updated = await config.leaveRequestModel.update(
        id,
        normalizeUpdatePayload(body)
      );

      return NextResponse.json(formatLeaveRequest(updated));
    },
    {
      onError: (error) =>
        buildUpdateErrorResponse(error, 'Failed to bulk update leave requests'),
    }
  );

  const PATCH = withErrorHandler(
    async (request: NextRequest) => {
      const payload = (await request.json()) as LeaveRequestPayload & {
        id?: string;
      };
      const id = parseString(payload.id);

      if (!id) {
        return NextResponse.json(
          { error: 'Leave request ID is required' },
          { status: 400 }
        );
      }

      const updateData = normalizeUpdatePayload(payload);
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json(
          { error: 'No valid fields supplied for update' },
          { status: 400 }
        );
      }

      const updated = await config.leaveRequestModel.update(
        parseInt(id, 10),
        updateData
      );

      return NextResponse.json({
        message: 'Leave request updated successfully',
        request: formatLeaveRequest(updated),
      });
    },
    {
      onError: (error) =>
        buildUpdateErrorResponse(error, 'Failed to update leave request'),
    }
  );

  const DELETE = withErrorHandler(
    async (request: NextRequest) => {
      const validation = validateMassDeleteConfirmation(
        request,
        'LEAVE_REQUESTS'
      );
      if (validation) {
        return validation;
      }

      const result = await config.leaveRequestModel.softDeleteAll();

      return NextResponse.json({
        message: `Successfully deleted ${result.count} leave request records`,
        count: result.count,
      });
    },
    {
      onError: () =>
        NextResponse.json(
          { error: 'Failed to delete leave requests' },
          { status: 500 }
        ),
    }
  );

  const GET_BY_ID = withErrorHandler(
    async (_request: NextRequest, context?: RouteContext) => {
      const id = context?.params?.id?.trim() || '';
      if (!id) {
        return NextResponse.json(
          { error: 'Leave request ID is required' },
          { status: 400 }
        );
      }

      const numericId = parseId(id);
      if (!numericId) {
        return NextResponse.json(
          { error: 'Leave request ID is required' },
          { status: 400 }
        );
      }

      const leaveRequest =
        await config.leaveRequestModel.findActiveById(numericId);

      if (!leaveRequest) {
        return NextResponse.json(
          { error: 'Leave request not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(formatLeaveRequest(leaveRequest));
    },
    {
      onError: () =>
        NextResponse.json(
          { error: 'Failed to fetch leave request' },
          { status: 500 }
        ),
    }
  );

  const DELETE_BY_ID = withErrorHandler(
    async (_request: NextRequest, context?: RouteContext) => {
      const id = context?.params?.id?.trim() || '';
      if (!id) {
        return NextResponse.json(
          { error: 'Leave request ID is required' },
          { status: 400 }
        );
      }

      const numericId = parseId(id);
      if (!numericId) {
        return NextResponse.json(
          { error: 'Leave request ID is required' },
          { status: 400 }
        );
      }

      const existingLeaveRequest =
        await config.leaveRequestModel.findActiveById(numericId);

      if (!existingLeaveRequest) {
        return NextResponse.json(
          { error: 'Leave request not found' },
          { status: 404 }
        );
      }

      await config.leaveRequestModel.softDelete(numericId);

      return NextResponse.json({
        message: 'Leave request deleted successfully',
        id,
      });
    },
    {
      onError: (error) => buildDeleteByIdErrorResponse(error),
    }
  );

  return { GET, POST, PUT, PATCH, DELETE, GET_BY_ID, DELETE_BY_ID };
}
