import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { getApiDataOrThrow } from '@/lib/api/response';
import { queryKeys } from '@/lib/queryKeys';
import { buildApiPath } from '@/lib/api/paths';
import type { AttendanceRecord } from '@/app/trucking/employees/attendance/types';
import type { LeaveRequest } from '@/app/trucking/employees/leave-tracker/types';
import type { CashAdvance } from '@/app/trucking/employees/cash-advance/types';
import type { Schedule } from '@/app/trucking/employees/schedules/types';
import {
  EMPLOYEE_STATUS_COLORS,
  type Employee,
  type EmployeeFormData,
} from '../types';
import type { ApiResponse } from '@/types/api';
import {
  extractSuffixFromName,
  parseNumberOrZero,
  parseOptionalNumericInput,
  toOptionalNumber,
} from '@/app/clothing/employees/team/hooks/employeeDetailUtils';

/**
 * Custom hook for employee detail page - React Query version
 */
export interface EmployeePayrollRecord {
  id: string;
  payPeriod: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  status: 'pending' | 'approved' | 'paid';
  grossPay: number;
  netPay: number;
  totalDeductions: number;
  cashAdvance: number;
  basicSalary: number;
  allowance: number;
  createdAt?: string;
}

interface SalaryHistoryEntry {
  id: string;
  effectiveFrom: string;
  payPeriodLabel: string;
  basicSalary: number;
  allowance: number;
  grossPay: number;
}

export interface EmployeeThirteenthMonthRecord {
  id: string;
  recordId: string;
  employeeId?: string;
  employee: string;
  year: number;
  status: 'pending' | 'calculated' | 'approved' | 'paid';
  totalBasicSalary: number;
  totalLwop: number;
  totalAbsencesLates: number;
  netBasicSalary: number;
  thirteenthMonthPay: number;
  monthsWorked: number;
  calculatedDate?: string;
  approvedDate?: string;
  paidDate?: string;
  notes?: string;
}

