import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { buildApiPath } from '@/lib/api/paths';
import type {
  LeaveRequest,
  LeaveType,
  LeaveStatus,
  PaymentStatus,
  MonthlyBreakdownItem,
} from '../types';
import {
  employeeKeys,
  leaveKeys,
  scheduleKeys,
  TIMEZONE,
} from './leaveTrackerUtils';
import { dayjs } from '@/utils/date';
import {
  buildLeaveRequestsCsv,
  parseImportedLeaveRequests,
} from './leaveTrackerCsvUtils';
import { useLeaveTrackerFormState } from './useLeaveTrackerFormState';
import { useLeaveTrackerMutations } from './useLeaveTrackerMutations';
import { useLeaveTrackerQueries } from './useLeaveTrackerQueries';

export { employeeKeys, leaveKeys, scheduleKeys };

export default function useLeaveTracker(apiBasePath?: string) {
  const resolveApiPath = useCallback(
    (path: string) => buildApiPath(apiBasePath, path),
    [apiBasePath]
  );

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState<string | null>('all');
  const [filterStatus, setFilterStatus] = useState<string | null>('all');

  const {
    isModalOpen,
    setIsModalOpen,
    editingRequest,
    activeTab,
    setActiveTab,
    formEmployeeName,
    setFormEmployeeName,
    formEmployeeId,
    setFormEmployeeId,
    formLeaveType,
    setFormLeaveType,
    formPaymentStatus,
    setFormPaymentStatus,
    formStartDate,
    setFormStartDate,
    formEndDate,
    setFormEndDate,
    formReason,
    setFormReason,
    formNotes,
    setFormNotes,
    resetFormFields,
    populateFormFromRequest,
  } = useLeaveTrackerFormState();

  // Import state
  const [isImporting, setIsImporting] = useState(false);

  const queryClient = useQueryClient();
  const {
    leaveRequests,
    employeeOptions,
    employeeScheduleIndex,
    isLoading,
    isLoadingEmployees,
    leaveRequestsQueryKey,
  } = useLeaveTrackerQueries(apiBasePath, resolveApiPath);

  const { deleteMutation, saveMutation, approveMutation, rejectMutation } =
    useLeaveTrackerMutations({
      queryClient,
      resolveApiPath,
      leaveRequestsQueryKey,
      leaveRequests,
    });

  // Constants
  const leaveTypes = useMemo<LeaveType[]>(
    () => [
      'Sick Leave',
      'Vacation Leave',
      'Emergency Leave',
      'Maternity Leave',
      'Paternity Leave',
      'Bereavement Leave',
      'Other',
    ],
    []
  );
  const paymentStatuses: PaymentStatus[] = ['paid', 'unpaid', 'not-applicable'];

  // Utility functions
  const formatDate = useCallback((date: string | Date): string => {
    return dayjs(date).tz(TIMEZONE).format('MMM DD, YYYY');
  }, []);

  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = dayjs(startDate).tz(TIMEZONE);
    const end = dayjs(endDate).tz(TIMEZONE);

    if (start.isSame(end, 'day')) {
      return start.format('MMM DD, YYYY');
    } else if (start.isSame(end, 'month')) {
      return `${start.format('MMM DD')} - ${end.format('DD, YYYY')}`;
    } else {
      return `${start.format('MMM DD')} - ${end.format('MMM DD, YYYY')}`;
    }
  };

  const getStatusColor = (status: LeaveStatus): string => {
    switch (status) {
      case 'pending':
        return 'yellow';
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getLeaveTypeColor = (leaveType: LeaveType): string => {
    switch (leaveType) {
      case 'Sick Leave':
        return 'red';
      case 'Vacation Leave':
        return 'blue';
      case 'Emergency Leave':
        return 'orange';
      case 'Maternity Leave':
        return 'pink';
      case 'Paternity Leave':
        return 'cyan';
      case 'Bereavement Leave':
        return 'gray';
      default:
        return 'grape';
    }
  };

  const getPaymentStatusColor = (paymentStatus: PaymentStatus): string => {
    switch (paymentStatus) {
      case 'paid':
        return 'green';
      case 'unpaid':
        return 'red';
      case 'not-applicable':
        return 'gray';
      default:
        return 'gray';
    }
  };

  const getCurrentDateISO = useCallback((): string => {
    return dayjs().tz(TIMEZONE).format('YYYY-MM-DD');
  }, []);

  const calculateDays = useCallback(
    (startDate: string, endDate: string, employeeId?: string): number => {
      const start = dayjs(startDate).tz(TIMEZONE).startOf('day');
      const end = dayjs(endDate).tz(TIMEZONE).startOf('day');

      if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
        return 0;
      }

      // If no employeeId provided, return calendar days
      if (!employeeId) {
        return end.diff(start, 'day') + 1;
      }

      const normalizedEmployeeId = employeeId.trim();
      const scheduleSet = employeeScheduleIndex[normalizedEmployeeId];

      // If no schedule exists, fallback to calendar days
      if (!scheduleSet || scheduleSet.size === 0) {
        return end.diff(start, 'day') + 1;
      }

      // Count only scheduled work days
      let countedDays = 0;
      const totalDays = end.diff(start, 'day') + 1;

      for (let offset = 0; offset < totalDays; offset++) {
        const currentDay = start.add(offset, 'day');
        const currentDateStr = currentDay.format('YYYY-MM-DD');

        if (scheduleSet.has(currentDateStr)) {
          countedDays += 1;
        }
      }

      return countedDays;
    },
    [employeeScheduleIndex]
  );

  const isEmployeeScheduledOnDate = useCallback(
    (employeeId: string | undefined, date: string | Date): boolean | null => {
      if (!employeeId) {
        return null;
      }

      const normalizedEmployeeId = employeeId.trim();
      const scheduleSet = employeeScheduleIndex[normalizedEmployeeId];

      if (!scheduleSet || scheduleSet.size === 0) {
        return null;
      }

      const targetDate = dayjs(date).tz(TIMEZONE).format('YYYY-MM-DD');
      return scheduleSet.has(targetDate);
    },
    [employeeScheduleIndex]
  );

  const calculateRemainingLeaveAllocation = useMemo(() => {
    return (employeeId: string): number => {
      const ANNUAL_LEAVE_ENTITLEMENT = 7; // days per year

      const usedPaidLeaveDays = leaveRequests
        .filter(
          (leave: LeaveRequest) =>
            leave.employeeId === employeeId &&
            leave.status === 'approved' &&
            leave.paymentStatus === 'paid'
        )
        .reduce(
          (total: number, leave: LeaveRequest) => total + leave.numberOfDays,
          0
        );

      return Math.max(ANNUAL_LEAVE_ENTITLEMENT - usedPaidLeaveDays, 0);
    };
  }, [leaveRequests]);

  const hasLeaveOverlap = useCallback(
    (
      employeeId: string,
      startDate: string,
      endDate: string,
      ignoreRequestId?: string,
      additionalRequests: Omit<LeaveRequest, 'id'>[] = []
    ): boolean => {
      const candidateStart = dayjs(startDate).tz(TIMEZONE).startOf('day');
      const candidateEnd = dayjs(endDate).tz(TIMEZONE).startOf('day');

      // Check against existing leave requests
      const hasOverlap = leaveRequests.some((request) => {
        if (request.employeeId !== employeeId) {
          return false;
        }
        if (request.id === ignoreRequestId) {
          return false;
        }

        const existingStart = dayjs(request.startDate)
          .tz(TIMEZONE)
          .startOf('day');
        const existingEnd = dayjs(request.endDate).tz(TIMEZONE).startOf('day');

        // Check if date ranges overlap
        return (
          !existingEnd.isBefore(candidateStart) &&
          !candidateEnd.isBefore(existingStart)
        );
      });

      // Check against additional requests (for CSV import)
      const hasOverlapWithAdditional = additionalRequests.some((request) => {
        if (request.employeeId !== employeeId) {
          return false;
        }

        const existingStart = dayjs(request.startDate)
          .tz(TIMEZONE)
          .startOf('day');
        const existingEnd = dayjs(request.endDate).tz(TIMEZONE).startOf('day');

        return (
          !existingEnd.isBefore(candidateStart) &&
          !candidateEnd.isBefore(existingStart)
        );
      });

      return hasOverlap || hasOverlapWithAdditional;
    },
    [leaveRequests]
  );

  // Computed values
  const filteredRequests = useMemo(() => {
    return leaveRequests.filter((request) => {
      const matchesSearch =
        searchQuery === '' ||
        request.employeeName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        request.employeeId.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLeaveType =
        filterLeaveType === 'all' || request.leaveType === filterLeaveType;

      const matchesStatus =
        filterStatus === 'all' || request.status === filterStatus;

      return matchesSearch && matchesLeaveType && matchesStatus;
    });
  }, [leaveRequests, searchQuery, filterLeaveType, filterStatus]);

  // Memoize stats calculations to avoid recalculating on every render
  const stats = useMemo(() => {
    const totalRequests = filteredRequests.length;
    const pendingRequests = filteredRequests.filter(
      (req) => req.status === 'pending'
    ).length;
    const approvedRequests = filteredRequests.filter(
      (req) => req.status === 'approved'
    ).length;
    const totalDaysRequested = filteredRequests.reduce(
      (sum, req) => sum + req.numberOfDays,
      0
    );

    return {
      totalRequests,
      pendingRequests,
      approvedRequests,
      totalDaysRequested,
    };
  }, [filteredRequests]);

  const {
    totalRequests,
    pendingRequests,
    approvedRequests,
    totalDaysRequested,
  } = stats;

  const monthlyBreakdown = useMemo<MonthlyBreakdownItem[]>(() => {
    // Group by leave type (rows) with month columns
    const breakdown: Record<string, MonthlyBreakdownItem> = {};

    // Initialize breakdown for each leave type
    leaveTypes.forEach((type) => {
      breakdown[type] = {
        leaveType: type,
        total: 0,
        percentage: 0,
        January: 0,
        February: 0,
        March: 0,
        April: 0,
        May: 0,
        June: 0,
        July: 0,
        August: 0,
        September: 0,
        October: 0,
        November: 0,
        December: 0,
      };
    });

    // Populate with actual data
    filteredRequests.forEach((request: LeaveRequest) => {
      const monthName = dayjs(request.startDate).format('MMMM');
      const leaveType = request.leaveType;

      if (breakdown[leaveType]) {
        const currentMonthValue =
          (breakdown[leaveType][monthName] as number) || 0;
        breakdown[leaveType][monthName] =
          currentMonthValue + request.numberOfDays;
        breakdown[leaveType].total =
          (breakdown[leaveType].total as number) + request.numberOfDays;
      }
    });

    // Calculate percentages
    const result: MonthlyBreakdownItem[] = Object.values(breakdown).filter(
      (item) => (item.total as number) > 0
    );

    result.forEach((item) => {
      item.percentage =
        totalDaysRequested > 0
          ? ((item.total as number) / totalDaysRequested) * 100
          : 0;
    });

    return result;
  }, [filteredRequests, leaveTypes, totalDaysRequested]);

  // Employee leave allocation (for form)
  const employeeLeaveAllocation = useMemo(() => {
    if (!formEmployeeId) {
      return { remaining: 0, used: 0, total: 7 };
    }

    const remaining = calculateRemainingLeaveAllocation(formEmployeeId);
    const used = 7 - remaining;

    return { remaining, used, total: 7 };
  }, [formEmployeeId, calculateRemainingLeaveAllocation]);

  // Auto-populate payment status when form changes
  useEffect(() => {
    if (formEmployeeId && formStartDate && formEndDate) {
      const remainingDays = calculateRemainingLeaveAllocation(formEmployeeId);
      const requestedDays = calculateDays(
        formStartDate,
        formEndDate,
        formEmployeeId
      );

      if (requestedDays <= remainingDays && requestedDays > 0) {
        setFormPaymentStatus('paid');
      } else if (requestedDays > remainingDays) {
        setFormPaymentStatus('unpaid');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formEmployeeId, formStartDate, formEndDate, employeeScheduleIndex]);

  const handleAddRequest = useCallback(() => {
    resetFormFields();
    const today = getCurrentDateISO();
    setFormStartDate(today);
    setFormEndDate(today);
    setIsModalOpen(true);
  }, [
    getCurrentDateISO,
    resetFormFields,
    setFormEndDate,
    setFormStartDate,
    setIsModalOpen,
  ]);

  const handleEditRequest = useCallback(
    (request: LeaveRequest) => {
      populateFormFromRequest(request);
      setIsModalOpen(true);
    },
    [populateFormFromRequest, setIsModalOpen]
  );

  const handleDeleteRequest = useCallback(
    async (id: string) => {
      if (!confirm('Are you sure you want to delete this leave request?')) {
        return;
      }
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  const handleSaveRequest = useCallback(async () => {
    // Validation
    if (
      !formEmployeeName ||
      !formEmployeeId ||
      !formLeaveType ||
      !formStartDate ||
      !formEndDate ||
      !formReason
    ) {
      alert('Please fill in all required fields');
      return;
    }

    const parsedStart = dayjs(formStartDate).tz(TIMEZONE).startOf('day');
    const parsedEnd = dayjs(formEndDate).tz(TIMEZONE).startOf('day');

    if (!parsedStart.isValid() || !parsedEnd.isValid()) {
      alert('Invalid date format');
      return;
    }

    if (parsedEnd.isBefore(parsedStart)) {
      alert('End date must be after start date');
      return;
    }

    const startISO = parsedStart.format('YYYY-MM-DD');
    const endISO = parsedEnd.format('YYYY-MM-DD');

    // Check overlap
    if (hasLeaveOverlap(formEmployeeId, startISO, endISO, editingRequest?.id)) {
      alert(
        'Leave dates overlap with an existing request for this employee. Please choose different dates.'
      );
      return;
    }

    const numberOfDays = calculateDays(startISO, endISO, formEmployeeId);

    if (numberOfDays <= 0) {
      alert(
        'The selected date range does not include any scheduled work days for this employee.'
      );
      return;
    }

    try {
      if (editingRequest) {
        // Update existing request
        await saveMutation.mutateAsync({
          ...editingRequest,
          employeeName: formEmployeeName,
          employeeId: formEmployeeId,
          leaveType: formLeaveType as LeaveType,
          paymentStatus: formPaymentStatus as PaymentStatus,
          startDate: startISO,
          endDate: endISO,
          numberOfDays,
          reason: formReason,
          notes: formNotes || undefined,
        });

        resetFormFields();
      } else {
        // Create new request(s)
        const remainingAllocation =
          calculateRemainingLeaveAllocation(formEmployeeId);
        const requestedDays = numberOfDays;

        const requestsToCreate: Omit<LeaveRequest, 'id'>[] = [];

        // Check if we need to split into PAID and UNPAID portions
        if (requestedDays > remainingAllocation && remainingAllocation > 0) {
          // SPLIT LOGIC: Find the date where paid allocation ends
          const scheduleSet = employeeScheduleIndex[formEmployeeId.trim()];

          let daysCounter = 0;
          let splitDate = '';
          let offset = 0;
          const maxIterations = 365;

          while (offset < maxIterations) {
            const currentDay = parsedStart.add(offset, 'day');
            const currentDateStr = currentDay.format('YYYY-MM-DD');

            const isScheduledDay =
              !scheduleSet ||
              scheduleSet.size === 0 ||
              scheduleSet.has(currentDateStr);

            if (isScheduledDay) {
              daysCounter += 1;

              if (daysCounter === remainingAllocation) {
                splitDate = currentDateStr;
                break;
              }
            }

            offset += 1;
          }

          if (splitDate) {
            const paidEndDate = splitDate;

            // Find next scheduled day for unpaid start
            let unpaidStartDate = '';
            let searchOffset = 1;
            const maxSearch = 365;

            while (searchOffset < maxSearch) {
              const nextDay = dayjs(splitDate)
                .tz(TIMEZONE)
                .add(searchOffset, 'day');
              const nextDateStr = nextDay.format('YYYY-MM-DD');

              const isNextScheduledDay =
                !scheduleSet ||
                scheduleSet.size === 0 ||
                scheduleSet.has(nextDateStr);

              if (isNextScheduledDay) {
                unpaidStartDate = nextDateStr;
                break;
              }

              searchOffset += 1;
            }

            if (!unpaidStartDate) {
              unpaidStartDate = dayjs(splitDate)
                .tz(TIMEZONE)
                .add(1, 'day')
                .format('YYYY-MM-DD');
            }

            // PAID portion
            requestsToCreate.push({
              employeeId: formEmployeeId,
              employeeName: formEmployeeName,
              leaveType: formLeaveType as LeaveType,
              paymentStatus: 'paid',
              startDate: startISO,
              endDate: paidEndDate,
              numberOfDays: calculateDays(
                startISO,
                paidEndDate,
                formEmployeeId
              ),
              reason: `${formReason} (Paid portion - uses leave allocation)`,
              status: 'pending' as LeaveStatus,
              appliedDate: getCurrentDateISO(),
              notes: formNotes || undefined,
            });

            // UNPAID portion
            requestsToCreate.push({
              employeeId: formEmployeeId,
              employeeName: formEmployeeName,
              leaveType: formLeaveType as LeaveType,
              paymentStatus: 'unpaid',
              startDate: unpaidStartDate,
              endDate: endISO,
              numberOfDays: calculateDays(
                unpaidStartDate,
                endISO,
                formEmployeeId
              ),
              reason: `${formReason} (Unpaid portion - exceeds allocation)`,
              status: 'pending' as LeaveStatus,
              appliedDate: getCurrentDateISO(),
              notes: formNotes || undefined,
            });
          }
        } else {
          // Single request
          requestsToCreate.push({
            employeeId: formEmployeeId,
            employeeName: formEmployeeName,
            leaveType: formLeaveType as LeaveType,
            paymentStatus: formPaymentStatus as PaymentStatus,
            startDate: startISO,
            endDate: endISO,
            numberOfDays,
            reason: formReason,
            status: 'pending' as LeaveStatus,
            appliedDate: getCurrentDateISO(),
            notes: formNotes || undefined,
          });
        }

        // Save to API
        await saveMutation.mutateAsync(
          requestsToCreate.length === 1 ? requestsToCreate[0] : requestsToCreate
        );

        // Show success message
        if (requestsToCreate.length > 1) {
          alert(
            `Leave request created successfully!\n\n` +
              `Your request has been split into:\n` +
              `• ${requestsToCreate[0].numberOfDays} paid days (${formatDate(requestsToCreate[0].startDate)} - ${formatDate(requestsToCreate[0].endDate)})\n` +
              `• ${requestsToCreate[1].numberOfDays} unpaid days (${formatDate(requestsToCreate[1].startDate)} - ${formatDate(requestsToCreate[1].endDate)})\n\n` +
              `This is because you only have ${remainingAllocation} paid leave days remaining.`
          );
        }

        resetFormFields();
      }

      setIsModalOpen(false);
    } catch (error) {
      // Error handling is in mutation onError
    }
  }, [
    formEmployeeName,
    formEmployeeId,
    formLeaveType,
    formStartDate,
    formEndDate,
    formReason,
    formPaymentStatus,
    formNotes,
    editingRequest,
    hasLeaveOverlap,
    calculateDays,
    calculateRemainingLeaveAllocation,
    employeeScheduleIndex,
    getCurrentDateISO,
    formatDate,
    resetFormFields,
    saveMutation,
    setIsModalOpen,
  ]);

  const isClearDisabled = useMemo(() => {
    return (
      !formEmployeeName &&
      !formEmployeeId &&
      !formLeaveType &&
      !formStartDate &&
      !formEndDate &&
      !formReason &&
      !formNotes
    );
  }, [
    formEmployeeName,
    formEmployeeId,
    formLeaveType,
    formStartDate,
    formEndDate,
    formReason,
    formNotes,
  ]);

  const handleClearForm = useCallback(() => {
    if (isClearDisabled) {
      return;
    }
    resetFormFields();
  }, [isClearDisabled, resetFormFields]);

  const handleApprove = useCallback(
    async (id: string) => {
      approveMutation.mutate(id);
    },
    [approveMutation]
  );

  const handleReject = useCallback(
    async (id: string) => {
      rejectMutation.mutate(id);
    },
    [rejectMutation]
  );

  const handleImportCSV = useCallback(
    (file: File | null) => {
      if (!file) {
        return;
      }

      setIsImporting(true);
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const text = e.target?.result as string;
          const result = parseImportedLeaveRequests({
            text,
            hasLeaveOverlap,
            calculateDays,
            getCurrentDateISO,
          });

          if ('error' in result) {
            alert(result.error);
            setIsImporting(false);
            return;
          }

          const { importedRequests, successCount, errors } = result;

          if (importedRequests.length > 0) {
            await saveMutation.mutateAsync(importedRequests);
            alert(`Successfully imported ${successCount} leave requests`);
          }

          if (errors.length > 0 && errors.length <= 10) {
            logger.error('Import errors:', errors);
          }
        } catch (error) {
          logger.error('CSV import error:', error);
          alert('Failed to import CSV file. Please check the file format.');
        } finally {
          setIsImporting(false);
        }
      };

      reader.onerror = () => {
        alert('Failed to read CSV file');
        setIsImporting(false);
      };

      reader.readAsText(file);
    },
    [
      hasLeaveOverlap,
      calculateDays,
      getCurrentDateISO,
      saveMutation,
      setIsImporting,
    ]
  );

  const handleExportCSV = useCallback(() => {
    if (filteredRequests.length === 0) {
      alert('No leave requests to export');
      return;
    }
    const csvContent = buildLeaveRequestsCsv(filteredRequests);

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `leave_requests_${getCurrentDateISO()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [filteredRequests, getCurrentDateISO]);

  return {
    // State
    leaveRequests,
    filteredRequests,
    searchQuery,
    setSearchQuery,
    filterLeaveType,
    setFilterLeaveType,
    filterStatus,
    setFilterStatus,
    isModalOpen,
    setIsModalOpen,
    editingRequest,
    activeTab,
    setActiveTab,
    isImporting,
    isLoading,
    employeeOptions,
    isLoadingEmployees,

    // Form state
    formEmployeeName,
    setFormEmployeeName,
    formEmployeeId,
    setFormEmployeeId,
    formLeaveType,
    setFormLeaveType,
    formPaymentStatus,
    setFormPaymentStatus,
    formStartDate,
    setFormStartDate,
    formEndDate,
    setFormEndDate,
    formReason,
    setFormReason,
    formNotes,
    setFormNotes,
    employeeLeaveAllocation,

    // Computed values
    leaveTypes,
    paymentStatuses,
    totalRequests,
    pendingRequests,
    approvedRequests,
    totalDaysRequested,
    monthlyBreakdown,

    // Utility functions
    formatDate,
    formatDateRange,
    getStatusColor,
    getLeaveTypeColor,
    getPaymentStatusColor,
    calculateDays,
    isEmployeeScheduledOnDate,

    // Event handlers
    handleAddRequest,
    handleEditRequest,
    handleDeleteRequest,
    handleSaveRequest,
    handleClearForm,
    handleApprove,
    handleReject,
    handleImportCSV,
    handleExportCSV,

    // Form helpers
    isClearDisabled,
  };
}
