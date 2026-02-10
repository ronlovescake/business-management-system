import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ThirteenthMonthPay, ThirteenthMonthPayFormData } from '../types';
import { getCurrentDateISO, formatDisplayDate } from '@/utils/date';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { queryKeys } from '@/lib/queryKeys';
import { getSwal } from '@/lib/alerts';

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

const buildPersistencePayload = (
  base: ThirteenthMonthPay,
  overrides: Partial<ThirteenthMonthPay> & {
    status?: ThirteenthMonthPay['status'];
    calculatedDate?: string | null;
    approvedDate?: string | null;
    paidDate?: string | null;
  } = {}
) => {
  const merged: ThirteenthMonthPay = {
    ...base,
    ...overrides,
  };

  const yearNumber = Number.parseInt(merged.year, 10);
  const safeYear = Number.isFinite(yearNumber)
    ? yearNumber
    : new Date().getFullYear();
  const safeMonthsWorked = Math.max(1, Math.trunc(merged.monthsWorked ?? 12));

  // Extract base employee ID from record ID (format: "employeeId-year")
  // e.g., "emp-0004-2025" -> "emp-0004"
  const extractEmployeeId = (recordId: string): string => {
    const parts = recordId.split('-');
    if (parts.length >= 2) {
      // Last part is year, remove it
      const yearPart = parts[parts.length - 1];
      if (/^\d{4}$/.test(yearPart)) {
        return parts.slice(0, -1).join('-');
      }
    }
    return recordId;
  };

  return {
    id: merged.id,
    employeeId: extractEmployeeId(merged.id),
    employeeName: merged.employee,
    year: safeYear,
    status: merged.status,
    totalBasicSalary: toNumber(merged.totalBasicSalary),
    totalLwop: toNumber(merged.totalLwop),
    totalAbsencesLates: toNumber(merged.totalAbsencesLates),
    netBasicSalary: toNumber(merged.netBasicSalary),
    monthsWorked: safeMonthsWorked,
    thirteenthMonthPay: toNumber(merged.thirteenthMonthPay),
    notes: merged.notes ?? null,
    calculatedDate: merged.calculatedDate ?? null,
    approvedDate: merged.approvedDate ?? null,
    paidDate: merged.paidDate ?? null,
  };
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

export function useThirteenthMonthPay(apiBasePath?: string) {
  const queryClient = useQueryClient();
  const resolveApiPath = useCallback(
    (path: string) => buildApiPath(apiBasePath, path),
    [apiBasePath]
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  // Filters for query key
  const filters = useMemo(
    () => ({
      year: yearFilter === 'all' ? undefined : parseInt(yearFilter, 10),
      status: statusFilter === 'all' ? undefined : statusFilter,
    }),
    [yearFilter, statusFilter]
  );

  const thirteenthQueryKey = useMemo(
    () => ({
      lists: () => [...queryKeys.thirteenthMonthPay.lists(), { apiBasePath }],
      list: (currentFilters: typeof filters) => [
        ...queryKeys.thirteenthMonthPay.list(currentFilters),
        { apiBasePath },
      ],
    }),
    [apiBasePath]
  );

  // Main query - fetches and calculates 13th month pay records
  const { data: records = [], isLoading } = useQuery({
    queryKey: thirteenthQueryKey.list(filters),
    queryFn: async () => {
      const [activeEmployees, payrollRecords, persistedRecords] =
        await Promise.all([
          api.get<Array<Record<string, unknown>>>(
            `${resolveApiPath('/employees')}?status=active`
          ),
          api.get<Array<Record<string, unknown>>>(resolveApiPath('/payroll')),
          (async () => {
            try {
              return await api.get<Array<Record<string, unknown>>>(
                resolveApiPath('/thirteenth-month-pay')
              );
            } catch (error) {
              logger.error('Failed to fetch 13th month pay records:', error);
              return [];
            }
          })(),
        ]);

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
          (rawEmployeeId ? employeeById.get(rawEmployeeId) : undefined) ??
          (rawEmployeeName ? employeeByName.get(rawEmployeeName) : undefined);

        const year = deriveYearFromPayroll(payroll);
        if (year === null) {
          return;
        }

        const normalizedEmployeeId = normalizeValue(
          (employeeRecord?.employeeId as string | undefined) ??
            (payroll.employeeId as string | undefined) ??
            null
        );
        const normalizedEmployeeName =
          rawEmployeeName ||
          normalizeValue(
            (payroll.employeeName as string | undefined) ??
              (payroll.employee as string | undefined) ??
              null
          );

        if (!normalizedEmployeeId && !normalizedEmployeeName) {
          return;
        }

        const employeeName =
          (employeeRecord?.name as string | undefined) ||
          `${employeeRecord?.firstName ?? ''} ${employeeRecord?.lastName ?? ''}`.trim() ||
          (payroll.employeeName as string | undefined) ||
          (payroll.employee as string | undefined) ||
          'Unknown Employee';

        const aggregationKey = `${
          normalizedEmployeeId || normalizedEmployeeName || 'unknown'
        }-${year}`;

        const hireDateValue =
          (employeeRecord?.hireDate as string | undefined) ??
          (employeeRecord?.dateHired as string | undefined) ??
          (employeeRecord?.hiredDate as string | undefined) ??
          (payroll.hireDate as string | undefined) ??
          (payroll.dateHired as string | undefined) ??
          (payroll.hiredDate as string | undefined) ??
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

      // Build map of persisted (approved/paid) records from database
      const persistedMap = new Map(
        persistedRecords.map((r) => {
          const safeEmployeeName =
            (r.employeeName as string | undefined) ||
            (r.employee as string | undefined) ||
            'Unknown Employee';
          const safeYear = Number.isFinite(Number(r.year))
            ? String(r.year)
            : new Date().getFullYear().toString();

          return [
            r.recordId || r.id,
            {
              id: (r.recordId || r.id) as string,
              employee: safeEmployeeName,
              year: safeYear,
              hireDate: null,
              tenureship: 'N/A',
              totalBasicSalary: toNumber(r.totalBasicSalary),
              totalLwop: toNumber(r.totalLwop),
              totalAbsencesLates: toNumber(r.totalAbsencesLates),
              netBasicSalary: toNumber(r.netBasicSalary),
              thirteenthMonthPay: toNumber(r.thirteenthMonthPay),
              monthsWorked: (r.monthsWorked as number) || 12,
              status:
                (r.status as ThirteenthMonthPay['status']) || 'calculated',
              calculatedDate: r.calculatedDate as string | undefined,
              approvedDate: r.approvedDate as string | undefined,
              paidDate: r.paidDate as string | undefined,
              notes: r.notes as string | undefined,
            } as ThirteenthMonthPay,
          ];
        })
      );

      const mergedMap = new Map<string, ThirteenthMonthPay>();

      // First, add all auto-calculated records
      autoRecords.forEach((record) => {
        mergedMap.set(record.id, record);
      });

      // Then overlay persisted records, preserving locked values
      persistedMap.forEach((persisted, persistedId) => {
        const id = String(persistedId);
        const autoRecord = mergedMap.get(id);
        const isLocked =
          persisted.status === 'approved' || persisted.status === 'paid';

        if (autoRecord && !isLocked) {
          // Status is calculated - use fresh values but keep status/dates
          mergedMap.set(id, {
            ...autoRecord,
            status: persisted.status,
            calculatedDate: persisted.calculatedDate,
            approvedDate: persisted.approvedDate,
            paidDate: persisted.paidDate,
            notes: persisted.notes,
          });
        } else if (isLocked) {
          // Status is approved/paid - lock values, but update employee info
          mergedMap.set(id, {
            ...persisted,
            hireDate: autoRecord?.hireDate ?? persisted.hireDate,
            tenureship: autoRecord?.tenureship ?? persisted.tenureship,
          });
        } else {
          // No auto record exists, use persisted
          mergedMap.set(id, persisted);
        }
      });

      const merged = Array.from(mergedMap.values());
      merged.sort((a, b) => {
        const nameCompare = a.employee.localeCompare(b.employee);
        if (nameCompare !== 0) {
          return nameCompare;
        }
        return b.year.localeCompare(a.year);
      });

      return merged;
    },
    staleTime: 30 * 1000,
  });

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

  // Edit record mutation
  const editRecordMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: ThirteenthMonthPayFormData;
    }) => {
      const record = records.find((r) => r.id === id);
      if (!record) {
        throw new Error('Record not found');
      }

      const totalBasicSalary = parseFloat(data.totalBasicSalary) || 0;
      const totalLwop = parseFloat(data.totalLwop) || 0;
      const totalAbsencesLates = parseFloat(data.totalAbsencesLates) || 0;
      const thirteenthMonthPay = Math.max(
        0,
        totalBasicSalary - totalLwop - totalAbsencesLates
      );

      const updatedRecord: ThirteenthMonthPay = {
        ...record,
        employee: data.employee,
        year: data.year,
        totalBasicSalary,
        totalLwop,
        totalAbsencesLates,
        netBasicSalary: thirteenthMonthPay,
        thirteenthMonthPay,
        notes: data.notes,
      };

      const payload = buildPersistencePayload(updatedRecord);
      await api.patch(resolveApiPath('/thirteenth-month-pay'), payload);

      return updatedRecord;
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({
        queryKey: thirteenthQueryKey.lists(),
      });

      const previous = queryClient.getQueryData<ThirteenthMonthPay[]>(
        thirteenthQueryKey.list(filters)
      );

      if (previous) {
        const totalBasicSalary = parseFloat(data.totalBasicSalary) || 0;
        const totalLwop = parseFloat(data.totalLwop) || 0;
        const totalAbsencesLates = parseFloat(data.totalAbsencesLates) || 0;
        const thirteenthMonthPay = Math.max(
          0,
          totalBasicSalary - totalLwop - totalAbsencesLates
        );

        queryClient.setQueryData<ThirteenthMonthPay[]>(
          thirteenthQueryKey.list(filters),
          previous.map((r) =>
            r.id === id
              ? {
                  ...r,
                  employee: data.employee,
                  year: data.year,
                  totalBasicSalary,
                  totalLwop,
                  totalAbsencesLates,
                  netBasicSalary: thirteenthMonthPay,
                  thirteenthMonthPay,
                  notes: data.notes,
                }
              : r
          )
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          thirteenthQueryKey.list(filters),
          context.previous
        );
      }
      logger.error('Error editing record:', error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: thirteenthQueryKey.lists(),
      });
    },
  });

  // Delete record mutation
  const deleteRecordMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(
        `${resolveApiPath('/thirteenth-month-pay')}?recordId=${encodeURIComponent(id)}`
      );
      return id;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({
        queryKey: thirteenthQueryKey.lists(),
      });

      const previous = queryClient.getQueryData<ThirteenthMonthPay[]>(
        thirteenthQueryKey.list(filters)
      );

      if (previous) {
        queryClient.setQueryData<ThirteenthMonthPay[]>(
          thirteenthQueryKey.list(filters),
          previous.filter((record) => record.id !== deletedId)
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          thirteenthQueryKey.list(filters),
          context.previous
        );
      }
      logger.error('Error deleting record:', error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: thirteenthQueryKey.lists(),
      });
    },
  });

  // Approve record mutation
  const approveRecordMutation = useMutation({
    mutationFn: async (id: string) => {
      const record = records.find((r) => r.id === id);
      if (!record) {
        throw new Error('Record not found');
      }

      const approvedDate = getCurrentDateISO();
      const payload = buildPersistencePayload(record, {
        status: 'approved',
        approvedDate,
      });

      await api.patch(resolveApiPath('/thirteenth-month-pay'), payload);

      return { id, approvedDate };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: thirteenthQueryKey.lists(),
      });

      const previous = queryClient.getQueryData<ThirteenthMonthPay[]>(
        thirteenthQueryKey.list(filters)
      );

      if (previous) {
        const approvedDate = getCurrentDateISO();
        queryClient.setQueryData<ThirteenthMonthPay[]>(
          thirteenthQueryKey.list(filters),
          previous.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'approved',
                  approvedDate,
                }
              : r
          )
        );
      }

      return { previous };
    },
    onError: async (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          thirteenthQueryKey.list(filters),
          context.previous
        );
      }
      logger.error('Error approving record:', error);
      const Swal = await getSwal();
      Swal.fire({
        title: 'Error',
        text: 'Failed to approve the record. Please try again.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        allowOutsideClick: false,
      });
    },
    onSuccess: async () => {
      const Swal = await getSwal();
      Swal.fire({
        title: 'Approved!',
        text: 'The 13th month pay has been approved and locked.',
        icon: 'success',
        confirmButtonColor: '#10b981',
        allowOutsideClick: false,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: thirteenthQueryKey.lists(),
      });
    },
  });

  // Mark as paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const record = records.find((r) => r.id === id);
      if (!record) {
        throw new Error('Record not found');
      }

      const paidDate = getCurrentDateISO();
      const payload = buildPersistencePayload(record, {
        status: 'paid',
        paidDate,
      });

      await api.patch(resolveApiPath('/thirteenth-month-pay'), payload);

      return { id, paidDate };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: thirteenthQueryKey.lists(),
      });

      const previous = queryClient.getQueryData<ThirteenthMonthPay[]>(
        thirteenthQueryKey.list(filters)
      );

      if (previous) {
        const paidDate = getCurrentDateISO();
        queryClient.setQueryData<ThirteenthMonthPay[]>(
          thirteenthQueryKey.list(filters),
          previous.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'paid',
                  paidDate,
                }
              : r
          )
        );
      }

      return { previous };
    },
    onError: async (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          thirteenthQueryKey.list(filters),
          context.previous
        );
      }
      logger.error('Error marking as paid:', error);
      const Swal = await getSwal();
      Swal.fire({
        title: 'Error',
        text: 'Failed to mark as paid. Please try again.',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        allowOutsideClick: false,
      });
    },
    onSuccess: async () => {
      const Swal = await getSwal();
      Swal.fire({
        title: 'Marked as Paid!',
        text: 'The payment has been recorded successfully.',
        icon: 'success',
        confirmButtonColor: '#6366f1',
        allowOutsideClick: false,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: thirteenthQueryKey.lists(),
      });
    },
  });

  // Wrapper functions
  const editRecord = (id: string, data: ThirteenthMonthPayFormData) => {
    editRecordMutation.mutate({ id, data });
  };

  const deleteRecord = (id: string) => {
    deleteRecordMutation.mutate(id);
  };

  const approveRecord = async (id: string) => {
    const Swal = await getSwal();
    const record = records.find((r) => r.id === id);
    if (!record) {
      return;
    }

    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Approve 13th Month Pay?',
      html: `
        <div style="text-align: left; padding: 0 10px;">
          <p style="margin-bottom: 15px;"><strong>Employee:</strong> ${record.employee}</p>
          <p style="margin-bottom: 15px;"><strong>13th Month Pay:</strong> ₱${record.thirteenthMonthPay.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 12px; margin-top: 15px;">
            <p style="margin: 0; color: #856404;">
              ⚠️ <strong>Warning:</strong> Once approved, the calculated values will be <strong>locked</strong> and will no longer auto-update based on payroll changes.
            </p>
          </div>
        </div>
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, Approve & Lock',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
      allowOutsideClick: false,
    });

    if (!result.isConfirmed) {
      return;
    }

    Swal.fire({
      title: 'Processing...',
      text: 'Approving 13th month pay record',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    approveRecordMutation.mutate(id);
  };

  const markAsPaid = async (id: string) => {
    const Swal = await getSwal();
    const record = records.find((r) => r.id === id);
    if (!record) {
      return;
    }

    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Mark as Paid?',
      html: `
        <div style="text-align: left; padding: 0 10px;">
          <p style="margin-bottom: 15px;"><strong>Employee:</strong> ${record.employee}</p>
          <p style="margin-bottom: 15px;"><strong>13th Month Pay:</strong> ₱${record.thirteenthMonthPay.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p style="margin: 0;">This will mark the record as paid and record the payment date.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Mark as Paid',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#6366f1',
      cancelButtonColor: '#6c757d',
      reverseButtons: true,
      allowOutsideClick: false,
    });

    if (!result.isConfirmed) {
      return;
    }

    Swal.fire({
      title: 'Processing...',
      text: 'Marking as paid',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    markAsPaidMutation.mutate(id);
  };

  // Utility functions
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString?: string): string =>
    dateString ? formatDisplayDate(dateString, 'MMM D, YYYY') : 'N/A';

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

  const addRecord = (_data: ThirteenthMonthPayFormData) => {
    logger.debug(
      'Add record not implemented with React Query - records are auto-calculated'
    );
  };

  const importFromCSV = (file: File) => {
    logger.debug('Importing CSV:', file.name);
    // CSV import logic would go here
  };

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
