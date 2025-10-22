import { useState, useMemo, useEffect, useCallback } from 'react';
import type { ThirteenthMonthPay, ThirteenthMonthPayFormData } from '../types';
import { getCurrentDateISO, formatDisplayDate } from '@/utils/date';
import { logger } from '@/lib/logger';

const normalizeValue = (value: string | null | undefined) =>
  (value ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();

const toNumber = (value: unknown): number => {
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
};

const parseDate = (value?: string | null) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const deriveYearFromPayroll = (
  payroll: Record<string, unknown>
): number | null => {
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

const deriveMonthFromPayroll = (
  payroll: Record<string, unknown>
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

const calculateTenureshipLabel = (
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

interface AggregatedThirteenthData {
  id: string;
  employeeName: string;
  year: number;
  totalBasicSalary: number;
  totalLwop: number;
  totalAbsencesLates: number;
  hireDate: string | null;
  monthsWorked: Set<number>;
}

export function useThirteenthMonthPay() {
  const [records, setRecords] = useState<ThirteenthMonthPay[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  const loadAutomaticRecords = useCallback(async () => {
    try {
      setIsLoading(true);

      const [activeEmployeesResponse, payrollResponse] = await Promise.all([
        fetch('/api/employees?status=active'),
        fetch('/api/payroll'),
      ]);

      if (!activeEmployeesResponse.ok) {
        throw new Error('Failed to fetch active employees');
      }

      if (!payrollResponse.ok) {
        throw new Error('Failed to fetch payroll records');
      }

      const activeEmployees: Array<Record<string, unknown>> =
        await activeEmployeesResponse.json();
      const payrollRecords: Array<Record<string, unknown>> =
        await payrollResponse.json();

      const employeeById = new Map<string, Record<string, unknown>>();
      const employeeByName = new Map<string, Record<string, unknown>>();

      activeEmployees.forEach((employee) => {
        const id = normalizeValue(employee.employeeId as string | undefined);
        const name = normalizeValue(
          (employee.name as string | undefined) ||
            `${employee.firstName ?? ''} ${employee.lastName ?? ''}`
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
        const rawEmployeeId = normalizeValue(
          (payroll.employeeId as string | undefined) ?? null
        );
        const rawEmployeeName = normalizeValue(
          (payroll.employeeName as string | undefined) ?? null
        );

        const employeeRecord =
          (rawEmployeeId && employeeById.get(rawEmployeeId)) ||
          (rawEmployeeName && employeeByName.get(rawEmployeeName));

        if (!employeeRecord) {
          return;
        }

        const year = deriveYearFromPayroll(payroll);
        if (year === null) {
          return;
        }

        const employeeName =
          (employeeRecord.name as string | undefined) ||
          `${employeeRecord.firstName ?? ''} ${employeeRecord.lastName ?? ''}`.trim() ||
          (payroll.employeeName as string | undefined) ||
          'Unknown Employee';

        const aggregationKey = `${
          normalizeValue(employeeRecord.employeeId as string | undefined) ||
          rawEmployeeName
        }-${year}`;

        const hireDateValue =
          (employeeRecord.hireDate as string | undefined) ??
          (employeeRecord.dateHired as string | undefined) ??
          (employeeRecord.hiredDate as string | undefined) ??
          null;

        if (!aggregated.has(aggregationKey)) {
          aggregated.set(aggregationKey, {
            id: aggregationKey,
            employeeName,
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
        aggregate.totalLwop += toNumber(
          (payroll as Record<string, unknown>).lwop
        );
        const absencesValue = toNumber(
          (payroll as Record<string, unknown>).absentsLates ??
            (payroll as Record<string, unknown>).absencesLates
        );
        aggregate.totalAbsencesLates += absencesValue;

        const month = deriveMonthFromPayroll(payroll);
        if (month !== null) {
          aggregate.monthsWorked.add(month);
        }
      });

      const autoRecords: ThirteenthMonthPay[] = Array.from(
        aggregated.values()
      ).map((aggregate) => {
        const totalBasicSalary = aggregate.totalBasicSalary;
        const totalLwop = aggregate.totalLwop;
        const totalAbsencesLates = aggregate.totalAbsencesLates;
        const totalDeductions = totalLwop + totalAbsencesLates;
        const netBasicSalary = Math.max(0, totalBasicSalary - totalDeductions);
        const monthsWorkedCount = Math.max(
          1,
          Math.min(aggregate.monthsWorked.size, 12)
        );
        const hireDate = aggregate.hireDate;
        const tenureship = calculateTenureshipLabel(hireDate, aggregate.year);
        const thirteenthMonthPay = netBasicSalary / monthsWorkedCount;

        return {
          id: aggregate.id,
          employee: aggregate.employeeName,
          year: aggregate.year.toString(),
          hireDate,
          tenureship,
          totalBasicSalary,
          totalLwop,
          totalAbsencesLates,
          netBasicSalary,
          thirteenthMonthPay,
          monthsWorked: monthsWorkedCount,
          status: 'calculated',
        } satisfies ThirteenthMonthPay;
      });

      autoRecords.sort((a, b) => {
        const nameCompare = a.employee.localeCompare(b.employee);
        if (nameCompare !== 0) {
          return nameCompare;
        }
        return b.year.localeCompare(a.year);
      });

      // Preserve any manual updates by merging existing records where IDs match
      setRecords((prevRecords) => {
        if (prevRecords.length === 0) {
          return autoRecords;
        }

        const manualRecordMap = new Map(prevRecords.map((r) => [r.id, r]));

        autoRecords.forEach((record) => {
          const existing = manualRecordMap.get(record.id);
          if (!existing) {
            manualRecordMap.set(record.id, record);
            return;
          }

          const isLocked =
            existing.status === 'paid' || existing.status === 'approved';

          manualRecordMap.set(record.id, {
            ...record,
            totalBasicSalary: isLocked
              ? existing.totalBasicSalary
              : record.totalBasicSalary,
            totalLwop: isLocked ? existing.totalLwop : record.totalLwop,
            totalAbsencesLates: isLocked
              ? existing.totalAbsencesLates
              : record.totalAbsencesLates,
            netBasicSalary: isLocked
              ? existing.netBasicSalary
              : record.netBasicSalary,
            hireDate: record.hireDate ?? existing.hireDate ?? null,
            tenureship: record.tenureship ?? existing.tenureship,
            status: existing.status,
            calculatedDate: existing.calculatedDate,
            approvedDate: existing.approvedDate,
            paidDate: existing.paidDate,
            notes: existing.notes,
            thirteenthMonthPay: isLocked
              ? existing.thirteenthMonthPay
              : record.thirteenthMonthPay,
          });
        });

        const merged = Array.from(manualRecordMap.values());
        merged.sort((a, b) => {
          const nameCompare = a.employee.localeCompare(b.employee);
          if (nameCompare !== 0) {
            return nameCompare;
          }
          return b.year.localeCompare(a.year);
        });

        return merged;
      });
    } catch (error) {
      logger.error('Failed to auto-load 13th month pay records', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAutomaticRecords();
  }, [loadAutomaticRecords]);

  // Calculate 13th month pay
  const calculate13thMonthPay = (
    totalBasicSalary: number,
    totalLwop: number,
    totalAbsencesLates: number
  ): number => {
    const finalAmount = totalBasicSalary - totalLwop - totalAbsencesLates;
    return Math.max(0, finalAmount);
  };

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch =
        searchQuery === '' ||
        record.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.year.includes(searchQuery);

      const matchesStatus =
        statusFilter === 'all' || record.status === statusFilter;

      const matchesYear = yearFilter === 'all' || record.year === yearFilter;

      return matchesSearch && matchesStatus && matchesYear;
    });
  }, [records, searchQuery, statusFilter, yearFilter]);

  // Stats
  const stats = useMemo(() => {
    const total = records.length;
    const pending = records.filter((r) => r.status === 'pending').length;
    const calculated = records.filter((r) => r.status === 'calculated').length;
    const approved = records.filter((r) => r.status === 'approved').length;
    const paid = records.filter((r) => r.status === 'paid').length;
    const totalAmount = records.reduce(
      (sum, r) => sum + r.thirteenthMonthPay,
      0
    );
    const paidAmount = records
      .filter((r) => r.status === 'paid')
      .reduce((sum, r) => sum + r.thirteenthMonthPay, 0);

    return {
      total,
      pending,
      calculated,
      approved,
      paid,
      totalAmount,
      paidAmount,
    };
  }, [records]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString?: string): string =>
    dateString ? formatDisplayDate(dateString, 'MMM D, YYYY') : 'N/A';

  // Get status color
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending':
        return '#f59e0b';
      case 'calculated':
        return '#3b82f6';
      case 'approved':
        return '#10b981';
      case 'paid':
        return '#6366f1';
      default:
        return '#6b7280';
    }
  };

  // Get status label
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'calculated':
        return 'Calculated';
      case 'approved':
        return 'Approved';
      case 'paid':
        return 'Paid';
      default:
        return status;
    }
  };

  // Add record
  const addRecord = (data: ThirteenthMonthPayFormData) => {
    const totalBasicSalary = parseFloat(data.totalBasicSalary) || 0;
    const totalLwop = parseFloat(data.totalLwop) || 0;
    const totalAbsencesLates = parseFloat(data.totalAbsencesLates) || 0;
    const thirteenthMonthPay = calculate13thMonthPay(
      totalBasicSalary,
      totalLwop,
      totalAbsencesLates
    );

    const newRecord: ThirteenthMonthPay = {
      id: Date.now().toString(),
      employee: data.employee,
      year: data.year,
      totalBasicSalary,
      totalLwop,
      totalAbsencesLates,
      netBasicSalary: thirteenthMonthPay,
      monthsWorked: 12,
      thirteenthMonthPay,
      status: 'calculated',
      calculatedDate: getCurrentDateISO(),
      notes: data.notes,
      hireDate: null,
      tenureship: 'N/A',
    };

    setRecords((prev) => [newRecord, ...prev]);
  };

  // Edit record
  const editRecord = (id: string, data: ThirteenthMonthPayFormData) => {
    const totalBasicSalary = parseFloat(data.totalBasicSalary) || 0;
    const totalLwop = parseFloat(data.totalLwop) || 0;
    const totalAbsencesLates = parseFloat(data.totalAbsencesLates) || 0;
    const thirteenthMonthPay = calculate13thMonthPay(
      totalBasicSalary,
      totalLwop,
      totalAbsencesLates
    );

    setRecords((prevRecords) =>
      prevRecords.map((record) =>
        record.id === id
          ? {
              ...record,
              employee: data.employee,
              year: data.year,
              totalBasicSalary,
              totalLwop,
              totalAbsencesLates,
              netBasicSalary: thirteenthMonthPay,
              thirteenthMonthPay,
              notes: data.notes,
            }
          : record
      )
    );
  };

  // Delete record
  const deleteRecord = (id: string) => {
    setRecords((prevRecords) =>
      prevRecords.filter((record) => record.id !== id)
    );
  };

  // Approve record
  const approveRecord = (id: string) => {
    setRecords((prevRecords) =>
      prevRecords.map((record) =>
        record.id === id
          ? {
              ...record,
              status: 'approved',
              approvedDate: getCurrentDateISO(),
            }
          : record
      )
    );
  };

  // Mark as paid
  const markAsPaid = (id: string) => {
    setRecords((prevRecords) =>
      prevRecords.map((record) =>
        record.id === id
          ? {
              ...record,
              status: 'paid',
              paidDate: getCurrentDateISO(),
            }
          : record
      )
    );
  };

  // Import CSV
  const importFromCSV = (file: File) => {
    logger.debug('Importing CSV:', file.name);
    // CSV import logic would go here
  };

  // Export CSV
  const exportToCSV = () => {
    const headers = [
      'Employee',
      'Year',
      'Hire Date',
      'Tenureship',
      'Total Basic Salary',
      'Total LWOP',
      'Total Absences/Lates',
      'Net Basic Salary',
      '13th Month Pay',
      'Status',
      'Calculated Date',
      'Approved Date',
      'Paid Date',
      'Notes',
    ];

    const rows = filteredRecords.map((record) => [
      record.employee,
      record.year,
      record.hireDate || '',
      record.tenureship || '',
      record.totalBasicSalary.toString(),
      record.totalLwop.toString(),
      record.totalAbsencesLates.toString(),
      record.netBasicSalary.toFixed(2),
      record.thirteenthMonthPay.toFixed(2),
      record.status,
      record.calculatedDate || '',
      record.approvedDate || '',
      record.paidDate || '',
      record.notes || '',
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `13th-month-pay-${getCurrentDateISO()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return {
    records: filteredRecords,
    isLoading,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    yearFilter,
    setYearFilter,
    stats,
    formatCurrency,
    formatDate,
    getStatusColor,
    getStatusLabel,
    addRecord,
    editRecord,
    deleteRecord,
    approveRecord,
    markAsPaid,
    importFromCSV,
    exportToCSV,
  };
}
