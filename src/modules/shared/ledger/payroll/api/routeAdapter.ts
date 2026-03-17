import type { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { BATCH_LIMITS, HTTP_STATUS } from '@/shared/constants/api';
import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import {
  formatValidationErrors,
  validatePayroll,
  type PayrollInput,
} from '@/lib/validations/payroll.validation';

const BULK_PAYROLL_LIMIT = BATCH_LIMITS.MAX_BATCH_SIZE;

type PayrollRecord = Record<string, unknown>;
type BulkValidationIssue = { index: number; errors: Record<string, string> };
type BuildPayrollUpdateResult =
  | { success: true; payload: PayrollInput }
  | { success: false; errors: Record<string, string> };

export type PayrollRouteRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  payPeriod: string;
  periodStart: string;
  periodEnd: string;
  basicSalary: number;
  allowance: number;
  overtime: number;
  bonuses: number;
  thirteenthMonth: number;
  grossPay: number;
  sss: number;
  philHealth: number;
  pagIbig: number;
  tax: number;
  loans: number;
  cashAdvance: number;
  lwop: number;
  absentsLates: number;
  totalDeductions: number;
  netPay: number;
  status: string;
  bankGcash: string;
  approvedBy: string | null;
  approvedDate: string | null;
  paidDate: string | null;
  unpaidDays: number;
  dailyRate: number;
  deduction: number;
  notes: string | null;
  deletedAt: Date | null;
};

type NumericPayrollField = {
  [K in keyof PayrollInput]: PayrollInput[K] extends number ? K : never;
}[keyof PayrollInput];

const MONEY_FIELDS = [
  'basicSalary',
  'allowance',
  'overtime',
  'bonuses',
  'thirteenthMonth',
  'grossPay',
  'sss',
  'philHealth',
  'pagIbig',
  'tax',
  'loans',
  'cashAdvance',
  'lwop',
  'absentsLates',
  'totalDeductions',
  'dailyRate',
  'deduction',
] as const satisfies NumericPayrollField[];

const ALLOWED_STATUSES: PayrollInput['status'][] = [
  'pending',
  'approved',
  'paid',
];

type PayrollModel<TRecord extends PayrollRouteRecord> = {
  findMany: (args: {
    where: Record<string, unknown>;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }) => Promise<TRecord[]>;
  findUnique: (args: { where: { id: string } }) => Promise<TRecord | null>;
  create: (args: { data: PayrollInput }) => Promise<TRecord>;
  update: (args: {
    where: { id: string };
    data: Partial<PayrollInput> | { deletedAt: Date };
  }) => Promise<TRecord>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};

type EmployeeModel = {
  findMany: (args: {
    where: {
      employeeId: { in: string[] };
      deletedAt: null;
    };
    select: { employeeId: true };
  }) => Promise<Array<{ employeeId: string }>>;
};

type PayrollRouteConfig<TRecord extends PayrollRouteRecord> = {
  payrollModel: PayrollModel<TRecord>;
  employeeModel: EmployeeModel;
  createRecords: (records: PayrollInput[]) => Promise<TRecord[]>;
  syncPayrollDeductions: (payrolls: TRecord[]) => Promise<TRecord[]>;
  syncExpenseFromPayroll: (
    payroll: TRecord,
    processedBy?: string | null
  ) => Promise<void>;
  shouldSync: (status: string) => boolean;
  logPrefix?: string;
};

function sanitizeMoney(
  value: unknown,
  options: { allowNegative?: boolean } = {}
): number {
  const sanitized = sanitizers.number(value, { decimals: 2 });
  if (sanitized === null || Number.isNaN(sanitized)) {
    return 0;
  }

  if (!options.allowNegative && sanitized < 0) {
    return 0;
  }

  return sanitized;
}

function sanitizeInteger(value: unknown): number {
  const sanitized = sanitizers.number(value, { decimals: 0, min: 0 });
  if (sanitized === null || Number.isNaN(sanitized)) {
    return 0;
  }
  return Math.max(0, Math.trunc(sanitized));
}

function sanitizeOptionalNotes(value: unknown): string | null {
  const sanitized = sanitizers.notes(value);
  return sanitized ? sanitized : null;
}

