import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { queryKeys } from '@/lib/queryKeys';
import type { AttendanceRecord } from '@/app/trucking/employees/attendance/types';
import type { LeaveRequest } from '@/app/trucking/employees/leave-tracker/types';
import type { CashAdvance } from '@/app/trucking/employees/cash-advance/types';
import type { Schedule } from '@/app/trucking/employees/schedules/types';
import type { Employee, EmployeeFormData } from '../types';

/**
 * Custom hook for employee detail page - React Query version
 */
interface EmployeePayrollRecord {
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

export function useEmployeeDetail(employeeId: string) {
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);

  // Main employee query
  const { data: employee = null, isLoading } = useQuery({
    queryKey: queryKeys.employees.detail(employeeId),
    queryFn: async () => {
      const data = await api.get<Employee>(
        `/api/trucking/employees/${employeeId}`
      );

      // Transform database response to match Employee type
      const toOptionalNumber = (value: unknown) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      };

      const transformedEmployee: Employee = {
        ...data,
        id: data.id.toString(), // Convert number to string for UI
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

  // Helper functions for data transformation
  const parseNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

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

  // Parallel queries for related data (enabled only when employee data is available)
  const { data: payrollHistory = [], isLoading: isLoadingPayroll } = useQuery({
    queryKey: queryKeys.payroll.byEmployee(normalizedEmployeeId),
    queryFn: async () => {
      const query = encodeURIComponent(normalizedEmployeeId);
      const payrollJson = await api.get<
        Array<EmployeePayrollRecord & { employeeId?: string }>
      >(`/api/trucking/payroll?employeeId=${query}`);

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
                grossPay: parseNumber(record.grossPay),
                netPay: parseNumber(record.netPay),
                totalDeductions: parseNumber(record.totalDeductions),
                cashAdvance: parseNumber(record.cashAdvance),
                basicSalary: parseNumber(record.basicSalary),
                allowance: parseNumber(record.allowance),
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
    enabled: !!normalizedEmployeeId,
    staleTime: 30 * 1000,
  });

  const { data: attendanceHistory = [], isLoading: isLoadingAttendance } =
    useQuery({
      queryKey: ['attendance', 'byEmployee', normalizedEmployeeId],
      queryFn: async () => {
        const query = encodeURIComponent(normalizedEmployeeId);
        const attendanceJson = await api.get<AttendanceRecord[]>(
          `/api/trucking/attendance?employeeId=${query}`
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
                  totalHours: parseNumber(record.totalHours),
                  status,
                  details: record.details ?? undefined,
                  notes: record.notes ?? undefined,
                } satisfies AttendanceRecord;
              })
          : [];

        attendanceData.sort((a, b) => b.date.localeCompare(a.date));
        return attendanceData;
      },
      enabled: !!normalizedEmployeeId,
      staleTime: 30 * 1000,
    });

  const { data: leaveHistory = [], isLoading: isLoadingLeaves } = useQuery({
    queryKey: queryKeys.leaveRequests.list({
      employeeId: normalizedEmployeeId,
    }),
    queryFn: async () => {
      const query = encodeURIComponent(normalizedEmployeeId);
      const leaveJson = await api.get<LeaveRequest[]>(
        `/api/trucking/leave-requests?employeeId=${query}`
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
                numberOfDays: parseNumber(record.numberOfDays),
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
    enabled: !!normalizedEmployeeId,
    staleTime: 30 * 1000,
  });

  const { data: cashAdvanceRecords = [], isLoading: isLoadingCashAdvances } =
    useQuery({
      queryKey: queryKeys.cashAdvances.list({
        employeeId: normalizedEmployeeId,
      }),
      queryFn: async () => {
        const query = encodeURIComponent(normalizedEmployeeId);
        const cashAdvanceJson = await api.get<
          Array<CashAdvance & { employeeName?: string }>
        >(`/api/trucking/cash-advances?employeeId=${query}`);

        const cashAdvanceData: CashAdvance[] = Array.isArray(cashAdvanceJson)
          ? cashAdvanceJson
              .filter((record) =>
                record && typeof record === 'object'
                  ? String(record.employeeId || '').trim() ===
                    normalizedEmployeeId
                  : false
              )
              .map((record) => {
                const amount = parseNumber(record.amount);
                const settledAmount = parseNumber(record.settledAmount);
                const remainingBalance =
                  record.remainingBalance !== undefined
                    ? parseNumber(record.remainingBalance)
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
                    record.termsMonths !== null &&
                    record.termsMonths !== undefined
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
                      ? parseNumber(record.monthlyPayment)
                      : undefined,
                  remainingBalance,
                  settledAmount,
                  createdAt: record.createdAt ?? undefined,
                  updatedAt: record.updatedAt ?? undefined,
                  deductionCycle: record.deductionCycle ?? undefined,
                  nextDeductionDate: record.nextDeductionDate ?? undefined,
                  lastDeductedDate: record.lastDeductedDate ?? undefined,
                } satisfies CashAdvance;
              })
          : [];

        return cashAdvanceData;
      },
      enabled: !!normalizedEmployeeId,
      staleTime: 30 * 1000,
    });

  const { data: scheduleHistory = [], isLoading: isLoadingSchedules } =
    useQuery({
      queryKey: queryKeys.schedules.byEmployee(normalizedEmployeeId),
      queryFn: async () => {
        const query = encodeURIComponent(normalizedEmployeeId);
        const scheduleJson = await api.get<Schedule[]>(
          `/api/trucking/schedules?employeeId=${query}`
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
      enabled: !!normalizedEmployeeId,
      staleTime: 30 * 1000,
    });

  // Computed values
  const isLoadingRelated =
    isLoadingPayroll ||
    isLoadingAttendance ||
    isLoadingLeaves ||
    isLoadingCashAdvances ||
    isLoadingSchedules;

  const totalPayrollAmount = useMemo(
    () => payrollHistory.reduce((sum, record) => sum + record.netPay, 0),
    [payrollHistory]
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

  // Update employee mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: async (formData: EmployeeFormData) => {
      if (!employee) {
        throw new Error('No employee to update');
      }

      const parseOptionalNumber = (value?: string) => {
        if (!value) {
          return null;
        }
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return null;
        }
        const parsed = Number.parseFloat(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const payload = {
        employeeId: formData.employeeId,
        // Name fields - use the actual form data
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName || null,
        name:
          formData.name ||
          `${formData.firstName} ${formData.middleName || ''} ${formData.lastName}`
            .replace(/\s+/g, ' ')
            .trim(),
        // Contact
        phone: formData.phone,
        contact: formData.contact || formData.phone,
        email: formData.email || null,
        // Employment
        department: formData.department,
        position: formData.position,
        jobTitle: formData.jobTitle || formData.position,
        status: formData.status,
        employmentStatus: formData.employmentStatus || null,
        employeeType: formData.employeeType || null,
        office: formData.office || null,
        hiringSource: formData.hiringSource || null,
        hireDate: formData.hireDate,
        // Salary
        basicSalary: parseFloat(formData.basicSalary) || 0,
        currentSalary: formData.currentSalary
          ? parseFloat(formData.currentSalary)
          : parseFloat(formData.basicSalary) || 0,
        allowance: parseOptionalNumber(formData.allowance),
        paymentSchedule: formData.paymentSchedule || null,
        sssMonthlyContribution: parseOptionalNumber(
          formData.sssMonthlyContribution
        ),
        philHealthMonthlyContribution: parseOptionalNumber(
          formData.philHealthMonthlyContribution
        ),
        pagibigMonthlyContribution: parseOptionalNumber(
          formData.pagibigMonthlyContribution
        ),
        taxMonthlyContribution: parseOptionalNumber(
          formData.taxMonthlyContribution
        ),
        // Government IDs
        sssNumber: formData.sssNumber || null,
        philHealthNumber: formData.philHealthNumber || null,
        hdmfNumber: formData.hdmfNumber || null,
        tinNumber: formData.tinNumber || null,
        // Personal Info
        gender: formData.gender || null,
        education: formData.education || null,
        dateOfBirth: formData.dateOfBirth || null,
        maritalStatus: formData.maritalStatus || null,
        numberOfKids: formData.numberOfKids
          ? parseInt(formData.numberOfKids)
          : null,
        drivingLicense: formData.drivingLicense || null,
        // Address & Emergency
        address: formData.address || null,
        emergencyContactPerson: formData.emergencyContactPerson || null,
        emergencyContactNumber: formData.emergencyContactNumber || null,
        emergencyContact:
          formData.emergencyContact || formData.emergencyContactNumber || null,
        // Financial
        bankAccount: formData.bankAccount || null,
        gcashAccount: formData.gcashAccount || null,
        profilePhoto:
          formData.profilePhoto && formData.profilePhoto.trim().length > 0
            ? formData.profilePhoto
            : employee.profilePhoto || null,
      };

      const updatedEmployee = await api.put<Employee>(
        `/api/trucking/employees/${employee.id}`,
        payload
      );

      // Return transformed employee
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
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.employees.detail(employeeId),
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<Employee>(
        queryKeys.employees.detail(employeeId)
      );

      // Optimistically update
      if (previous) {
        const optimisticUpdate: Employee = {
          ...previous,
          firstName: formData.firstName,
          lastName: formData.lastName,
          middleName: formData.middleName || undefined,
          name: formData.name || previous.name,
          email: formData.email || undefined,
          phone: formData.phone,
          contact: formData.contact || formData.phone,
          department: formData.department,
          position: formData.position,
          jobTitle: formData.jobTitle || formData.position,
          status: formData.status,
          hireDate: formData.hireDate,
          basicSalary: parseFloat(formData.basicSalary) || 0,
          currentSalary: formData.currentSalary
            ? parseFloat(formData.currentSalary)
            : parseFloat(formData.basicSalary) || 0,
        };

        queryClient.setQueryData<Employee>(
          queryKeys.employees.detail(employeeId),
          optimisticUpdate
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.employees.detail(employeeId),
          context.previous
        );
      }
      logger.error('Error updating employee:', error);
      alert('Failed to update employee. Please try again.');
    },
    onSuccess: () => {
      // Close form on success
      setIsFormOpen(false);
    },
    onSettled: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.detail(employeeId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() });
    },
  });

  // Profile photo upload mutation
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
        basicSalary: employee.basicSalary,
        currentSalary:
          employee.currentSalary !== undefined &&
          employee.currentSalary !== null
            ? employee.currentSalary
            : employee.basicSalary,
        allowance: employee.allowance ?? null,
        paymentSchedule: employee.paymentSchedule || null,
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
        `/api/trucking/employees/${employee.id}`,
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

      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.employees.detail(employeeId),
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<Employee>(
        queryKeys.employees.detail(employeeId)
      );

      // Optimistically update photo
      if (previous) {
        queryClient.setQueryData<Employee>(
          queryKeys.employees.detail(employeeId),
          {
            ...previous,
            profilePhoto: base64Photo,
          }
        );
      }

      return { previous };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.employees.detail(employeeId),
          context.previous
        );
      }
      logger.error('Error uploading photo:', error);
      alert('Failed to upload profile photo. Please try again.');
    },
    onSettled: () => {
      setIsPhotoUploading(false);
      // Invalidate and refetch
      queryClient.invalidateQueries({
        queryKey: queryKeys.employees.detail(employeeId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.employees.lists() });
    },
  });

  // Utility functions
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

  const getStatusColor = (status: Employee['status']) => {
    switch (status) {
      case 'active':
        return 'green';
      case 'inactive':
        return 'red';
      case 'on-leave':
        return 'orange';
      default:
        return 'gray';
    }
  };

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
    attendanceHistory,
    scheduleHistory,
    leaveHistory,
    salaryTimeline,
    cashAdvanceRecords,
    outstandingCashAdvance,
  };
}
