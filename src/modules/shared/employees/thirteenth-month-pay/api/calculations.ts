export type ThirteenthMonthPayStatus =
  | 'pending'
  | 'calculated'
  | 'approved'
  | 'paid';

export interface CalculatedThirteenthMonthPayRecord {
  id: string;
  employee: string;
  employmentStatus?: string;
  year: string;
  hireDate?: string | null;
  tenureship?: string;
  totalBasicSalary: number;
  totalLwop: number;
  totalAbsencesLates: number;
  netBasicSalary: number;
  monthsWorked?: number;
  thirteenthMonthPay: number;
  status: ThirteenthMonthPayStatus;
  calculatedDate?: string;
  approvedDate?: string;
  paidDate?: string;
  notes?: string;
}

type SourceRecord = Record<string, unknown>;

interface AggregatedThirteenthData {
  id: string;
  employeeName: string;
  employmentStatus: string;
  year: number;
  totalBasicSalary: number;
  totalLwop: number;
  totalAbsencesLates: number;
  hireDate: string | null;
  monthsWorked: Set<number>;
}

const parseDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const deriveYearFromPayroll = (payroll: SourceRecord): number | null => {
  const primary = parseDate(payroll.periodEnd as string | undefined);
  if (primary) {
    return primary.getFullYear();
  }

  const secondary = parseDate(payroll.periodStart as string | undefined);
  if (secondary) {
    return secondary.getFullYear();
  }

  const payPeriod = payroll.payPeriod as string | undefined;
  if (payPeriod) {
    const parts = payPeriod.split(' to ').map((part) => part.trim());
    const fallback = parseDate(parts[1] || parts[0]);
    if (fallback) {
      return fallback.getFullYear();
    }
  }

  return null;
};

export const deriveMonthFromPayroll = (
  payroll: SourceRecord
): number | null => {
  const primary = parseDate(payroll.periodEnd as string | undefined);
  if (primary) {
    return primary.getMonth();
  }

  const secondary = parseDate(payroll.periodStart as string | undefined);
  if (secondary) {
    return secondary.getMonth();
  }

  const payPeriod = payroll.payPeriod as string | undefined;
  if (payPeriod) {
    const parts = payPeriod.split(' to ').map((part) => part.trim());
    const fallback = parseDate(parts[1] || parts[0]);
    if (fallback) {
      return fallback.getMonth();
    }
  }

  return null;
};

export const calculateTenureshipLabel = (
  hireDateValue: string | null | undefined,
  year: number,
  referenceDate: Date = new Date()
): string => {
  if (!hireDateValue) {
    return 'N/A';
  }

  const hireDate = parseDate(hireDateValue);
  if (!hireDate) {
    return 'N/A';
  }

  const periodEnd =
    referenceDate.getFullYear() === year
      ? referenceDate
      : new Date(year, 11, 31);

  if (hireDate > periodEnd) {
    return 'Less than 1 day';
  }

  let years = periodEnd.getFullYear() - hireDate.getFullYear();
  let months = periodEnd.getMonth() - hireDate.getMonth();
  let days = periodEnd.getDate() - hireDate.getDate();

  if (days < 0) {
    const previousMonth = new Date(
      periodEnd.getFullYear(),
      periodEnd.getMonth(),
      0
    );
    days += previousMonth.getDate();
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  if (years < 0) {
    return 'Less than 1 day';
  }

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  }
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }

  if (parts.length === 0) {
    return 'Less than 1 day';
  }

  return parts.join(', ');
};