function sanitizeOptionalDate(value: unknown): string | null {
  const sanitized = sanitizers.date(value);
  return sanitized ? sanitized : null;
}

function sanitizeStatus(value: unknown): PayrollInput['status'] {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    const matched = ALLOWED_STATUSES.find((status) => status === normalized);
    if (matched) {
      return matched;
    }
  }
  return 'pending';
}

function sanitizeRequiredField(value: unknown): string {
  return sanitizers.name(value) || '';
}

function sanitizePayrollRecord(record: PayrollRecord): PayrollInput {
  const employeeIdSource =
    record.employeeId || record.employee || record.employee_code;
  const employeeNameSource =
    record.employeeName || record.employee || record.name;

  return {
    employeeId: sanitizeRequiredField(employeeIdSource),
    employeeName: sanitizeRequiredField(employeeNameSource),
    payPeriod: sanitizeRequiredField(record.payPeriod),
    periodStart: sanitizers.date(record.periodStart) || '',
    periodEnd: sanitizers.date(record.periodEnd) || '',
    basicSalary: sanitizeMoney(record.basicSalary),
    allowance: sanitizeMoney(record.allowance),
    overtime: sanitizeMoney(record.overtime),
    bonuses: sanitizeMoney(record.bonuses),
    thirteenthMonth: sanitizeMoney(record.thirteenthMonth),
    grossPay: sanitizeMoney(record.grossPay),
    sss: sanitizeMoney(record.sss),
    philHealth: sanitizeMoney(record.philHealth),
    pagIbig: sanitizeMoney(record.pagIbig),
    tax: sanitizeMoney(record.tax),
    loans: sanitizeMoney(record.loans),
    cashAdvance: sanitizeMoney(record.cashAdvance),
    lwop: sanitizeMoney(record.lwop),
    absentsLates: sanitizeMoney(record.absentsLates),
    totalDeductions: sanitizeMoney(record.totalDeductions),
    netPay: sanitizeMoney(record.netPay, { allowNegative: true }),
    status: sanitizeStatus(record.status),
    bankGcash: sanitizeRequiredField(record.bankGcash),
    approvedBy: sanitizeRequiredField(record.approvedBy) || null,
    approvedDate: sanitizeOptionalDate(record.approvedDate),
    paidDate: sanitizeOptionalDate(record.paidDate),
    unpaidDays: sanitizeInteger(record.unpaidDays),
    dailyRate: sanitizeMoney(record.dailyRate),
    deduction: sanitizeMoney(record.deduction),
    notes: sanitizeOptionalNotes(record.notes),
  };
}

