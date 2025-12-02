/**
 * Employee Salary History Route Factory
 *
 * Provides reusable GET/POST handlers for salary history routes scoped by
 * employee identifier. Ensures consistent validation, logging, and API
 * response envelopes across clothing and trucking domains.
 */

import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiResponse } from '@/core/api/response';
import { HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import { withErrorHandler } from '@/core/api/middleware';

const normalizeRequiredNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }

  return value;
};

const normalizeOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }

  return value;
};

const SalaryHistoryCreateSchema = z.object({
  effectiveDate: z
    .string({ required_error: 'Effective date is required' })
    .min(1, 'Effective date is required'),
  basicSalary: z.preprocess(
    normalizeRequiredNumber,
    z.number({
      required_error: 'Basic salary is required',
      invalid_type_error: 'Basic salary must be a number',
    })
  ),
  allowance: z
    .preprocess(
      normalizeOptionalNumber,
      z.number({ invalid_type_error: 'Allowance must be a number' })
    )
    .optional(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type EmployeeIdentifier = {
  id: number | null;
  employeeId: string | null;
  name: string | null;
};

export type EmployeeDelegate = {
  findFirst: (args: {
    where: {
      id?: number;
      employeeId?: string;
      deletedAt: null;
    };
    select: {
      id: true;
      employeeId: true;
      name: true;
    };
  }) => Promise<EmployeeIdentifier | null>;
};

export type SalaryHistoryRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  effectiveDate: string;
  basicSalary: number;
  allowance: number;
  totalSalary: number;
  reason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  createdBy: string | null;
};

export type SalaryHistoryDelegate = {
  findMany: (args: {
    where: {
      employeeId: string;
      deletedAt: null;
    };
    orderBy: {
      effectiveDate: 'asc' | 'desc';
    };
  }) => Promise<SalaryHistoryRecord[]>;
  create: (args: {
    data: {
      employeeId: string;
      employeeName: string;
      effectiveDate: string;
      basicSalary: number;
      allowance: number;
      totalSalary: number;
      reason: string | null;
      notes: string | null;
    };
  }) => Promise<SalaryHistoryRecord>;
};

export interface SalaryHistoryRouteConfig {
  employeeDelegate: EmployeeDelegate;
  salaryHistoryDelegate: SalaryHistoryDelegate;
  loggerScope?: string;
}

type SalaryHistoryRouteContext = { params?: { id?: string } };

type Handler = (
  request: NextRequest,
  context: SalaryHistoryRouteContext
) => Promise<Response>;

export function createEmployeeSalaryHistoryRoutes(
  config: SalaryHistoryRouteConfig
): { GET: Handler; POST: Handler } {
  const { employeeDelegate, salaryHistoryDelegate, loggerScope } = config;
  const scope = loggerScope ?? 'Employee salary history';

  const formatValidationErrors = (errors: z.ZodIssue[]) =>
    errors.reduce<Record<string, string>>((acc, issue) => {
      const path = issue.path.join('.') || 'root';
      acc[path] = issue.message;
      return acc;
    }, {});

  const resolveEmployee = async (
    identifier: string
  ): Promise<EmployeeIdentifier | null> => {
    const trimmed = identifier.trim();

    if (!trimmed) {
      return null;
    }

    const isNumeric = /^\d+$/.test(trimmed);

    if (isNumeric) {
      return employeeDelegate.findFirst({
        where: {
          id: Number(trimmed),
          deletedAt: null,
        },
        select: {
          id: true,
          employeeId: true,
          name: true,
        },
      });
    }

    return employeeDelegate.findFirst({
      where: {
        employeeId: trimmed,
        deletedAt: null,
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
      },
    });
  };

  const ensureParams = (context: SalaryHistoryRouteContext) => {
    const identifier = context.params?.id?.trim();

    if (!identifier) {
      return ApiResponse.badRequest('Employee identifier is required');
    }

    return identifier;
  };

  const GET = withErrorHandler(async (_request, context) => {
    const identifierOrResponse = ensureParams(context ?? {});

    if (typeof identifierOrResponse !== 'string') {
      return identifierOrResponse;
    }

    try {
      const employee = await resolveEmployee(identifierOrResponse);

      if (!employee?.employeeId) {
        return ApiResponse.notFound('Employee');
      }

      const salaryHistory = await salaryHistoryDelegate.findMany({
        where: {
          employeeId: employee.employeeId,
          deletedAt: null,
        },
        orderBy: {
          effectiveDate: 'desc',
        },
      });

      logger.info(`[${scope}] Salary history fetched`, {
        employeeId: employee.employeeId,
        count: salaryHistory.length,
      });

      return ApiResponse.success(salaryHistory, 'Salary history fetched');
    } catch (error) {
      logger.error(`[${scope}] Error fetching salary history`, { error });
      return ApiResponse.error('Failed to fetch salary history');
    }
  });

  const POST = withErrorHandler(async (request, context) => {
    const identifierOrResponse = ensureParams(context ?? {});

    if (typeof identifierOrResponse !== 'string') {
      return identifierOrResponse;
    }

    try {
      const employee = await resolveEmployee(identifierOrResponse);

      if (!employee?.employeeId) {
        return ApiResponse.notFound('Employee');
      }

      const body = await request.json();
      const validation = SalaryHistoryCreateSchema.safeParse(body);

      if (!validation.success) {
        return ApiResponse.badRequest(
          'Validation failed',
          formatValidationErrors(validation.error.errors)
        );
      }

      const { effectiveDate, basicSalary, allowance, reason, notes } =
        validation.data;
      const allowanceValue = typeof allowance === 'number' ? allowance : 0;
      const totalSalary = basicSalary + allowanceValue;

      const salaryRecord = await salaryHistoryDelegate.create({
        data: {
          employeeId: employee.employeeId,
          employeeName: employee.name ?? 'Unknown Employee',
          effectiveDate,
          basicSalary,
          allowance: allowanceValue,
          totalSalary,
          reason: reason ?? null,
          notes: notes ?? null,
        },
      });

      logger.info(`[${scope}] Salary record created`, {
        employeeId: employee.employeeId,
        salaryHistoryId: salaryRecord.id,
      });

      return ApiResponse.success(
        salaryRecord,
        'Salary record created',
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      logger.error(`[${scope}] Error creating salary record`, { error });
      return ApiResponse.error('Failed to create salary record');
    }
  });

  return { GET, POST };
}
