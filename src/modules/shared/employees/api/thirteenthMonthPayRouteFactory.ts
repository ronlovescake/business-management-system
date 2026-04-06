import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/core/api/middleware';
import { sanitizers } from '@/lib/security/sanitize';

export interface ThirteenthMonthPayRouteFilters {
  employeeId?: string;
  year?: number;
  status?: 'calculated' | 'pending' | 'approved' | 'paid';
}

type RecordIdentity = {
  id: string | number;
};

type RouteContext = {
  params: { recordId: string };
};

export interface ThirteenthMonthPayRouteService<
  TRecord extends RecordIdentity,
  TPayload = Record<string, unknown>,
> {
  findAll: () => Promise<TRecord[]>;
  findWithFilters: (
    filters: ThirteenthMonthPayRouteFilters
  ) => Promise<TRecord[]>;
  findByRecordId: (recordId: string) => Promise<TRecord | null>;
  create: (data: TPayload) => Promise<TRecord>;
  update: (id: string, data: TPayload) => Promise<TRecord>;
  updateStatusByRecordId: (
    recordId: string,
    status: string
  ) => Promise<TRecord>;
}

function buildFilters(request: NextRequest): ThirteenthMonthPayRouteFilters {
  const { searchParams } = new URL(request.url);

  const employeeIdParam = searchParams.get('employeeId');
  const yearParam = searchParams.get('year');
  const statusParam = searchParams.get('status');

  const filters: ThirteenthMonthPayRouteFilters = {};

  if (employeeIdParam) {
    filters.employeeId = sanitizers.name(employeeIdParam);
  }

  if (yearParam) {
    const year = sanitizers.number(yearParam, { min: 2000, max: 2100 });
    if (year !== null) {
      filters.year = year;
    }
  }

  if (statusParam) {
    const normalizedStatus = sanitizers.name(statusParam);
    if (
      normalizedStatus === 'calculated' ||
      normalizedStatus === 'pending' ||
      normalizedStatus === 'approved' ||
      normalizedStatus === 'paid'
    ) {
      filters.status = normalizedStatus;
    }
  }

  return filters;
}

function buildFetchErrorResponse() {
  return NextResponse.json(
    {
      error: 'Failed to load 13th month pay records',
    },
    { status: 500 }
  );
}

function buildPersistErrorResponse(error: unknown) {
  return NextResponse.json(
    {
      error: 'Failed to persist record',
      details: error instanceof Error ? error.message : String(error),
    },
    { status: 500 }
  );
}

function buildStatusErrorResponse(error: unknown) {
  return NextResponse.json(
    {
      error: 'Failed to update status',
      details: error instanceof Error ? error.message : String(error),
    },
    {
      status:
        error instanceof Error && error.message.includes('not found')
          ? 404
          : 500,
    }
  );
}

export function createThirteenthMonthPayRoutes<
  TRecord extends RecordIdentity,
  TPayload,
>(service: ThirteenthMonthPayRouteService<TRecord, TPayload>) {
  const GET = withErrorHandler(
    async (request: NextRequest) => {
      const filters = buildFilters(request);
      const hasFilters = Object.keys(filters).length > 0;
      const records = hasFilters
        ? await service.findWithFilters(filters)
        : await service.findAll();

      return NextResponse.json(records);
    },
    {
      onError: () => buildFetchErrorResponse(),
    }
  );

  const PATCH = withErrorHandler(
    async (request: NextRequest) => {
      const body = await request.json();

      if (typeof body !== 'object' || body === null) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
      }

      const { id: recordId, ...data } = body as Record<string, unknown>;

      if (typeof recordId !== 'string' || recordId.trim().length === 0) {
        return NextResponse.json(
          { error: 'Record ID is required' },
          { status: 400 }
        );
      }

      const existing = await service.findByRecordId(recordId);
      const result = existing
        ? await service.update(String(existing.id), data as TPayload)
        : await service.create({ recordId, ...data } as unknown as TPayload);

      return NextResponse.json(result);
    },
    {
      onError: (error) => buildPersistErrorResponse(error),
    }
  );

  return { GET, PATCH };
}

export function createThirteenthMonthPayStatusRoute<
  TRecord extends RecordIdentity,
  TPayload,
>(service: ThirteenthMonthPayRouteService<TRecord, TPayload>) {
  const PATCH = withErrorHandler(
    async (request: NextRequest, context?: RouteContext) => {
      const recordId = context?.params?.recordId?.trim() || '';
      const body = await request.json();

      if (!recordId) {
        return NextResponse.json(
          { error: 'Record ID is required' },
          { status: 400 }
        );
      }

      if (typeof body !== 'object' || body === null) {
        return NextResponse.json(
          { error: 'Invalid payload for updating status' },
          { status: 400 }
        );
      }

      const { status } = body as { status?: unknown };

      if (typeof status !== 'string') {
        return NextResponse.json(
          { error: 'Status is required' },
          { status: 400 }
        );
      }

      const updated = await service.updateStatusByRecordId(recordId, status);

      return NextResponse.json(updated);
    },
    {
      onError: (error) => buildStatusErrorResponse(error),
    }
  );

  return { PATCH };
}