function flattenBulkValidationErrors(
  issues: BulkValidationIssue[]
): Record<string, string> {
  return issues.reduce<Record<string, string>>((acc, issue) => {
    const combined = Object.entries(issue.errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join('; ');
    acc[`record_${issue.index}`] = combined;
    return acc;
  }, {});
}

function mergeSyncedPayrolls<TRecord extends PayrollRouteRecord>(
  original: TRecord[],
  synced: TRecord[]
): TRecord[] {
  if (!synced.length) {
    return original;
  }

  const syncedMap = new Map(synced.map((payroll) => [payroll.id, payroll]));
  return original.map((payroll) => syncedMap.get(payroll.id) ?? payroll);
}

function sortPayrolls<TRecord extends PayrollRouteRecord>(
  payrolls: TRecord[]
): TRecord[] {
  return [...payrolls].sort((a, b) => {
    const dateCompare = (b.periodStart || '').localeCompare(
      a.periodStart || ''
    );
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return (a.employeeName || '').localeCompare(b.employeeName || '');
  });
}

function mapPayrollToInput(payroll: PayrollRouteRecord): PayrollInput {
  return {
    employeeId: payroll.employeeId,
    employeeName: payroll.employeeName,
    payPeriod: payroll.payPeriod,
    periodStart: payroll.periodStart,
    periodEnd: payroll.periodEnd,
    basicSalary: payroll.basicSalary,
    allowance: payroll.allowance,
    overtime: payroll.overtime,
    bonuses: payroll.bonuses,
    thirteenthMonth: payroll.thirteenthMonth,
    grossPay: payroll.grossPay,
    sss: payroll.sss,
    philHealth: payroll.philHealth,
    pagIbig: payroll.pagIbig,
    tax: payroll.tax,
    loans: payroll.loans,
    cashAdvance: payroll.cashAdvance,
    lwop: payroll.lwop,
    absentsLates: payroll.absentsLates,
    totalDeductions: payroll.totalDeductions,
    netPay: payroll.netPay,
    status: sanitizeStatus(payroll.status),
    bankGcash: payroll.bankGcash,
    approvedBy: payroll.approvedBy,
    approvedDate: payroll.approvedDate,
    paidDate: payroll.paidDate,
    unpaidDays: payroll.unpaidDays,
    dailyRate: payroll.dailyRate,
    deduction: payroll.deduction,
    notes: payroll.notes,
  };
}

function setPayrollField<K extends keyof PayrollInput>(
  target: Partial<PayrollInput>,
  key: K,
  value: PayrollInput[K]
) {
  target[key] = value;
}

function extractUpdatedFields(
  updatedRecord: PayrollInput,
  original: PayrollInput
): Partial<PayrollInput> {
  const diff: Partial<PayrollInput> = {};
  (Object.keys(updatedRecord) as Array<keyof PayrollInput>).forEach((key) => {
    if (updatedRecord[key] !== original[key]) {
      setPayrollField(diff, key, updatedRecord[key]);
    }
  });
  return diff;
}

function buildPayrollUpdatePayload(
  body: Record<string, unknown>,
  existing: PayrollRouteRecord
): BuildPayrollUpdateResult {
  const sanitizedInput: Partial<PayrollInput> = {};

  if (body.employeeId !== undefined) {
    sanitizedInput.employeeId = sanitizeRequiredField(body.employeeId);
  }
  if (body.employeeName !== undefined || body.employee !== undefined) {
    sanitizedInput.employeeName = sanitizeRequiredField(
      body.employeeName ?? body.employee
    );
  }
  if (body.payPeriod !== undefined) {
    sanitizedInput.payPeriod = sanitizeRequiredField(body.payPeriod);
  }
  if (body.periodStart !== undefined) {
    sanitizedInput.periodStart = sanitizers.date(body.periodStart) || '';
  }
  if (body.periodEnd !== undefined) {
    sanitizedInput.periodEnd = sanitizers.date(body.periodEnd) || '';
  }

  for (const field of MONEY_FIELDS) {
    if (body[field] !== undefined) {
      sanitizedInput[field] = sanitizeMoney(body[field]);
    }
  }

  if (body.netPay !== undefined) {
    sanitizedInput.netPay = sanitizeMoney(body.netPay, { allowNegative: true });
  }
  if (body.status !== undefined) {
    sanitizedInput.status = sanitizeStatus(body.status);
  }
  if (body.bankGcash !== undefined) {
    sanitizedInput.bankGcash = sanitizeRequiredField(body.bankGcash);
  }
  if (body.approvedBy !== undefined) {
    sanitizedInput.approvedBy = sanitizeRequiredField(body.approvedBy) || null;
  }
  if (body.approvedDate !== undefined) {
    sanitizedInput.approvedDate = sanitizeOptionalDate(body.approvedDate);
  }
  if (body.paidDate !== undefined) {
    sanitizedInput.paidDate = sanitizeOptionalDate(body.paidDate);
  }
  if (body.unpaidDays !== undefined) {
    sanitizedInput.unpaidDays = sanitizeInteger(body.unpaidDays);
  }
  if (body.notes !== undefined) {
    sanitizedInput.notes = sanitizeOptionalNotes(body.notes);
  }

  const mergedRecord: PayrollInput = {
    ...mapPayrollToInput(existing),
    ...sanitizedInput,
  };

  const validation = validatePayroll(mergedRecord);
  if (!validation.success) {
    return {
      success: false,
      errors: formatValidationErrors(validation.error),
    };
  }

  return { success: true, payload: validation.data };
}

function handlePrismaError(error: unknown, logPrefix?: string) {
  const prefix = logPrefix ? `${logPrefix} ` : '';
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    logger.error(`${prefix}Unexpected payroll Prisma error`, { error });
    return ApiResponse.error('Failed to process payroll request');
  }

  if (error.code === 'P2002') {
    const target = ((error.meta?.target as string[]) || []).join(', ');
    const field = target.split(', ')[0] || undefined;
    return ApiResponse.conflict(
      'Duplicate payroll record',
      target ? `A record with ${target} already exists` : undefined,
      field
    );
  }
  if (error.code === 'P2003') {
    return ApiResponse.conflict(
      'Referenced employee not found',
      'Ensure the employee ID exists before creating payroll'
    );
  }
  if (error.code === 'P2025') {
    return ApiResponse.notFound('Payroll record');
  }

  logger.error(`${prefix}Unhandled Prisma payroll error`, {
    code: error.code,
    error,
  });
  return ApiResponse.error('Failed to process payroll request');
}

