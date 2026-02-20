import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import type {
  LeaveRequest,
  LeaveType,
  LeaveStatus,
  PaymentStatus,
  MonthlyBreakdownItem,
} from '../types';
import type { Schedule } from '../../schedules/types';
import {
  buildEmployeeScheduleIndex,
  employeeKeys,
  leaveKeys,
  scheduleKeys,
  TIMEZONE,
} from './leaveTrackerUtils';
import { dayjs } from '@/utils/date';
import { escapeCSV, parseCSVLine } from '@/components/expenses';

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

  // Modal and form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<string | null>('list');

  // Form fields
  const [formEmployeeName, setFormEmployeeName] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formLeaveType, setFormLeaveType] = useState<LeaveType | ''>('');
  const [formPaymentStatus, setFormPaymentStatus] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Import state
  const [isImporting, setIsImporting] = useState(false);

  // Schedule index for day counting
  const [employeeScheduleIndex, setEmployeeScheduleIndex] = useState<
    Record<string, Set<string>>
  >({});

  const queryClient = useQueryClient();

  const leaveRequestsQueryKey = useMemo(
    () => [...leaveKeys.lists(), apiBasePath],
    [apiBasePath]
  );
  const schedulesQueryKey = useMemo(
    () => [...scheduleKeys.lists(), apiBasePath],
    [apiBasePath]
  );
  const employeesQueryKey = useMemo(
    () => [...employeeKeys.lists(), apiBasePath],
    [apiBasePath]
  );

  // Fetch leave requests
  const { data: leaveRequests = [], isLoading } = useQuery({
    queryKey: leaveRequestsQueryKey,
    queryFn: async () => {
      const data = await api.get<LeaveRequest[]>(
        resolveApiPath('/leave-requests')
      );
      return data;
    },
  });

  // Fetch schedules for day counting
  const { data: schedules = [] } = useQuery({
    queryKey: schedulesQueryKey,
    queryFn: async () => {
      const data = await api.get<Schedule[]>(resolveApiPath('/schedules'));
      return data;
    },
  });

  // Fetch employees for dropdown
  const { data: employeeOptions = [], isLoading: isLoadingEmployees } =
    useQuery({
      queryKey: employeesQueryKey,
      queryFn: async () => {
        const data = await api.get<
          Array<{
            employeeId: string;
            firstName: string;
            lastName: string;
            status?: string | null;
          }>
        >(resolveApiPath('/employees'));
        return data
          .filter((emp) => {
            const normalizedStatus = (emp.status || '').toLowerCase();
            return !['terminated', 'resigned'].includes(normalizedStatus);
          })
          .map((emp) => ({
            value: emp.employeeId,
            label: `${emp.firstName} ${emp.lastName}`,
          }));
      },
    });

  // Build schedule index
  useEffect(() => {
    if (schedules.length > 0) {
      setEmployeeScheduleIndex(buildEmployeeScheduleIndex(schedules));
    }
  }, [schedules]);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${resolveApiPath('/leave-requests')}/${id}`);
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: leaveRequestsQueryKey });

      // Snapshot previous value
      const previousLeaveRequests = queryClient.getQueryData<LeaveRequest[]>(
        leaveRequestsQueryKey
      );

      // Optimistically update
      queryClient.setQueryData<LeaveRequest[]>(leaveRequestsQueryKey, (old) => {
        return old ? old.filter((req) => req.id !== id) : [];
      });

      return { previousLeaveRequests };
    },
    onError: (err, _id, context) => {
      // Rollback on error
      if (context?.previousLeaveRequests) {
        queryClient.setQueryData(
          leaveRequestsQueryKey,
          context.previousLeaveRequests
        );
      }
      logger.error('Error deleting leave request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to delete leave request: ${errorMessage}`);
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: leaveRequestsQueryKey });
    },
  });

  // Save mutation (create or update + splitting logic)
  const saveMutation = useMutation({
    mutationFn: async (
      payload:
        | Omit<LeaveRequest, 'id'>
        | Omit<LeaveRequest, 'id'>[]
        | (Omit<LeaveRequest, 'id'> & { id?: string })
    ) => {
      const response = await api.post(
        resolveApiPath('/leave-requests'),
        payload
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveRequestsQueryKey });
    },
    onError: (err) => {
      logger.error('Error saving leave request:', err);
      alert('Failed to save leave request. Please try again.');
    },
  });

  // Approve mutation (with attendance sync)
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(resolveApiPath('/leave-requests'), {
        id,
        status: 'approved',
        approvedBy: 'System Admin',
      });
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: leaveRequestsQueryKey });

      const previousLeaveRequests = queryClient.getQueryData<LeaveRequest[]>(
        leaveRequestsQueryKey
      );

      queryClient.setQueryData<LeaveRequest[]>(leaveRequestsQueryKey, (old) => {
        return old
          ? old.map((req) =>
              req.id === id
                ? {
                    ...req,
                    status: 'approved' as LeaveStatus,
                    approvedBy: 'System Admin',
                  }
                : req
            )
          : [];
      });

      return { previousLeaveRequests };
    },
    onSuccess: async (id) => {
      // Sync attendance after approval
      const targetRequest = leaveRequests.find((request) => request.id === id);

      if (
        targetRequest?.employeeId &&
        targetRequest.startDate &&
        targetRequest.endDate
      ) {
        try {
          await api.post(resolveApiPath('/attendance/apply-leave'), {
            employeeId: targetRequest.employeeId,
            employeeName: targetRequest.employeeName,
            leaveType: targetRequest.leaveType,
            startDate: targetRequest.startDate,
            endDate: targetRequest.endDate,
          });
        } catch (attendanceError) {
          logger.error(
            'Error synchronising attendance for approved leave:',
            attendanceError
          );
        }
      }
    },
    onError: (err, _id, context) => {
      if (context?.previousLeaveRequests) {
        queryClient.setQueryData(
          leaveRequestsQueryKey,
          context.previousLeaveRequests
        );
      }
      logger.error('Error approving leave request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to approve leave request: ${errorMessage}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: leaveRequestsQueryKey });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(resolveApiPath('/leave-requests'), {
        id,
        status: 'rejected',
      });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: leaveRequestsQueryKey });

      const previousLeaveRequests = queryClient.getQueryData<LeaveRequest[]>(
        leaveRequestsQueryKey
      );

      queryClient.setQueryData<LeaveRequest[]>(leaveRequestsQueryKey, (old) => {
        return old
          ? old.map((req) =>
              req.id === id
                ? { ...req, status: 'rejected' as LeaveStatus }
                : req
            )
          : [];
      });

      return { previousLeaveRequests };
    },
    onError: (err, _id, context) => {
      if (context?.previousLeaveRequests) {
        queryClient.setQueryData(
          leaveRequestsQueryKey,
          context.previousLeaveRequests
        );
      }
      logger.error('Error rejecting leave request:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to reject leave request: ${errorMessage}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: leaveRequestsQueryKey });
    },
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

  // Event handlers
  const resetFormFields = () => {
    setFormEmployeeName('');
    setFormEmployeeId('');
    setFormLeaveType('');
    setFormPaymentStatus('');
    setFormStartDate('');
    setFormEndDate('');
    setFormReason('');
    setFormNotes('');
    setEditingRequest(null);
  };

  const handleAddRequest = useCallback(() => {
    resetFormFields();
    const today = getCurrentDateISO();
    setFormStartDate(today);
    setFormEndDate(today);
    setIsModalOpen(true);
  }, [getCurrentDateISO]);

  const handleEditRequest = useCallback((request: LeaveRequest) => {
    setEditingRequest(request);
    setFormEmployeeName(request.employeeName);
    setFormEmployeeId(request.employeeId);
    setFormLeaveType(request.leaveType);
    setFormPaymentStatus(request.paymentStatus);
    setFormStartDate(request.startDate);
    setFormEndDate(request.endDate);
    setFormReason(request.reason);
    setFormNotes(request.notes || '');
    setIsModalOpen(true);
  }, []);

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
    saveMutation,
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
  }, [isClearDisabled]);

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
          const lines = text.split('\n').filter((line) => line.trim());

          if (lines.length < 2) {
            alert('CSV file is empty or invalid');
            setIsImporting(false);
            return;
          }

          const headers = parseCSVLine(lines[0]).map((h) =>
            h.toLowerCase().replace(/\s+/g, '')
          );

          const requiredColumns = [
            'employeeid',
            'employeename',
            'leavetype',
            'startdate',
            'enddate',
            'reason',
          ];
          const missingColumns = requiredColumns.filter(
            (col) => !headers.includes(col)
          );

          if (missingColumns.length > 0) {
            alert(
              `Missing required columns: ${missingColumns.join(', ')}\n\n` +
                'Required columns: employeeId, employeeName, leaveType, startDate, endDate, reason\n' +
                'Optional columns: status, appliedDate, approvedBy, notes'
            );
            setIsImporting(false);
            return;
          }

          const importedRequests: Omit<LeaveRequest, 'id'>[] = [];
          let successCount = 0;
          const errors: string[] = [];

          for (let i = 1; i < lines.length; i++) {
            try {
              const values = parseCSVLine(lines[i]);
              const row: Record<string, string> = {};

              headers.forEach((header, index) => {
                row[header] = values[index] || '';
              });

              if (
                !row.employeeid &&
                !row.employeename &&
                !row.startdate &&
                !row.enddate
              ) {
                continue;
              }

              if (
                !row.employeeid ||
                !row.employeename ||
                !row.leavetype ||
                !row.startdate ||
                !row.enddate ||
                !row.reason
              ) {
                errors.push(`Row ${i + 1}: Missing required field(s)`);
                continue;
              }

              const csvStart = dayjs(row.startdate).tz(TIMEZONE).startOf('day');
              const csvEnd = dayjs(row.enddate).tz(TIMEZONE).startOf('day');

              if (!csvStart.isValid() || !csvEnd.isValid()) {
                errors.push(`Row ${i + 1}: Invalid start or end date`);
                continue;
              }

              if (csvEnd.isBefore(csvStart)) {
                errors.push(`Row ${i + 1}: End date precedes start date`);
                continue;
              }

              const startISO = csvStart.format('YYYY-MM-DD');
              const endISO = csvEnd.format('YYYY-MM-DD');

              if (
                hasLeaveOverlap(
                  row.employeeid,
                  startISO,
                  endISO,
                  undefined,
                  importedRequests
                )
              ) {
                errors.push(
                  `Row ${i + 1}: Leave dates overlap with an existing request for employee ${row.employeeid}`
                );
                continue;
              }

              const numberOfDays = calculateDays(
                startISO,
                endISO,
                row.employeeid
              );

              const status =
                (row.status?.toLowerCase() as LeaveStatus) || 'pending';
              const validStatus: LeaveStatus = [
                'pending',
                'approved',
                'rejected',
              ].includes(status)
                ? status
                : 'pending';

              const paymentStatus = (row.paymentstatus?.toLowerCase() ||
                'unpaid') as PaymentStatus;
              const validPaymentStatus: PaymentStatus = [
                'paid',
                'unpaid',
                'not-applicable',
              ].includes(paymentStatus)
                ? paymentStatus
                : 'unpaid';

              const newRequest = {
                employeeId: row.employeeid,
                employeeName: row.employeename,
                leaveType: row.leavetype as LeaveType,
                paymentStatus: validPaymentStatus,
                startDate: startISO,
                endDate: endISO,
                numberOfDays,
                reason: row.reason,
                status: validStatus,
                appliedDate: row.applieddate || getCurrentDateISO(),
                approvedBy: row.approvedby || undefined,
                notes: row.notes || undefined,
              };

              importedRequests.push(newRequest);
              successCount++;
            } catch (error) {
              errors.push(`Row ${i + 1}: ${error}`);
            }
          }

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
    [hasLeaveOverlap, calculateDays, getCurrentDateISO, saveMutation]
  );

  const handleExportCSV = useCallback(() => {
    if (filteredRequests.length === 0) {
      alert('No leave requests to export');
      return;
    }

    const headers = [
      'Employee ID',
      'Employee Name',
      'Leave Type',
      'Start Date',
      'End Date',
      'Number of Days',
      'Reason',
      'Status',
      'Applied Date',
      'Approved By',
      'Notes',
    ];

    const rows = filteredRequests.map((request: LeaveRequest) => [
      escapeCSV(request.employeeId),
      escapeCSV(request.employeeName),
      escapeCSV(request.leaveType),
      escapeCSV(request.startDate),
      escapeCSV(request.endDate),
      escapeCSV(request.numberOfDays),
      escapeCSV(request.reason),
      escapeCSV(request.status),
      escapeCSV(request.appliedDate),
      escapeCSV(request.approvedBy || ''),
      escapeCSV(request.notes || ''),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row: string[]) => row.join(',')),
    ].join('\n');

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