function normalizeValue(value: unknown): string {
  return (value ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const parsed = Number.parseFloat(
      (value as { toString(): string }).toString()
    );
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function calculateThirteenthMonthPayRecords(params: {
  employees: SourceRecord[];
  payrollRecords: SourceRecord[];
  persistedRecords: SourceRecord[];
}): CalculatedThirteenthMonthPayRecord[] {
  const { employees, payrollRecords, persistedRecords } = params;
  const employeeById = new Map<string, SourceRecord>();
  const employeeByName = new Map<string, SourceRecord>();

  employees.forEach((employee) => {
    const id = normalizeValue(employee.employeeId);
    const name = normalizeValue(
      employee.name || `${employee.firstName ?? ''} ${employee.lastName ?? ''}`
    );

    if (id) {
      employeeById.set(id, employee);
    }
    if (name) {
      employeeByName.set(name, employee);
    }
  });

  const aggregated = new Map<string, AggregatedThirteenthData>();

  payrollRecords.forEach((payroll) => {
    const rawEmployeeId = normalizeValue(payroll.employeeId);
    const rawEmployeeName = normalizeValue(payroll.employeeName);
    const employeeRecord =
      (rawEmployeeId ? employeeById.get(rawEmployeeId) : undefined) ??
      (rawEmployeeName ? employeeByName.get(rawEmployeeName) : undefined);
    const year = deriveYearFromPayroll(payroll);

    if (year === null) {
      return;
    }

    const normalizedEmployeeId = normalizeValue(
      employeeRecord?.employeeId ?? payroll.employeeId
    );
    const normalizedEmployeeName =
      rawEmployeeName ||
      normalizeValue(payroll.employeeName ?? payroll.employee ?? null);

    if (!normalizedEmployeeId && !normalizedEmployeeName) {
      return;
    }

    const employeeName =
      (employeeRecord?.name as string | undefined) ||
      `${employeeRecord?.firstName ?? ''} ${employeeRecord?.lastName ?? ''}`.trim() ||
      (payroll.employeeName as string | undefined) ||
      (payroll.employee as string | undefined) ||
      'Unknown Employee';
    const aggregationKey = `${normalizedEmployeeId || normalizedEmployeeName || 'unknown'}-${year}`;
    const hireDateValue =
      (employeeRecord?.hireDate as string | undefined) ??
      (employeeRecord?.dateHired as string | undefined) ??
      (employeeRecord?.hiredDate as string | undefined) ??
      (payroll.hireDate as string | undefined) ??
      (payroll.dateHired as string | undefined) ??
      (payroll.hiredDate as string | undefined) ??
      null;
    const employmentStatusValue =
      (employeeRecord?.status as string | undefined) ??
      (employeeRecord?.employmentStatus as string | undefined) ??
      'Unknown';

    if (!aggregated.has(aggregationKey)) {
      aggregated.set(aggregationKey, {
        id: aggregationKey,
        employeeName,
        employmentStatus: employmentStatusValue,
        year,
        totalBasicSalary: 0,
        totalLwop: 0,
        totalAbsencesLates: 0,
        hireDate: hireDateValue,
        monthsWorked: new Set<number>(),
      });
    }

    const aggregate = aggregated.get(aggregationKey);
    if (!aggregate) {
      return;
    }

    if (!aggregate.hireDate && hireDateValue) {
      aggregate.hireDate = hireDateValue;
    }

    aggregate.totalBasicSalary += toNumber(payroll.basicSalary);
    aggregate.totalLwop += toNumber(payroll.lwop);
    aggregate.totalAbsencesLates += toNumber(
      payroll.absentsLates ?? payroll.absencesLates
    );

    const month = deriveMonthFromPayroll(payroll);
    if (month !== null) {
      aggregate.monthsWorked.add(month);
    }
  });

  const mergedMap = new Map<string, CalculatedThirteenthMonthPayRecord>();

  Array.from(aggregated.values()).forEach((aggregate) => {
    const totalBasicSalary = aggregate.totalBasicSalary;
    const totalLwop = aggregate.totalLwop;
    const totalAbsencesLates = aggregate.totalAbsencesLates;
    const netBasicSalary = Math.max(
      0,
      totalBasicSalary - totalLwop - totalAbsencesLates
    );
    const monthsWorked = Math.max(1, Math.min(aggregate.monthsWorked.size, 12));
    const hireDate = aggregate.hireDate;

    mergedMap.set(aggregate.id, {
      id: aggregate.id,
      employee: aggregate.employeeName,
      employmentStatus: aggregate.employmentStatus,
      year: aggregate.year.toString(),
      hireDate,
      tenureship: calculateTenureshipLabel(hireDate, aggregate.year),
      totalBasicSalary,
      totalLwop,
      totalAbsencesLates,
      netBasicSalary,
      thirteenthMonthPay: netBasicSalary / 12,
      monthsWorked,
      status: 'calculated',
    });
  });

  const currentYear = new Date().getFullYear();
  persistedRecords.forEach((record) => {
    const safeEmployeeName =
      (record.employeeName as string | undefined) ||
      (record.employee as string | undefined) ||
      'Unknown Employee';
    const safeYear = Number.isFinite(Number(record.year))
      ? String(record.year)
      : currentYear.toString();
    const persistedEmployeeId = normalizeValue(record.employeeId);
    const persistedEmployeeName = normalizeValue(safeEmployeeName);
    const employeeRecord =
      (persistedEmployeeId
        ? employeeById.get(persistedEmployeeId)
        : undefined) ??
      (persistedEmployeeName
        ? employeeByName.get(persistedEmployeeName)
        : undefined);
    const persistedHireDate =
      (employeeRecord?.hireDate as string | undefined) ??
      (employeeRecord?.dateHired as string | undefined) ??
      null;
    const persistedEmploymentStatus =
      (employeeRecord?.status as string | undefined) ??
      (employeeRecord?.employmentStatus as string | undefined) ??
      'Unknown';
    const parsedYear = Number(record.year);
    const persistedYear = Number.isFinite(parsedYear)
      ? parsedYear
      : currentYear;
    const id = String(record.recordId || record.id);
    const persisted: CalculatedThirteenthMonthPayRecord = {
      id,
      employee: safeEmployeeName,
      employmentStatus: persistedEmploymentStatus,
      year: safeYear,
      hireDate: persistedHireDate,
      tenureship: calculateTenureshipLabel(persistedHireDate, persistedYear),
      totalBasicSalary: toNumber(record.totalBasicSalary),
      totalLwop: toNumber(record.totalLwop),
      totalAbsencesLates: toNumber(record.totalAbsencesLates),
      netBasicSalary: toNumber(record.netBasicSalary),
      thirteenthMonthPay: toNumber(record.thirteenthMonthPay),
      monthsWorked: (record.monthsWorked as number) || 12,
      status:
        (record.status as ThirteenthMonthPayStatus | undefined) || 'calculated',
      calculatedDate: record.calculatedDate as string | undefined,
      approvedDate: record.approvedDate as string | undefined,
      paidDate: record.paidDate as string | undefined,
      notes: record.notes as string | undefined,
    };
    const autoRecord = mergedMap.get(id);
    const isLocked =
      persisted.status === 'approved' || persisted.status === 'paid';

    if (autoRecord && !isLocked) {
      mergedMap.set(id, {
        ...autoRecord,
        status: persisted.status,
        calculatedDate: persisted.calculatedDate,
        approvedDate: persisted.approvedDate,
        paidDate: persisted.paidDate,
        notes: persisted.notes,
      });
    } else if (isLocked) {
      mergedMap.set(id, {
        ...persisted,
        hireDate: autoRecord?.hireDate ?? persisted.hireDate,
        tenureship: autoRecord?.tenureship ?? persisted.tenureship,
      });
    } else {
      mergedMap.set(id, persisted);
    }
  });

  return Array.from(mergedMap.values()).sort((a, b) => {
    const nameCompare = a.employee.localeCompare(b.employee);
    return nameCompare !== 0 ? nameCompare : b.year.localeCompare(a.year);
  });
}

export function buildThirteenthMonthPayPersistencePayload(
  base: CalculatedThirteenthMonthPayRecord,
  overrides: Omit<
    Partial<CalculatedThirteenthMonthPayRecord>,
    'calculatedDate' | 'approvedDate' | 'paidDate' | 'notes'
  > & {
    calculatedDate?: string | null;
    approvedDate?: string | null;
    paidDate?: string | null;
    notes?: string | null;
  } = {}
) {
  const merged = { ...base, ...overrides };
  const parsedYear = Number.parseInt(merged.year, 10);
  const year = Number.isFinite(parsedYear)
    ? parsedYear
    : new Date().getFullYear();
  const monthsWorked = Math.max(1, Math.trunc(merged.monthsWorked ?? 12));
  const idParts = merged.id.split('-');
  const lastPart = idParts[idParts.length - 1];
  const employeeId =
    idParts.length >= 2 && /^\d{4}$/.test(lastPart)
      ? idParts.slice(0, -1).join('-')
      : merged.id;

  return {
    id: merged.id,
    employeeId,
    employeeName: merged.employee,
    year,
    status: merged.status,
    totalBasicSalary: toNumber(merged.totalBasicSalary),
    totalLwop: toNumber(merged.totalLwop),
    totalAbsencesLates: toNumber(merged.totalAbsencesLates),
    netBasicSalary: toNumber(merged.netBasicSalary),
    monthsWorked,
    thirteenthMonthPay: toNumber(merged.thirteenthMonthPay),
    notes: merged.notes ?? null,
    calculatedDate: merged.calculatedDate ?? null,
    approvedDate: merged.approvedDate ?? null,
    paidDate: merged.paidDate ?? null,
  };
}
