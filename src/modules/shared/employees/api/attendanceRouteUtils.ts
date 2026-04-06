import { sanitizers } from '@/lib/security/sanitize';
import {
  formatValidationErrors,
  validateAttendance,
} from '@/lib/validations/attendance.validation';

export type AttendanceBatchValidationError = {
  index: number;
  errors: Record<string, string>;
};

export function buildAttendanceWhere(searchParams: URLSearchParams) {
  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  const employeeId = searchParams.get('employeeId');
  const status = searchParams.get('status');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (employeeId) {
    const normalizedEmployeeId = sanitizers.productCode(employeeId);
    if (normalizedEmployeeId) {
      where.employeeId = normalizedEmployeeId.toUpperCase();
    }
  }

  if (status && status !== 'all') {
    where.status = sanitizers.name(status);
  }

  if (startDate || endDate) {
    const dateFilter: Record<string, unknown> = {};

    if (startDate) {
      dateFilter.gte = sanitizers.date(startDate);
    }

    if (endDate) {
      dateFilter.lte = sanitizers.date(endDate);
    }

    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }
  }

  return where;
}

export function validateAttendanceBatch(records: unknown[]) {
  const validationErrors: AttendanceBatchValidationError[] = [];
  const validatedRecords: unknown[] = [];
  const employeeIds = new Set<string>();

  records.forEach((record, index) => {
    const validation = validateAttendance(record);
    if (!validation.success) {
      validationErrors.push({
        index,
        errors: formatValidationErrors(validation.error),
      });
      return;
    }

    validatedRecords.push(validation.data);

    if (
      validation.data &&
      typeof validation.data === 'object' &&
      'employeeId' in validation.data &&
      typeof validation.data.employeeId === 'string' &&
      validation.data.employeeId
    ) {
      employeeIds.add(validation.data.employeeId);
    }
  });

  return {
    validationErrors,
    validatedRecords,
    employeeIds,
  };
}
