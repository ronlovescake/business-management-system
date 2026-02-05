import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';

export interface EmployeeDirectoryEntry {
  id: string;
  employeeId: string;
  name: string;
  firstName?: string | null;
  lastName?: string | null;
  sssMonthlyContribution?: number | null;
  philHealthMonthlyContribution?: number | null;
  pagibigMonthlyContribution?: number | null;
  taxMonthlyContribution?: number | null;
}

export interface PayrollRecord {
  id: string;
  employeeId?: string | null;
  employee: string;
  payPeriod: string;
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
  status: 'pending' | 'approved' | 'paid';
  bankGcash: string;
  approvedBy?: string;
  approvedDate?: string;
  paidDate?: string;
}

export type PayrollFilters = {
  search: string;
  status: string;
  period: string;
};

type UsePayrollBaseOptions = {
  resolveApiPath: (path: string) => string;
  createPayrollQueryKey: (filters: PayrollFilters) => readonly unknown[];
};

const normalizeIdentifier = (value: string | undefined | null) =>
  (value ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();

const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  if (typeof value === 'object' && 'toString' in (value as object)) {
    const parsed = parseFloat((value as { toString(): string }).toString());
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
};

const toOptionalNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const mapEmployees = (data: unknown[]): EmployeeDirectoryEntry[] =>
  data.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      id:
        record.id !== undefined && record.id !== null ? String(record.id) : '',
      employeeId: String(record.employeeId ?? ''),
      name: String(
        record.name ?? `${record.firstName ?? ''} ${record.lastName ?? ''}`
      ),
      firstName:
        record.firstName !== undefined && record.firstName !== null
          ? String(record.firstName)
          : null,
      lastName:
        record.lastName !== undefined && record.lastName !== null
          ? String(record.lastName)
          : null,
      sssMonthlyContribution:
        toOptionalNumber(record.sssMonthlyContribution) ?? null,
      philHealthMonthlyContribution:
        toOptionalNumber(record.philHealthMonthlyContribution) ?? null,
      pagibigMonthlyContribution:
        toOptionalNumber(record.pagibigMonthlyContribution) ?? null,
      taxMonthlyContribution:
        toOptionalNumber(record.taxMonthlyContribution) ?? null,
    };
  });

const mapPayrolls = (data: Record<string, unknown>[]): PayrollRecord[] =>
  data.map((record) => {
    const basicSalary = toNumber(record.basicSalary);
    const allowance = toNumber(record.allowance);
    const overtime = toNumber(record.overtime);
    const bonuses = toNumber(record.bonuses);
    const thirteenthMonth = toNumber(record.thirteenthMonth);
    const grossPay = toNumber(record.grossPay);
    const sss = toNumber(record.sss);
    const philHealth = toNumber(record.philHealth);
    const pagIbig = toNumber(record.pagIbig);
    const tax = toNumber(record.tax);
    const loans = toNumber(record.loans);
    const cashAdvance = toNumber(record.cashAdvance);
    const lwop = toNumber(
      record.lwop !== undefined && record.lwop !== null
        ? record.lwop
        : record.deduction
    );
    const absentsLates = toNumber(record.absentsLates);

    const derivedTotalDeductions =
      sss +
      philHealth +
      pagIbig +
      tax +
      loans +
      cashAdvance +
      lwop +
      absentsLates;
    const derivedNetPay = Math.max(0, grossPay - derivedTotalDeductions);

    const totalDeductions = toNumber(record.totalDeductions);
    const netPay = toNumber(record.netPay);

    return {
      id: String(record.id ?? ''),
      employee: String(record.employeeName ?? ''),
      employeeId: record.employeeId ? String(record.employeeId) : null,
      payPeriod: String(record.payPeriod ?? ''),
      basicSalary,
      allowance,
      overtime,
      bonuses,
      grossPay,
      thirteenthMonth,
      sss,
      philHealth,
      pagIbig,
      tax,
      loans,
      cashAdvance,
      lwop,
      absentsLates,
      totalDeductions:
        totalDeductions > 0 ? totalDeductions : derivedTotalDeductions,
      netPay: netPay > 0 ? netPay : derivedNetPay,
      status: record.status as 'pending' | 'approved' | 'paid',
      bankGcash: String(record.bankGcash ?? ''),
      approvedBy: record.approvedBy as string | undefined,
      approvedDate: record.approvedDate as string | undefined,
      paidDate: record.paidDate as string | undefined,
    };
  });

export function usePayrollBase({
  resolveApiPath,
  createPayrollQueryKey,
}: UsePayrollBaseOptions) {
  const [employees, setEmployees] = useState<EmployeeDirectoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [payPeriodFilter, setPayPeriodFilter] = useState<string>('all');

  const filters = useMemo(
    () => ({
      search: searchQuery,
      status: statusFilter,
      period: payPeriodFilter,
    }),
    [searchQuery, statusFilter, payPeriodFilter]
  );

  const payrollQueryKey = useMemo(
    () => createPayrollQueryKey(filters),
    [createPayrollQueryKey, filters]
  );

  const employeeOptions = useMemo(() => {
    const names = new Set<string>();
    employees.forEach((entry) => {
      const resolvedName = (entry.name || '').trim();
      if (resolvedName) {
        names.add(resolvedName);
        return;
      }

      const fallback =
        `${entry.firstName ?? ''} ${entry.lastName ?? ''}`.trim();
      if (fallback) {
        names.add(fallback);
      }
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const resolveEmployeeRecord = useCallback(
    (identifier: string | undefined | null) => {
      const normalized = normalizeIdentifier(identifier);
      if (!normalized) {
        return undefined;
      }

      return employees.find((entry) => {
        if (entry.id && normalizeIdentifier(entry.id) === normalized) {
          return true;
        }

        if (normalizeIdentifier(entry.employeeId) === normalized) {
          return true;
        }

        if (normalizeIdentifier(entry.name) === normalized) {
          return true;
        }

        const combined = `${entry.firstName ?? ''} ${entry.lastName ?? ''}`;
        return normalizeIdentifier(combined) === normalized;
      });
    },
    [employees]
  );

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const data = await api.get<unknown[]>(resolveApiPath('/employees'));
        const directory = Array.isArray(data) ? mapEmployees(data) : [];
        setEmployees(directory);
      } catch (error) {
        logger.error('Error fetching employees for payroll directory:', error);
      }
    };

    fetchEmployees();
  }, [resolveApiPath]);

  const {
    data: payrolls = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: payrollQueryKey,
    queryFn: async () => {
      const data = await api.get<Record<string, unknown>[]>(
        resolveApiPath('/payroll')
      );

      return mapPayrolls(data);
    },
    staleTime: 30 * 1000,
  });

  if (error) {
    logger.error('Error fetching payrolls:', error);
  }

  const filteredPayrolls = useMemo(() => {
    return payrolls.filter((payroll) => {
      const matchesSearch =
        payroll.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payroll.payPeriod.toLowerCase().includes(searchQuery.toLowerCase()) ||
        payroll.bankGcash.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'all' || payroll.status === statusFilter;

      const matchesPayPeriod =
        payPeriodFilter === 'all' || payroll.payPeriod === payPeriodFilter;

      return matchesSearch && matchesStatus && matchesPayPeriod;
    });
  }, [payrolls, searchQuery, statusFilter, payPeriodFilter]);

  return {
    employees,
    employeeOptions,
    resolveEmployeeRecord,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    payPeriodFilter,
    setPayPeriodFilter,
    filters,
    payrollQueryKey,
    payrolls,
    filteredPayrolls,
    loading,
  };
}