function getProcessedBy(
  request: NextRequest,
  body: Record<string, unknown>
): string | undefined {
  const headerNames = [
    'x-user-name',
    'x-ms-client-principal-name',
    'x-client-principal-name',
    'x-forwarded-user',
    'x-forwarded-email',
  ];

  const processedByFromHeaders = headerNames
    .map((name) => request.headers.get(name))
    .map((value) => sanitizers.name(value))
    .find((value) => Boolean(value?.trim()))
    ?.trim();

  return (
    sanitizers
      .name(
        body.processedBy ??
          body.processedByName ??
          body.updatedBy ??
          body.user ??
          body.actor
      )
      ?.trim() || processedByFromHeaders
  );
}

export function createPayrollRouteHandlers<TRecord extends PayrollRouteRecord>(
  config: PayrollRouteConfig<TRecord>
) {
  async function findMissingEmployeeIds(
    candidateIds: string[]
  ): Promise<string[]> {
    if (!candidateIds.length) {
      return [];
    }

    const existing = await config.employeeModel.findMany({
      where: {
        employeeId: { in: candidateIds },
        deletedAt: null,
      },
      select: { employeeId: true },
    });

    const existingIds = new Set(
      existing.map((employee) => employee.employeeId)
    );
    return candidateIds.filter((id) => !existingIds.has(id));
  }

  async function handleBulkPayload(payload: unknown[]) {
    if (payload.length > BULK_PAYROLL_LIMIT) {
      return ApiResponse.payloadTooLarge(payload.length, BULK_PAYROLL_LIMIT);
    }

    const valid: PayrollInput[] = [];
    const invalid: BulkValidationIssue[] = [];
    const employeeIds = new Set<string>();

    payload.forEach((record, index) => {
      const sanitized = sanitizePayrollRecord(record as PayrollRecord);
      const validation = validatePayroll(sanitized);

      if (validation.success) {
        valid.push(validation.data);
        employeeIds.add(validation.data.employeeId);
      } else {
        invalid.push({
          index,
          errors: formatValidationErrors(validation.error),
        });
      }
    });

    if (invalid.length) {
      return ApiResponse.error(
        'Validation failed for multiple records',
        HTTP_STATUS.BAD_REQUEST,
        `Valid: ${valid.length}, Invalid: ${invalid.length}`,
        { validationErrors: flattenBulkValidationErrors(invalid) }
      );
    }

    const missingEmployees = await findMissingEmployeeIds(
      Array.from(employeeIds)
    );
    if (missingEmployees.length) {
      return ApiResponse.conflict(
        'Referenced employees not found',
        `Missing employee IDs: ${missingEmployees.join(', ')}`
      );
    }

    const created = await config.createRecords(valid);
    logger.info('Bulk payroll import complete', { count: created.length });

    return ApiResponse.success(
      { count: created.length, records: created },
      'Payroll records imported',
      HTTP_STATUS.CREATED
    );
  }

  async function handleSinglePayload(body: unknown) {
    const sanitized = sanitizePayrollRecord(body as PayrollRecord);
    const validation = validatePayroll(sanitized);

    if (!validation.success) {
      return ApiResponse.badRequest(
        'Validation failed',
        formatValidationErrors(validation.error)
      );
    }

    const missingEmployees = await findMissingEmployeeIds([
      validation.data.employeeId,
    ]);
    if (missingEmployees.length) {
      return ApiResponse.conflict(
        'Employee not found',
        `Employee with ID ${missingEmployees[0]} does not exist`,
        'employeeId'
      );
    }

    try {
      const payroll = await config.payrollModel.create({
        data: validation.data,
      });
      return ApiResponse.success(
        payroll,
        'Payroll record created',
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      return handlePrismaError(error, config.logPrefix);
    }
  }

  const GET = withErrorHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const employeeIdParam = searchParams.get('employeeId');
    const employeeId = employeeIdParam
      ? sanitizers.name(employeeIdParam)
      : undefined;

    const payrolls = await config.payrollModel.findMany({
      where: {
        deletedAt: null,
        ...(employeeId ? { employeeId } : {}),
      },
      orderBy: [{ periodStart: 'desc' }, { employeeName: 'asc' }],
    });

    const toSync = payrolls.filter((payroll) =>
      config.shouldSync(payroll.status)
    );
    const synced = toSync.length
      ? await config.syncPayrollDeductions(toSync)
      : [];

    return ApiResponse.success(
      sortPayrolls(mergeSyncedPayrolls(payrolls, synced)),
      'Payroll records fetched'
    );
  });

  const POST = withErrorHandler(async (request: NextRequest) => {
    const body = await request.json();
    return Array.isArray(body)
      ? handleBulkPayload(body)
      : handleSinglePayload(body);
  });

  const PUT = withErrorHandler(async (request: NextRequest) => {
    const body = (await request.json()) as Record<string, unknown>;
    const idRaw = body.id ?? body.payrollId;
    const id = typeof idRaw === 'string' ? idRaw : null;

    if (!id) {
      return ApiResponse.badRequest('Payroll ID is required');
    }

    const existing = await config.payrollModel.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return ApiResponse.notFound('Payroll record');
    }

    if (Object.keys(body).length === 1 && body.id) {
      return ApiResponse.badRequest('No fields provided to update');
    }

    let updatedRecord: PayrollInput;
    try {
      const buildResult = buildPayrollUpdatePayload(body, existing);
      if (!buildResult.success) {
        return ApiResponse.badRequest('Validation failed', buildResult.errors);
      }
      updatedRecord = buildResult.payload;
    } catch (error) {
      logger.error('Failed to sanitize payroll update payload', { error });
      return ApiResponse.error('Failed to update payroll record');
    }

    const existingInput = mapPayrollToInput(existing);
    const diff = extractUpdatedFields(updatedRecord, existingInput);
    if (Object.keys(diff).length === 0) {
      return ApiResponse.success(existing, 'No changes applied');
    }

    try {
      const payroll = await config.payrollModel.update({
        where: { id },
        data: diff,
      });

      const statusChangedToPaid =
        existing.status !== 'paid' && payroll.status === 'paid';
      if (statusChangedToPaid) {
        const [syncedPayroll] = await config.syncPayrollDeductions([payroll]);
        const payrollForSync = syncedPayroll ?? payroll;

        try {
          await config.syncExpenseFromPayroll(
            payrollForSync,
            getProcessedBy(request, body)
          );
        } catch (error) {
          logger.error('Failed to sync payroll to expenses', {
            error,
            payrollId: id,
          });
        }

        return ApiResponse.success(payrollForSync, 'Payroll record updated');
      }

      return ApiResponse.success(payroll, 'Payroll record updated');
    } catch (error) {
      return handlePrismaError(error, config.logPrefix);
    }
  });

  const DELETE = withErrorHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return ApiResponse.badRequest('Payroll ID is required');
    }

    try {
      if (permanent) {
        await config.payrollModel.delete({ where: { id } });
        logger.info('Payroll permanently deleted', { id });
      } else {
        await config.payrollModel.update({
          where: { id },
          data: { deletedAt: new Date() },
        });
        logger.info('Payroll soft deleted', { id });
      }

      return ApiResponse.success({ success: true }, 'Payroll record deleted');
    } catch (error) {
      return handlePrismaError(error, config.logPrefix);
    }
  });

  return { GET, POST, PUT, DELETE };
}