export function useEmployeeDetail(employeeId: string, apiBasePath?: string) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);

  const resolveApiPath = useCallback(
    (path: string) => buildApiPath(apiBasePath, path),
    [apiBasePath]
  );

  const showApiError = (error: unknown, fallback: string) => {
    const status =
      (error as { status?: number })?.status ??
      (error as { response?: { status?: number } })?.response?.status;
    const data =
      (error as { data?: unknown })?.data ??
      (error as { response?: { data?: unknown } })?.response?.data ??
      {};
    const details = (data as { details?: string })?.details;
    const field = (data as { field?: string })?.field;

    if (status === 409) {
      showNotification({
        title: 'Duplicate entry',
        message:
          details ||
          (field
            ? `Another employee already uses this ${field}.`
            : 'Another employee already uses these details.'),
        color: 'red',
      });
      return;
    }

    showNotification({
      title: 'Update failed',
      message: details || fallback,
      color: 'red',
    });
  };

  const employeeDetailQueryKey = useMemo(
    () => [...queryKeys.employees.detail(employeeId), apiBasePath ?? 'default'],
    [employeeId, apiBasePath]
  );

  const { data: employee = null, isLoading } = useQuery({
    queryKey: employeeDetailQueryKey,
    queryFn: async () => {
      const data = await api.get<Employee>(
        resolveApiPath(`/employees/${employeeId}`)
      );

      const transformedEmployee: Employee = {
        ...data,
        id: data.id.toString(),
        suffix: extractSuffixFromName(data.name),
        sssMonthlyContribution:
          toOptionalNumber(data.sssMonthlyContribution) ?? undefined,
        philHealthMonthlyContribution:
          toOptionalNumber(data.philHealthMonthlyContribution) ?? undefined,
        pagibigMonthlyContribution:
          toOptionalNumber(data.pagibigMonthlyContribution) ?? undefined,
        taxMonthlyContribution:
          toOptionalNumber(data.taxMonthlyContribution) ?? undefined,
      };

      return transformedEmployee;
    },
    staleTime: 30 * 1000,
  });

  const normalizedEmployeeId = employee?.employeeId?.trim() || '';
  const normalizedEmployeeKey = normalizedEmployeeId.toLowerCase();

  const allowedAttendanceStatuses = useMemo(
    () => new Set(['present', 'late', 'absent', 'on-leave']),
    []
  );
  const allowedPayrollStatuses = useMemo(
    () => new Set(['pending', 'approved', 'paid']),
    []
  );
  const allowedLeaveStatuses = useMemo(
    () => new Set(['pending', 'approved', 'rejected']),
    []
  );
  const allowedLeaveTypes = useMemo(
    () =>
      new Set([
        'Sick Leave',
        'Vacation Leave',
        'Emergency Leave',
        'Maternity Leave',
        'Paternity Leave',
        'Bereavement Leave',
        'Other',
      ]),
    []
  );
  const allowedPaymentStatuses = useMemo(
    () => new Set(['paid', 'unpaid', 'not-applicable']),
    []
  );
  const allowedCashAdvanceStatuses = useMemo(
    () => new Set(['pending', 'approved', 'rejected', 'paid']),
    []
  );
  const allowedScheduleStatuses = useMemo(
    () => new Set(['scheduled', 'completed', 'cancelled']),
    []
  );
  const allowedShiftTypes = useMemo(
    () =>
      new Set<Schedule['shiftType']>([
        'morning',
        'afternoon',
        'night',
        'full-day',
      ]),
    []
  );
  const allowedThirteenthStatuses = useMemo(
    () =>
      new Set<EmployeeThirteenthMonthRecord['status']>([
        'pending',
        'calculated',
        'approved',
        'paid',
      ]),
    []
  );

  const payrollHistoryQueryKey = useMemo(
    () => [
      ...queryKeys.payroll.byEmployee(normalizedEmployeeId),
      apiBasePath ?? 'default',
    ],
    [normalizedEmployeeId, apiBasePath]
  );

  const { data: payrollHistory = [], isLoading: isLoadingPayroll } = useQuery({
    queryKey: payrollHistoryQueryKey,
    queryFn: async () => {
      const query = encodeURIComponent(normalizedEmployeeId);
      const payrollJson = await api.get<
        Array<EmployeePayrollRecord & { employeeId?: string }>
      >(resolveApiPath(`/payroll?employeeId=${query}`));

      const payrollData: EmployeePayrollRecord[] = Array.isArray(payrollJson)
        ? payrollJson
            .filter((record) =>
              record && typeof record === 'object'
                ? String(record.employeeId || '').trim() ===
                  normalizedEmployeeId
                : false
            )
            .map((record) => {
              const status = allowedPayrollStatuses.has(record.status)
                ? (record.status as 'pending' | 'approved' | 'paid')
                : 'pending';
              return {
                id: String(record.id ?? ''),
                payPeriod: String(record.payPeriod ?? ''),
                periodStart: record.periodStart ?? null,
                periodEnd: record.periodEnd ?? null,
                status,
                grossPay: parseNumberOrZero(record.grossPay),
                netPay: parseNumberOrZero(record.netPay),
                totalDeductions: parseNumberOrZero(record.totalDeductions),
                cashAdvance: parseNumberOrZero(record.cashAdvance),
                basicSalary: parseNumberOrZero(record.basicSalary),
                allowance: parseNumberOrZero(record.allowance),
                createdAt: record.createdAt ?? undefined,
              } satisfies EmployeePayrollRecord;
            })
        : [];

      payrollData.sort((a, b) => {
        const aDate = a.periodStart ?? '';
        const bDate = b.periodStart ?? '';
        return bDate.localeCompare(aDate);
      });

      return payrollData;
    },
    enabled: !!normalizedEmployeeKey,
    staleTime: 30 * 1000,
  });

  const attendanceQueryKey = useMemo(
    () => [
      ...queryKeys.attendance.byEmployee(normalizedEmployeeId),
      apiBasePath ?? 'default',
    ],
    [normalizedEmployeeId, apiBasePath]
  );

  const { data: attendanceHistory = [], isLoading: isLoadingAttendance } =
    useQuery({
      queryKey: attendanceQueryKey,
      queryFn: async () => {
        const query = encodeURIComponent(normalizedEmployeeId);
        const attendanceJson = await api.get<AttendanceRecord[]>(
          resolveApiPath(`/attendance?employeeId=${query}`)
        );

        const attendanceData: AttendanceRecord[] = Array.isArray(attendanceJson)
          ? attendanceJson
              .filter((record) =>
                record && typeof record === 'object'
                  ? String(record.employeeId || '').trim() ===
                    normalizedEmployeeId
                  : false
              )
              .map((record) => {
                const status = allowedAttendanceStatuses.has(record.status)
                  ? (record.status as AttendanceRecord['status'])
                  : 'present';
                return {
                  id: String(record.id ?? ''),
                  employeeId: String(record.employeeId ?? ''),
                  employeeName: String(record.employeeName ?? ''),
                  department: String(record.department ?? ''),
                  position: String(record.position ?? ''),
                  date: String(record.date ?? ''),
                  timeIn: String(record.timeIn ?? ''),
                  timeOut: String(record.timeOut ?? ''),
                  break1Start: record.break1Start ?? undefined,
                  break1End: record.break1End ?? undefined,
                  lunchStart: record.lunchStart ?? undefined,
                  lunchEnd: record.lunchEnd ?? undefined,
                  break2Start: record.break2Start ?? undefined,
                  break2End: record.break2End ?? undefined,
                  totalHours: parseNumberOrZero(record.totalHours),
                  status,
                  details: record.details ?? undefined,
                  notes: record.notes ?? undefined,
                } satisfies AttendanceRecord;
              })
          : [];

        attendanceData.sort((a, b) => b.date.localeCompare(a.date));
        return attendanceData;
      },
      enabled: !!normalizedEmployeeKey,
      staleTime: 30 * 1000,
    });

  const leaveRequestsQueryKey = useMemo(
    () => [
      ...queryKeys.leaveRequests.list({ employeeId: normalizedEmployeeId }),
      apiBasePath ?? 'default',
    ],
    [normalizedEmployeeId, apiBasePath]
  );

  const { data: leaveHistory = [], isLoading: isLoadingLeaves } = useQuery({
    queryKey: leaveRequestsQueryKey,
    queryFn: async () => {
      const query = encodeURIComponent(normalizedEmployeeId);
      const leaveJson = await api.get<LeaveRequest[]>(
        resolveApiPath(`/leave-requests?employeeId=${query}`)
      );

      const leaveData: LeaveRequest[] = Array.isArray(leaveJson)
        ? leaveJson
            .filter((record) =>
              record && typeof record === 'object'
                ? String(record.employeeId || '').trim() ===
                  normalizedEmployeeId
                : false
            )
            .map((record) => {
              const status = allowedLeaveStatuses.has(record.status)
                ? (record.status as LeaveRequest['status'])
                : 'pending';
              const paymentStatus = allowedPaymentStatuses.has(
                record.paymentStatus
              )
                ? (record.paymentStatus as LeaveRequest['paymentStatus'])
                : 'unpaid';
              const leaveType = allowedLeaveTypes.has(record.leaveType)
                ? (record.leaveType as LeaveRequest['leaveType'])
                : 'Other';

              return {
                id: String(record.id ?? ''),
                employeeId: String(record.employeeId ?? ''),
                employeeName: String(record.employeeName ?? ''),
                leaveType,
                startDate: String(record.startDate ?? ''),
                endDate: String(record.endDate ?? ''),
                numberOfDays: parseNumberOrZero(record.numberOfDays),
                reason: String(record.reason ?? ''),
                status,
                paymentStatus,
                appliedDate: String(record.appliedDate ?? ''),
                approvedBy: record.approvedBy ?? undefined,
                notes: record.notes ?? undefined,
              } satisfies LeaveRequest;
            })
        : [];

      leaveData.sort((a, b) => b.startDate.localeCompare(a.startDate));
      return leaveData;
    },
    enabled: !!normalizedEmployeeKey,
    staleTime: 30 * 1000,
  });

  const cashAdvancesQueryKey = useMemo(
    () => [
      ...queryKeys.cashAdvances.list({ employeeId: normalizedEmployeeId }),
      apiBasePath ?? 'default',
    ],
    [normalizedEmployeeId, apiBasePath]
  );

  const { data: cashAdvanceRecords = [], isLoading: isLoadingCashAdvances } =
    useQuery({
      queryKey: cashAdvancesQueryKey,
      queryFn: async () => {
        const query = encodeURIComponent(normalizedEmployeeId);
        const response = await api.get<
          ApiResponse<Array<CashAdvance & { employeeName?: string }>>
        >(resolveApiPath(`/cash-advances?employeeId=${query}`));
        const cashAdvanceJson = getApiDataOrThrow(
          response,
          'Failed to fetch cash advances'
        );

        if (!Array.isArray(cashAdvanceJson)) {
          throw new Error('Cash advance response was not an array');
        }

        const cashAdvanceData: CashAdvance[] = cashAdvanceJson
          .filter((record) =>
            record && typeof record === 'object'
              ? String(record.employeeId || '').trim() === normalizedEmployeeId
              : false
          )
          .map((record) => {
            const amount = parseNumberOrZero(record.amount);
            const settledAmount = parseNumberOrZero(record.settledAmount);
            const remainingBalance =
              record.remainingBalance !== undefined
                ? parseNumberOrZero(record.remainingBalance)
                : Math.max(amount - settledAmount, 0);
            const status = allowedCashAdvanceStatuses.has(record.status)
              ? (record.status as CashAdvance['status'])
              : 'pending';

            return {
              id: String(record.id ?? ''),
              employeeId: String(record.employeeId ?? ''),
              employee: String(record.employeeName ?? ''),
              amount,
              purpose: record.purpose ?? '',
              terms:
                record.termsMonths !== null && record.termsMonths !== undefined
                  ? String(record.termsMonths)
                  : '',
              termsMonths: record.termsMonths ?? null,
              requestDate: record.requestDate ?? '',
              status,
              notes: record.notes ?? undefined,
              approvedBy: record.approvedBy ?? undefined,
              approvedDate: record.approvedDate ?? undefined,
              rejectedBy: record.rejectedBy ?? undefined,
              rejectedDate: record.rejectedDate ?? undefined,
              rejectionReason: record.rejectionReason ?? undefined,
              monthlyPayment:
                record.monthlyPayment !== null &&
                record.monthlyPayment !== undefined
                  ? parseNumberOrZero(record.monthlyPayment)
                  : undefined,
              remainingBalance,
              settledAmount,
              createdAt: record.createdAt ?? undefined,
              updatedAt: record.updatedAt ?? undefined,
              deductionCycle: record.deductionCycle ?? undefined,
              nextDeductionDate: record.nextDeductionDate ?? undefined,
              lastDeductedDate: record.lastDeductedDate ?? undefined,
            } satisfies CashAdvance;
          });

        return cashAdvanceData;
      },
      enabled: !!normalizedEmployeeKey,
      staleTime: 30 * 1000,
    });

  const schedulesQueryKey = useMemo(
    () => [
      ...queryKeys.schedules.byEmployee(normalizedEmployeeId),
      apiBasePath ?? 'default',
    ],
    [normalizedEmployeeId, apiBasePath]
  );

  const { data: scheduleHistory = [], isLoading: isLoadingSchedules } =
    useQuery({
      queryKey: schedulesQueryKey,
      queryFn: async () => {
        const query = encodeURIComponent(normalizedEmployeeId);
        const scheduleJson = await api.get<Schedule[]>(
          resolveApiPath(`/schedules?employeeId=${query}`)
        );

        const scheduleData: Schedule[] = Array.isArray(scheduleJson)
          ? scheduleJson
              .filter((record) =>
                record && typeof record === 'object'
                  ? String(record.employeeId || '').trim() ===
                    normalizedEmployeeId
                  : false
              )
              .map((record) => {
                const status = allowedScheduleStatuses.has(record.status)
                  ? (record.status as Schedule['status'])
                  : 'scheduled';
                const shiftType = allowedShiftTypes.has(record.shiftType)
                  ? record.shiftType
                  : 'morning';
                return {
                  id: String(record.id ?? ''),
                  employeeId: String(record.employeeId ?? ''),
                  employeeName: String(record.employeeName ?? ''),
                  date: String(record.date ?? ''),
                  shiftType,
                  startTime: String(record.startTime ?? ''),
                  endTime: String(record.endTime ?? ''),
                  position: String(record.position ?? ''),
                  department: String(record.department ?? ''),
                  status,
                  notes: record.notes ?? undefined,
                  source: record.source ?? undefined,
                  templateId: record.templateId ?? undefined,
                  recurrenceId: record.recurrenceId ?? undefined,
                  isOverride: record.isOverride ?? undefined,
                } satisfies Schedule;
              })
          : [];

        scheduleData.sort((a, b) => b.date.localeCompare(a.date));
        return scheduleData;
      },
      enabled: !!normalizedEmployeeKey,
      staleTime: 30 * 1000,
    });

  const thirteenthMonthQueryKey = useMemo(
    () => [
      ...queryKeys.thirteenthMonthPay.list({
        employeeId: normalizedEmployeeKey,
      }),
      apiBasePath ?? 'default',
    ],
    [normalizedEmployeeKey, apiBasePath]
  );

  const {
    data: thirteenthMonthRecords = [],
    isLoading: isLoadingThirteenthMonth,
  } = useQuery({
    queryKey: thirteenthMonthQueryKey,
    queryFn: async () => {
      const query = encodeURIComponent(normalizedEmployeeKey);
      const response = await api.get<Array<Record<string, unknown>>>(
        resolveApiPath(`/thirteenth-month-pay?employeeId=${query}`)
      );

      if (!Array.isArray(response)) {
        return [];
      }

      const normalizeIdentifier = (value: unknown) =>
        typeof value === 'string' ? value.trim().toLowerCase() : '';

      const safeString = (value: unknown) => {
        if (typeof value !== 'string') {
          return undefined;
        }
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      };

      const filterKey = normalizedEmployeeKey;
      if (!filterKey) {
        return [];
      }

      const sanitized = response
        .filter((record) => {
          if (!record || typeof record !== 'object') {
            return false;
          }
          const recordEmployeeId = normalizeIdentifier(
            (record as { employeeId?: string }).employeeId
          );
          if (recordEmployeeId) {
            return recordEmployeeId === filterKey;
          }
          const recordIdKey = normalizeIdentifier(
            (record as { recordId?: string }).recordId
          );
          return recordIdKey.startsWith(`${filterKey}-`);
        })
        .map((record) => {
          const raw = record as Record<string, unknown>;
          const fallbackYear = Number.parseInt(
            String(raw.year ?? new Date().getFullYear()),
            10
          );
          const year = Number.isFinite(fallbackYear)
            ? fallbackYear
            : new Date().getFullYear();
          const rawStatus = String(raw.status ?? 'calculated').toLowerCase();
          const normalizedStatus =
            rawStatus as EmployeeThirteenthMonthRecord['status'];
          const status = allowedThirteenthStatuses.has(normalizedStatus)
            ? normalizedStatus
            : 'calculated';

          const monthsWorkedValue = Number(
            raw.monthsWorked ?? (status === 'paid' ? 12 : 1)
          );
          const monthsWorked = Number.isFinite(monthsWorkedValue)
            ? Math.max(1, Math.min(12, Math.trunc(monthsWorkedValue)))
            : 12;

          const recordIdRaw = safeString(raw.recordId) || safeString(raw.id);
          const recordId = recordIdRaw
            ? recordIdRaw
            : `${normalizedEmployeeKey}-${year}`;

          return {
            id: recordId,
            recordId,
            employeeId: safeString(raw.employeeId) ?? normalizedEmployeeKey,
            employee:
              safeString(raw.employeeName) ??
              safeString(raw.employee) ??
              employee?.name ??
              recordId,
            year,
            status,
            totalBasicSalary: parseNumberOrZero(raw.totalBasicSalary),
            totalLwop: parseNumberOrZero(raw.totalLwop),
            totalAbsencesLates: parseNumberOrZero(raw.totalAbsencesLates),
            netBasicSalary: parseNumberOrZero(raw.netBasicSalary),
            thirteenthMonthPay: parseNumberOrZero(raw.thirteenthMonthPay),
            monthsWorked,
            calculatedDate: safeString(raw.calculatedDate),
            approvedDate: safeString(raw.approvedDate),
            paidDate: safeString(raw.paidDate),
            notes: safeString(raw.notes),
          } satisfies EmployeeThirteenthMonthRecord;
        });

      sanitized.sort((a, b) => {
        if (a.year !== b.year) {
          return b.year - a.year;
        }
        return a.recordId.localeCompare(b.recordId);
      });

      return sanitized;
    },
    enabled: !!normalizedEmployeeKey,
    staleTime: 30 * 1000,
  });

  const isLoadingRelated =
    isLoadingPayroll ||
    isLoadingAttendance ||
    isLoadingLeaves ||
    isLoadingCashAdvances ||
    isLoadingSchedules ||
    isLoadingThirteenthMonth;

  const totalPayrollAmount = useMemo(
    () => payrollHistory.reduce((sum, record) => sum + record.netPay, 0),
    [payrollHistory]
  );

  const totalThirteenthMonthPay = useMemo(
    () =>
      thirteenthMonthRecords.reduce(
        (sum, record) => sum + record.thirteenthMonthPay,
        0
      ),
    [thirteenthMonthRecords]
  );

  const salaryTimeline = useMemo(() => {
    const salaryTimelineEntries: SalaryHistoryEntry[] = [];
    const ascendingPayroll = [...payrollHistory].sort((a, b) => {
      const aDate = a.periodStart ?? '';
      const bDate = b.periodStart ?? '';
      return aDate.localeCompare(bDate);
    });

    let lastCombination: string | null = null;
    ascendingPayroll.forEach((record) => {
      const combination = `${record.basicSalary}-${record.allowance}`;
      if (lastCombination !== combination) {
        salaryTimelineEntries.push({
          id: record.id,
          effectiveFrom:
            record.periodStart ?? record.payPeriod ?? record.createdAt ?? '',
          payPeriodLabel:
            record.payPeriod ||
            [record.periodStart, record.periodEnd]
              .filter(Boolean)
              .join(' - ') ||
            'N/A',
          basicSalary: record.basicSalary,
          allowance: record.allowance,
          grossPay: record.grossPay,
        });
        lastCombination = combination;
      }
    });

    return salaryTimelineEntries;
  }, [payrollHistory]);

  const outstandingCashAdvance = useMemo(
    () =>
      cashAdvanceRecords.reduce((sum, record) => {
        const remaining = record.remainingBalance ?? 0;
        return sum + (remaining > 0 ? remaining : 0);
      }, 0),
    [cashAdvanceRecords]
  );

  const updateEmployeeMutation = useMutation({
    mutationFn: async (formData: EmployeeFormData) => {
      if (!employee) {
        throw new Error('No employee to update');
      }

      const payload = {
        employeeId: formData.employeeId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || null,
        name:
          formData.name ||
          `${formData.firstName} ${formData.middleName || ''} ${formData.lastName}${formData.suffix ? ` ${formData.suffix}` : ''}`
            .replace(/\s+/g, ' ')
            .trim(),
        phone: formData.phone,
        contact: formData.contact || formData.phone,
        email: formData.email || null,
        department: formData.department,
        position: formData.position,
        jobTitle: formData.jobTitle || formData.position,
        status: formData.status,
        employmentStatus: formData.employmentStatus || null,
        employeeType: formData.employeeType || null,
        office: formData.office || null,
        hiringSource: formData.hiringSource || null,
        hireDate: formData.hireDate,
        employmentEndDate: formData.employmentEndDate || null,
        finalPayPending: !!formData.finalPayPending,
        finalPayEffectiveDate: formData.finalPayEffectiveDate || null,
        finalPayNotes: formData.finalPayNotes || null,
        basicSalary: parseFloat(formData.basicSalary) || 0,
        currentSalary: formData.currentSalary
          ? parseFloat(formData.currentSalary)
          : parseFloat(formData.basicSalary) || 0,
        allowance: parseOptionalNumericInput(formData.allowance),
        paymentSchedule: formData.paymentSchedule || null,
        sssMonthlyContribution: parseOptionalNumericInput(
          formData.sssMonthlyContribution
        ),
        philHealthMonthlyContribution: parseOptionalNumericInput(
          formData.philHealthMonthlyContribution
        ),
        pagibigMonthlyContribution: parseOptionalNumericInput(
          formData.pagibigMonthlyContribution
        ),
        taxMonthlyContribution: parseOptionalNumericInput(
          formData.taxMonthlyContribution
        ),
        sssNumber: formData.sssNumber || null,
        philHealthNumber: formData.philHealthNumber || null,
        hdmfNumber: formData.hdmfNumber || null,
        tinNumber: formData.tinNumber || null,
        gender: formData.gender || null,
        education: formData.education || null,
        dateOfBirth: formData.dateOfBirth || null,
        maritalStatus: formData.maritalStatus || null,
        numberOfKids: formData.numberOfKids
          ? parseInt(formData.numberOfKids)
          : null,
        drivingLicense: formData.drivingLicense || null,
        address: formData.address || null,
        emergencyContactPerson: formData.emergencyContactPerson || null,
        emergencyContactNumber: formData.emergencyContactNumber || null,
        emergencyContact:
          formData.emergencyContact || formData.emergencyContactNumber || null,
        bankAccount: formData.bankAccount || null,
        gcashAccount: formData.gcashAccount || null,
        profilePhoto:
          formData.profilePhoto && formData.profilePhoto.trim().length > 0
            ? formData.profilePhoto
            : employee.profilePhoto || null,
      };

      const updatedEmployee = await api.put<Employee>(
        resolveApiPath(`/employees/${employee.id}`),
        payload
      );

      return {
        ...updatedEmployee,
        id: updatedEmployee.id.toString(),
        sssMonthlyContribution:
          updatedEmployee.sssMonthlyContribution ??
          payload.sssMonthlyContribution ??
          employee.sssMonthlyContribution ??
          null,
        philHealthMonthlyContribution:
          updatedEmployee.philHealthMonthlyContribution ??
          payload.philHealthMonthlyContribution ??
          employee.philHealthMonthlyContribution ??
          null,
        pagibigMonthlyContribution:
          updatedEmployee.pagibigMonthlyContribution ??
          payload.pagibigMonthlyContribution ??
          employee.pagibigMonthlyContribution ??
          null,
        taxMonthlyContribution:
          updatedEmployee.taxMonthlyContribution ??
          payload.taxMonthlyContribution ??
          employee.taxMonthlyContribution ??
          null,
      };
    },
    onMutate: async (formData) => {
      await queryClient.cancelQueries({ queryKey: employeeDetailQueryKey });

      const previous = queryClient.getQueryData<Employee>(
        employeeDetailQueryKey
      );

      if (previous) {
        const suffix = formData.suffix || extractSuffixFromName(previous.name);
        const fullName =
          formData.name ||
          `${formData.firstName} ${formData.middleName || ''} ${formData.lastName}${suffix ? ` ${suffix}` : ''}`
            .replace(/\s+/g, ' ')
            .trim();

        const optimisticUpdate: Employee = {
          ...previous,
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName || undefined,
          suffix: suffix || undefined,
          name: fullName,
          email: formData.email || undefined,
          phone: formData.phone,
          contact: formData.contact || formData.phone,
          department: formData.department,
          position: formData.position,
          jobTitle: formData.jobTitle || formData.position,
          status: formData.status,
          hireDate: formData.hireDate,
          employmentEndDate: formData.employmentEndDate || undefined,
          basicSalary: parseFloat(formData.basicSalary) || 0,
          currentSalary: formData.currentSalary
            ? parseFloat(formData.currentSalary)
            : parseFloat(formData.basicSalary) || 0,
          finalPayPending: !!formData.finalPayPending,
          finalPayEffectiveDate: formData.finalPayEffectiveDate || undefined,
          finalPayNotes: formData.finalPayNotes || undefined,
        };

        queryClient.setQueryData<Employee>(
          employeeDetailQueryKey,
          optimisticUpdate
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(employeeDetailQueryKey, context.previous);
      }
      logger.error('Error updating employee:', error);
      showApiError(error, 'Failed to update employee. Please try again.');
    },
    onSuccess: () => {
      setIsFormOpen(false);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: employeeDetailQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: async (base64Photo: string) => {
      if (!employee) {
        throw new Error('No employee to update');
      }

      const payload = {
        employeeId: employee.employeeId,
        firstName: employee.firstName,
        lastName: employee.lastName,
        middleName: employee.middleName || null,
        name: employee.name,
        phone: employee.phone,
        contact: employee.contact,
        email: employee.email || null,
        department: employee.department,
        position: employee.position,
        jobTitle: employee.jobTitle,
        status: employee.status,
        employmentStatus: employee.employmentStatus || null,
        employeeType: employee.employeeType || null,
        office: employee.office || null,
        hiringSource: employee.hiringSource || null,
        hireDate: employee.hireDate,
        employmentEndDate: employee.employmentEndDate || null,
        basicSalary: employee.basicSalary,
        currentSalary:
          employee.currentSalary !== undefined &&
          employee.currentSalary !== null
            ? employee.currentSalary
            : employee.basicSalary,
        allowance: employee.allowance ?? null,
        paymentSchedule: employee.paymentSchedule || null,
        finalPayPending: employee.finalPayPending ?? false,
        finalPayEffectiveDate: employee.finalPayEffectiveDate || null,
        finalPayNotes: employee.finalPayNotes || null,
        sssNumber: employee.sssNumber || null,
        philHealthNumber: employee.philHealthNumber || null,
        hdmfNumber: employee.hdmfNumber || null,
        tinNumber: employee.tinNumber || null,
        gender: employee.gender || null,
        education: employee.education || null,
        dateOfBirth: employee.dateOfBirth || null,
        maritalStatus: employee.maritalStatus || null,
        numberOfKids: employee.numberOfKids ?? null,
        drivingLicense: employee.drivingLicense || null,
        address: employee.address || null,
        emergencyContactPerson: employee.emergencyContactPerson || null,
        emergencyContactNumber: employee.emergencyContactNumber || null,
        emergencyContact: employee.emergencyContact || null,
        bankAccount: employee.bankAccount || null,
        gcashAccount: employee.gcashAccount || null,
        sssMonthlyContribution: employee.sssMonthlyContribution ?? null,
        philHealthMonthlyContribution:
          employee.philHealthMonthlyContribution ?? null,
        pagibigMonthlyContribution: employee.pagibigMonthlyContribution ?? null,
        taxMonthlyContribution: employee.taxMonthlyContribution ?? null,
        profilePhoto: base64Photo,
      };

      const updatedEmployee = await api.put<Employee>(
        resolveApiPath(`/employees/${employee.id}`),
        payload
      );

      return {
        ...updatedEmployee,
        id: updatedEmployee.id.toString(),
        sssMonthlyContribution:
          updatedEmployee.sssMonthlyContribution ??
          employee.sssMonthlyContribution ??
          null,
        philHealthMonthlyContribution:
          updatedEmployee.philHealthMonthlyContribution ??
          employee.philHealthMonthlyContribution ??
          null,
        pagibigMonthlyContribution:
          updatedEmployee.pagibigMonthlyContribution ??
          employee.pagibigMonthlyContribution ??
          null,
        taxMonthlyContribution:
          updatedEmployee.taxMonthlyContribution ??
          employee.taxMonthlyContribution ??
          null,
      };
    },
    onMutate: async (base64Photo) => {
      setIsPhotoUploading(true);

      await queryClient.cancelQueries({ queryKey: employeeDetailQueryKey });

      const previous = queryClient.getQueryData<Employee>(
        employeeDetailQueryKey
      );

      if (previous) {
        queryClient.setQueryData<Employee>(employeeDetailQueryKey, {
          ...previous,
          profilePhoto: base64Photo,
        });
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(employeeDetailQueryKey, context.previous);
      }
      logger.error('Error uploading photo:', error);
      showApiError(error, 'Failed to upload profile photo. Please try again.');
    },
    onSettled: () => {
      setIsPhotoUploading(false);
      queryClient.invalidateQueries({ queryKey: employeeDetailQueryKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() });
    },
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getStatusColor = (status: Employee['status']) =>
    EMPLOYEE_STATUS_COLORS[status] || 'gray';

  const handleEdit = () => {
    setIsFormOpen(true);
  };

  const handleSaveEmployee = (formData: EmployeeFormData) => {
    updateEmployeeMutation.mutate(formData);
  };

  const handleProfilePhotoUpload = (base64Photo: string) => {
    uploadPhotoMutation.mutate(base64Photo);
  };

  return {
    employee,
    isLoading,
    isFormOpen,
    setIsFormOpen,
    formatDate,
    formatCurrency,
    getStatusColor,
    handleEdit,
    handleSaveEmployee,
    handleProfilePhotoUpload,
    isPhotoUploading,
    isLoadingRelated,
    payrollHistory,
    totalPayrollAmount,
    thirteenthMonthRecords,
    totalThirteenthMonthPay,
    isLoadingThirteenthMonth,
    attendanceHistory,
    scheduleHistory,
    leaveHistory,
    salaryTimeline,
    cashAdvanceRecords,
    outstandingCashAdvance,
  };
}
