import type { NextRequest } from 'next/server';
import type { Payroll } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { ApiResponse } from '@/core/api';
import { withErrorHandler } from '@/core/api/middleware';
import { BATCH_LIMITS, HTTP_STATUS } from '@/shared/constants/api';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { syncPayrollDeductions } from '@/lib/payroll/deductions';
import { sanitizers } from '@/lib/security/sanitize';
import {
  formatValidationErrors,
  validatePayroll,
  type PayrollInput,
} from '@/lib/validations/payroll.validation';
import { expenseService } from '@/modules/clothing/ledger/api';

const BULK_PAYROLL_LIMIT = BATCH_LIMITS.MAX_BATCH_SIZE;

type PayrollRecord = Record<string, unknown>;
type BulkValidationIssue = { index: number; errors: Record<string, string> };
type BuildPayrollUpdateResult =
  | { success: true; payload: PayrollInput }
  | { success: false; errors: Record<string, string> };

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
  // netPay handled separately to allow negative numbers
] as const satisfies NumericPayrollField[];

const ALLOWED_STATUSES: PayrollInput['status'][] = [
  'pending',
  'approved',
  'paid',
];

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

  const sanitizedRecord: PayrollInput = {
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

  return sanitizedRecord;
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

async function findMissingEmployeeIds(
  candidateIds: string[]
): Promise<string[]> {
  if (!candidateIds.length) {
    return [];
  }

  const existing = await prisma.employee.findMany({
    where: {
      employeeId: { in: candidateIds },
      deletedAt: null,
    },
    select: { employeeId: true },
  });

  const existingIds = new Set(existing.map((employee) => employee.employeeId));
  return candidateIds.filter((id) => !existingIds.has(id));
}

async function createPayrollRecords(records: PayrollInput[]) {
  return prisma.$transaction(async (tx) => {
    const created: Payroll[] = [];

    for (const record of records) {
      const payroll = await tx.payroll.create({ data: record });
      created.push(payroll);
    }

    return created;
  });
}

function shouldSync(status: string): boolean {
  return status === 'pending';
}

function mergeSyncedPayrolls(
  original: Payroll[],
  synced: Payroll[]
): Payroll[] {
  if (!synced.length) {
    return original;
  }

  const syncedMap = new Map(synced.map((payroll) => [payroll.id, payroll]));
  return original.map((payroll) => syncedMap.get(payroll.id) ?? payroll);
}

function sortPayrolls(payrolls: Payroll[]): Payroll[] {
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

async function syncExpenseFromPayroll(
  payroll: Payroll,
  processedBy?: string | null
): Promise<void> {
  const paidDate = payroll.paidDate || new Date().toISOString().split('T')[0];
  const parsedDate = new Date(paidDate);
  const expenseDate = Number.isNaN(parsedDate.getTime())
    ? new Date()
    : parsedDate;

  const netPay = Number(payroll.netPay ?? 0);
  const amount = Number.isFinite(netPay) ? Math.max(0, netPay) : 0;

  const descriptionParts = [
    'Payroll',
    payroll.employeeName || payroll.employeeId || 'Employee',
  ];
  const description = descriptionParts.filter(Boolean).join(' - ');

  const notesParts = [
    payroll.payPeriod ? `Pay period: ${payroll.payPeriod}` : null,
    payroll.periodStart && payroll.periodEnd
      ? `Period dates: ${payroll.periodStart} to ${payroll.periodEnd}`
      : null,
  ].filter(Boolean);

  // Prefer the processor; if absent, explicitly clear to avoid showing payee
  const loggedBy = processedBy?.trim() ? processedBy.trim() : null;

  await expenseService.upsertBySource({
    date: expenseDate,
    amount,
    description,
    category: 'Payroll',
    notes: notesParts.join(' | ') || undefined,
    receipt: null,
    status: 'paid',
    employeeName: loggedBy,
    sourceType: 'PAYROLL',
    sourceId: payroll.id,
    sourceLineKey:
      payroll.payPeriod || payroll.periodEnd || payroll.periodStart || null,
    systemGenerated: true,
  });
}

function mapPayrollToInput(payroll: Payroll): PayrollInput {
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

function buildPayrollUpdatePayload(
  body: Record<string, unknown>,
  existing: Payroll
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

function handlePrismaError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    logger.error('Unexpected payroll Prisma error', { error });
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

  logger.error('Unhandled Prisma payroll error', { code: error.code, error });
  return ApiResponse.error('Failed to process payroll request');
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

  const created = await createPayrollRecords(valid);
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
    const payroll = await prisma.payroll.create({ data: validation.data });
    return ApiResponse.success(
      payroll,
      'Payroll record created',
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    return handlePrismaError(error);
  }
}

export const GET = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const employeeIdParam = searchParams.get('employeeId');
  const employeeId = employeeIdParam
    ? sanitizers.name(employeeIdParam)
    : undefined;

  const payrolls = await prisma.payroll.findMany({
    where: {
      deletedAt: null,
      ...(employeeId ? { employeeId } : {}),
    },
    orderBy: [{ periodStart: 'desc' }, { employeeName: 'asc' }],
  });

  const toSync = payrolls.filter((payroll) => shouldSync(payroll.status));
  const synced = toSync.length ? await syncPayrollDeductions(toSync) : [];

  const merged = mergeSyncedPayrolls(payrolls, synced);
  const sorted = sortPayrolls(merged);
  return ApiResponse.success(sorted, 'Payroll records fetched');
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const body = await request.json();
  return Array.isArray(body)
    ? handleBulkPayload(body)
    : handleSinglePayload(body);
});

export const PUT = withErrorHandler(async (request: NextRequest) => {
  const body = (await request.json()) as Record<string, unknown>;
  const idRaw = body.id ?? body.payrollId;
  const id = typeof idRaw === 'string' ? idRaw : null;

  if (!id) {
    return ApiResponse.badRequest('Payroll ID is required');
  }

  const existing = await prisma.payroll.findUnique({ where: { id } });
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
    const payroll = await prisma.payroll.update({
      where: { id },
      data: diff,
    });

    const statusChangedToPaid =
      existing.status !== 'paid' && payroll.status === 'paid';

    // Resolve the processor from payload or common forwarded user headers
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

    const processedBy =
      sanitizers
        .name(
          (body as Record<string, unknown>).processedBy ??
            (body as Record<string, unknown>).processedByName ??
            (body as Record<string, unknown>).updatedBy ??
            (body as Record<string, unknown>).user ??
            (body as Record<string, unknown>).actor
        )
        ?.trim() || processedByFromHeaders;

    if (statusChangedToPaid) {
      const [syncedPayroll] = await syncPayrollDeductions([payroll]);
      const payrollForSync = syncedPayroll ?? payroll;

      logger.info('Syncing payroll to expenses', {
        payrollId: payrollForSync.id,
        processedBy,
        fallbackEmployeeName: payrollForSync.employeeName,
      });

      try {
        await syncExpenseFromPayroll(payrollForSync, processedBy);
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
    return handlePrismaError(error);
  }
});

export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const permanent = searchParams.get('permanent') === 'true';

  if (!id) {
    return ApiResponse.badRequest('Payroll ID is required');
  }

  try {
    if (permanent) {
      await prisma.payroll.delete({ where: { id } });
      logger.info('Payroll permanently deleted', { id });
    } else {
      await prisma.payroll.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
      logger.info('Payroll soft deleted', { id });
    }

    return ApiResponse.success({ success: true }, 'Payroll record deleted');
  } catch (error) {
    return handlePrismaError(error);
  }
});
