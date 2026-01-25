import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';

type CleanupFilters = {
  periodStart?: string;
  periodEnd?: string;
};

const gmPrisma = prisma as unknown as {
  generalMerchandisePayroll: typeof prisma.payroll;
};

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const filters = parseCleanupFilters(searchParams);

  const validationErrors = getCleanupValidationErrors(filters);
  if (validationErrors) {
    return ApiResponse.badRequest(
      'Missing payroll cleanup filters',
      validationErrors
    );
  }

  const { periodStart, periodEnd } = filters as Required<CleanupFilters>;

  const result = await gmPrisma.generalMerchandisePayroll.deleteMany({
    where: {
      periodStart,
      periodEnd,
      deletedAt: { not: null },
    },
  });

  logger.info('Soft-deleted payroll records permanently removed', {
    periodStart,
    periodEnd,
    count: result.count,
  });

  return ApiResponse.success(
    {
      filters: { periodStart, periodEnd },
      count: result.count,
    },
    `${result.count} soft-deleted payroll record(s) permanently removed`
  );
});

function sanitizeQueryValue(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function parseCleanupFilters(searchParams: URLSearchParams): CleanupFilters {
  return {
    periodStart: sanitizeQueryValue(searchParams.get('periodStart')),
    periodEnd: sanitizeQueryValue(searchParams.get('periodEnd')),
  };
}

function getCleanupValidationErrors(
  filters: CleanupFilters
): Record<string, string> | undefined {
  const errors: Record<string, string> = {};

  if (!filters.periodStart) {
    errors.periodStart = 'Provide periodStart query parameter (YYYY-MM-DD).';
  }

  if (!filters.periodEnd) {
    errors.periodEnd = 'Provide periodEnd query parameter (YYYY-MM-DD).';
  }

  return Object.keys(errors).length > 0 ? errors : undefined;
}
