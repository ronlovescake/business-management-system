import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import type { AttendanceRecord } from '@/app/clothing/employees/attendance/types';
import type { LeaveRequest } from '@/app/clothing/employees/leave-tracker/types';
import type { CashAdvance } from '@/app/clothing/employees/cash-advance/types';
import type { Schedule } from '@/app/clothing/employees/schedules/types';
import type { Employee, EmployeeFormData } from '../types';

/**
 * Custom hook for employee detail page
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
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isLoadingRelated, setIsLoadingRelated] = useState(true);
  const [payrollHistory, setPayrollHistory] = useState<EmployeePayrollRecord[]>(
    []
  );
  const [totalPayrollAmount, setTotalPayrollAmount] = useState(0);
  const [attendanceHistory, setAttendanceHistory] = useState<
    AttendanceRecord[]
  >([]);
  const [scheduleHistory, setScheduleHistory] = useState<Schedule[]>([]);
  const [leaveHistory, setLeaveHistory] = useState<LeaveRequest[]>([]);
  const [salaryTimeline, setSalaryTimeline] = useState<SalaryHistoryEntry[]>(
    []
  );
  const [cashAdvanceRecords, setCashAdvanceRecords] = useState<CashAdvance[]>(
    []
  );
  const [outstandingCashAdvance, setOutstandingCashAdvance] = useState(0);

  useEffect(() => {
    // Fetch employee data from API
    const fetchEmployee = async () => {
      try {
        setIsLoading(true);

        const data = await api.get<Employee>(`/api/employees/${employeeId}`);

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

        setEmployee(transformedEmployee);
      } catch (error) {
        logger.error('Error fetching employee:', error);
        setEmployee(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmployee();
  }, [employeeId]);

  useEffect(() => {
    if (!employee?.employeeId) {
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    const normalizedEmployeeId = employee.employeeId.trim();

    const parseNumber = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const allowedAttendanceStatuses = new Set([
      'present',
      'late',
      'absent',
      'on-leave',
    ]);

    const allowedPayrollStatuses = new Set(['pending', 'approved', 'paid']);
    const allowedLeaveStatuses = new Set(['pending', 'approved', 'rejected']);
    const allowedLeaveTypes = new Set([
      'Sick Leave',
      'Vacation Leave',
      'Emergency Leave',
      'Maternity Leave',
      'Paternity Leave',
      'Bereavement Leave',
      'Other',
    ]);
    const allowedPaymentStatuses = new Set([
      'paid',
      'unpaid',
      'not-applicable',
    ]);
    const allowedCashAdvanceStatuses = new Set([
      'pending',
      'approved',
      'rejected',
      'paid',
    ]);

    const fetchRelatedRecords = async () => {
      try {
        setIsLoadingRelated(true);

        const query = encodeURIComponent(normalizedEmployeeId);
        const [
          payrollJson,
          attendanceJson,
          leaveJson,
          cashAdvanceJson,
          scheduleJson,
        ] = await Promise.all([
          api.get<Array<EmployeePayrollRecord & { employeeId?: string }>>(
            `/api/payroll?employeeId=${query}`
          ),
          api.get<AttendanceRecord[]>(`/api/attendance?employeeId=${query}`),
          api.get<LeaveRequest[]>(`/api/leave-requests?employeeId=${query}`),
          api.get<Array<CashAdvance & { employeeName?: string }>>(
            `/api/cash-advances?employeeId=${query}`
          ),
          api.get<Schedule[]>(`/api/schedules?employeeId=${query}`),
        ]);

        if (!signal.aborted) {
          const payrollData: EmployeePayrollRecord[] = Array.isArray(
            payrollJson
          )
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

          setPayrollHistory(payrollData);
          setTotalPayrollAmount(
            payrollData.reduce((sum, record) => sum + record.netPay, 0)
          );

          const salaryTimelineEntries: SalaryHistoryEntry[] = [];
          const ascendingPayroll = [...payrollData].sort((a, b) => {
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
                  record.periodStart ??
                  record.payPeriod ??
                  record.createdAt ??
                  '',
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
          setSalaryTimeline(salaryTimelineEntries);

          const attendanceData: AttendanceRecord[] = Array.isArray(
            attendanceJson
          )
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
          setAttendanceHistory(attendanceData);

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
          setLeaveHistory(leaveData);

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

          setCashAdvanceRecords(cashAdvanceData);
          setOutstandingCashAdvance(
            cashAdvanceData.reduce((sum, record) => {
              const remaining = record.remainingBalance ?? 0;
              return sum + (remaining > 0 ? remaining : 0);
            }, 0)
          );

          const allowedScheduleStatuses = new Set([
            'scheduled',
            'completed',
            'cancelled',
          ]);
          const allowedShiftTypes = new Set<Schedule['shiftType']>([
            'morning',
            'afternoon',
            'night',
            'full-day',
          ]);

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
          setScheduleHistory(scheduleData);
        }
      } catch (error) {
        if (!signal.aborted) {
          logger.error(
            'Error fetching related employee records for detail view:',
            error
          );
        }
      } finally {
        if (!signal.aborted) {
          setIsLoadingRelated(false);
        }
      }
    };

    fetchRelatedRecords();

    return () => {
      controller.abort();
    };
  }, [employee?.employeeId]);

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
    // Open the edit modal
    setIsFormOpen(true);
  };

  const handleSaveEmployee = async (formData: EmployeeFormData) => {
    if (!employee) {
      return;
    }

    try {
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
        employmentEndDate: formData.employmentEndDate || null,
        finalPayPending: !!formData.finalPayPending,
        finalPayEffectiveDate: formData.finalPayEffectiveDate || null,
        finalPayNotes: formData.finalPayNotes || null,
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
        `/api/employees/${employee.id}`,
        payload
      );

      // Update local state with transformed employee
      setEmployee({
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
      });

      // Close the form
      setIsFormOpen(false);
    } catch (error) {
      logger.error('Error updating employee:', error);
      alert('Failed to update employee. Please try again.');
    }
  };

  const handleProfilePhotoUpload = async (base64Photo: string) => {
    if (!employee) {
      return;
    }

    try {
      setIsPhotoUploading(true);

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
        `/api/employees/${employee.id}`,
        payload
      );

      setEmployee({
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
      });
    } catch (error) {
      logger.error('Error uploading photo:', error);
      alert('Failed to upload profile photo. Please try again.');
    } finally {
      setIsPhotoUploading(false);
    }
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
