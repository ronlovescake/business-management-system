import { useState, useMemo, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';
import type {
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  PaymentStatus,
} from '../types';
import type { Schedule } from '../../schedules/types';
import { dayjs, getCurrentDateISO } from '@/utils/date';

interface EmployeeOption {
  value: string;
  label: string;
}

interface LeaveRange {
  employeeId: string;
  startDate: string;
  endDate: string;
  id?: string;
}

/**
 * Custom Hook: useLeaveTracker
 *
 * Manages all business logic for the Leave Tracker page:
 * - State management (leave requests, filters, modals, forms)
 * - Computed values (filtered requests, stats, monthly breakdown)
 * - Event handlers (CRUD operations, CSV import/export, approvals)
 * - Utility functions (formatters, validators)
 */
export function useLeaveTracker() {
  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterLeaveType, setFilterLeaveType] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(
    null
  );
  const [activeTab, setActiveTab] = useState<string | null>('list');
  const [isImporting, setIsImporting] = useState(false);

  // Form state
  const [formEmployeeName, setFormEmployeeName] = useState('');
  const [formEmployeeId, setFormEmployeeId] = useState('');
  const [formLeaveType, setFormLeaveType] = useState<LeaveType | ''>('');
  const [formPaymentStatus, setFormPaymentStatus] = useState<
    PaymentStatus | ''
  >('unpaid');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [employeeScheduleIndex, setEmployeeScheduleIndex] = useState<
    Record<string, Set<string>>
  >({});
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [employeeLeaveAllocation, setEmployeeLeaveAllocation] = useState<
    number | null
  >(null);

  const resetFormFields = () => {
    setFormEmployeeName('');
    setFormEmployeeId('');
    setFormLeaveType('');
    setFormPaymentStatus('unpaid');
    setFormStartDate('');
    setFormEndDate('');
    setFormReason('');
    setFormNotes('');
    setEmployeeLeaveAllocation(null);
  };

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch leave requests from database on mount
  useEffect(() => {
    const fetchLeaveRequests = async () => {
      try {
        setIsLoading(true);
        const data = await api.get<LeaveRequest[]>('/api/leave-requests');
        setLeaveRequests(data);
      } catch (error) {
        logger.error('Error fetching leave requests:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaveRequests();
  }, []);

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        setIsLoadingSchedules(true);
        const data = await api.get<Schedule[]>('/api/schedules');
        const mapped: Record<string, Set<string>> = {};

        data.forEach((schedule) => {
          if (!schedule?.employeeId || !schedule?.date) {
            return;
          }

          if (schedule.status === 'cancelled') {
            return;
          }

          const normalisedDate = dayjs(schedule.date).tz().format('YYYY-MM-DD');

          // Normalize employee ID (trim and lowercase) for consistent lookup
          const normalizedEmployeeId = String(schedule.employeeId || '')
            .trim()
            .toLowerCase();

          if (!mapped[normalizedEmployeeId]) {
            mapped[normalizedEmployeeId] = new Set();
          }
          mapped[normalizedEmployeeId].add(normalisedDate);
        });

        setEmployeeScheduleIndex(mapped);
      } catch (error) {
        logger.error('Error fetching schedules for leave tracker:', error);
      } finally {
        setIsLoadingSchedules(false);
      }
    };

    fetchSchedules();
  }, []);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setIsLoadingEmployees(true);
        const data = await api.get<
          Array<{
            id: string;
            employeeId: string;
            name: string;
            firstName?: string;
            lastName?: string;
            leaveAllocation?: number;
          }>
        >('/api/employees');
        if (!Array.isArray(data)) {
          setEmployeeOptions([]);
          return;
        }

        const seen = new Set<string>();
        const options: EmployeeOption[] = [];

        data.forEach((employee) => {
          const employeeId = String(employee?.employeeId ?? '').trim();
          if (!employeeId || seen.has(employeeId)) {
            return;
          }

          const nameFromRecord = String(employee?.name ?? '').trim();
          const fallbackName =
            `${String(employee?.firstName ?? '').trim()} ${String(employee?.lastName ?? '').trim()}`
              .replace(/\s+/g, ' ')
              .trim();
          const label = (nameFromRecord || fallbackName || employeeId)
            .replace(/\s+/g, ' ')
            .trim();

          options.push({ value: employeeId, label });
          seen.add(employeeId);
        });

        options.sort((a, b) => a.label.localeCompare(b.label));
        setEmployeeOptions(options);
      } catch (error) {
        logger.error('Error fetching employees:', error);
        setEmployeeOptions([]);
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, []);

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const leaveTypes: LeaveType[] = useMemo(
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

  const paymentStatuses: PaymentStatus[] = useMemo(
    () => ['paid', 'unpaid', 'not-applicable'],
    []
  );

  // Filtered requests
  const filteredRequests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return leaveRequests.filter((request) => {
      const matchesSearch = normalizedQuery
        ? [
            request.employeeName,
            request.employeeId,
            request.leaveType,
            request.reason,
            request.notes,
          ]
            .filter((value): value is string => Boolean(value))
            .some((value) => value.toLowerCase().includes(normalizedQuery))
        : true;

      const matchesLeaveType =
        !filterLeaveType ||
        filterLeaveType === 'All' ||
        request.leaveType === filterLeaveType;

      const matchesStatus =
        !filterStatus ||
        filterStatus === 'All' ||
        request.status === filterStatus;

      return matchesSearch && matchesLeaveType && matchesStatus;
    });
  }, [leaveRequests, searchQuery, filterLeaveType, filterStatus]);

  // Stats
  const totalRequests = leaveRequests.length;
  const pendingRequests = leaveRequests.filter(
    (req) => req.status === 'pending'
  ).length;
  const approvedRequests = leaveRequests.filter(
    (req) => req.status === 'approved'
  ).length;
  const totalDaysRequested = leaveRequests.reduce(
    (sum, req) => sum + req.numberOfDays,
    0
  );

  // Monthly breakdown by leave type
  const monthlyBreakdown = useMemo(() => {
    const breakdown: Record<
      string,
      { [key: string]: number; total: number; percentage: number }
    > = {};

    leaveTypes.forEach((type) => {
      breakdown[type] = {
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

    leaveRequests.forEach((request) => {
      const month = new Date(request.startDate).toLocaleString('en-US', {
        month: 'long',
      });
      const days = request.numberOfDays;

      if (breakdown[request.leaveType]) {
        breakdown[request.leaveType][month] += days;
        breakdown[request.leaveType].total += days;
      }
    });

    // Calculate percentages
    const grandTotal = Object.values(breakdown).reduce(
      (sum, cat) => sum + cat.total,
      0
    );

    Object.keys(breakdown).forEach((type) => {
      breakdown[type].percentage =
        grandTotal > 0 ? (breakdown[type].total / grandTotal) * 100 : 0;
    });

    return Object.entries(breakdown)
      .map(([leaveType, data]) => ({
        leaveType,
        total: data.total,
        percentage: data.percentage,
        January: data.January,
        February: data.February,
        March: data.March,
        April: data.April,
        May: data.May,
        June: data.June,
        July: data.July,
        August: data.August,
        September: data.September,
        October: data.October,
        November: data.November,
        December: data.December,
      }))
      .sort((a, b) => b.total - a.total);
  }, [leaveRequests, leaveTypes]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateRange = (startDate: string, endDate: string) => {
    if (startDate === endDate) {
      return formatDate(startDate);
    }
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  const getStatusColor = (status: LeaveStatus) => {
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

  const getLeaveTypeColor = (leaveType: LeaveType) => {
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

  const getPaymentStatusColor = (paymentStatus: PaymentStatus) => {
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

  const calculateDays = useCallback(
    (startDate: string, endDate: string, employeeId?: string): number => {
      if (!startDate || !endDate) {
        return 0;
      }

      const start = dayjs(startDate).tz().startOf('day');
      const end = dayjs(endDate).tz().startOf('day');

      if (!start.isValid() || !end.isValid() || end.isBefore(start)) {
        return 0;
      }

      const totalDays = end.diff(start, 'day') + 1;

      if (!employeeId) {
        return totalDays;
      }

      // Normalize employee ID for lookup (trim and lowercase)
      const normalizedEmployeeId = String(employeeId || '')
        .trim()
        .toLowerCase();
      const scheduleSet = employeeScheduleIndex[normalizedEmployeeId];

      if (!scheduleSet || scheduleSet.size === 0 || isLoadingSchedules) {
        return totalDays;
      }

      let countedDays = 0;

      for (let offset = 0; offset < totalDays; offset += 1) {
        const currentDay = start.add(offset, 'day');
        if (scheduleSet.has(currentDay.format('YYYY-MM-DD'))) {
          countedDays += 1;
        }
      }

      return countedDays;
    },
    [employeeScheduleIndex, isLoadingSchedules]
  );

  const calculateRemainingLeaveAllocation = useCallback(
    (employeeId: string): number => {
      const ANNUAL_LEAVE_ENTITLEMENT = 7;
      const currentYear = new Date().getFullYear();

      const usedPaidLeaveDays = leaveRequests
        .filter((leave) => {
          const leaveYear = new Date(leave.startDate).getFullYear();
          const normalizedLeaveEmployeeId = String(leave.employeeId || '')
            .trim()
            .toLowerCase();
          const normalizedTargetEmployeeId = String(employeeId || '')
            .trim()
            .toLowerCase();

          return (
            normalizedLeaveEmployeeId === normalizedTargetEmployeeId &&
            leaveYear === currentYear &&
            leave.status === 'approved' &&
            leave.paymentStatus === 'paid'
          );
        })
        .reduce((total, leave) => total + (leave.numberOfDays || 0), 0);

      return Math.max(ANNUAL_LEAVE_ENTITLEMENT - usedPaidLeaveDays, 0);
    },
    [leaveRequests]
  );

  // Auto-calculate leave allocation and payment status when employee or dates change
  useEffect(() => {
    if (!formEmployeeId || !formStartDate || !formEndDate) {
      setEmployeeLeaveAllocation(null);
      return;
    }

    const remainingDays = calculateRemainingLeaveAllocation(formEmployeeId);
    setEmployeeLeaveAllocation(remainingDays);

    // Auto-populate payment status based on remaining allocation
    const requestedDays = calculateDays(
      formStartDate,
      formEndDate,
      formEmployeeId
    );

    if (requestedDays <= remainingDays && requestedDays > 0) {
      // Enough allocation - set to paid
      setFormPaymentStatus('paid');
    } else if (requestedDays > remainingDays) {
      // Exceeds allocation - set to unpaid
      setFormPaymentStatus('unpaid');
    }
  }, [
    formEmployeeId,
    formStartDate,
    formEndDate,
    calculateDays,
    calculateRemainingLeaveAllocation,
  ]);

  const hasLeaveOverlap = (
    employeeId: string,
    startDate: string,
    endDate: string,
    ignoreRequestId?: string,
    additional: LeaveRange[] = []
  ): boolean => {
    if (!employeeId || !startDate || !endDate) {
      return false;
    }

    const candidateStart = dayjs(startDate).tz().startOf('day');
    const candidateEnd = dayjs(endDate).tz().startOf('day');

    if (!candidateStart.isValid() || !candidateEnd.isValid()) {
      return false;
    }

    const existingRanges: LeaveRange[] = leaveRequests.map((request) => ({
      employeeId: request.employeeId,
      startDate: request.startDate,
      endDate: request.endDate,
      id: request.id,
    }));

    const combined = [...existingRanges, ...additional];

    // Normalize the candidate employee ID
    const normalizedCandidateId = String(employeeId || '')
      .trim()
      .toLowerCase();

    return combined.some((request) => {
      // Normalize the request employee ID
      const normalizedRequestId = String(request.employeeId || '')
        .trim()
        .toLowerCase();

      if (normalizedRequestId !== normalizedCandidateId) {
        return false;
      }

      if (ignoreRequestId && request.id === ignoreRequestId) {
        return false;
      }

      const existingStart = dayjs(request.startDate).tz().startOf('day');
      const existingEnd = dayjs(request.endDate).tz().startOf('day');

      if (!existingStart.isValid() || !existingEnd.isValid()) {
        return false;
      }

      return (
        !existingEnd.isBefore(candidateStart) &&
        !candidateEnd.isBefore(existingStart)
      );
    });
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAddRequest = () => {
    setEditingRequest(null);
    resetFormFields();
    setIsModalOpen(true);
  };

  const handleEditRequest = (request: LeaveRequest) => {
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
  };

  const handleDeleteRequest = async (id: string) => {
    if (confirm('Are you sure you want to delete this leave request?')) {
      try {
        await api.delete(`/api/leave-requests/${id}`);
        setLeaveRequests((prev) => prev.filter((req) => req.id !== id));
      } catch (error) {
        logger.error('Error deleting leave request:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        alert(`Failed to delete leave request: ${errorMessage}`);
      }
    }
  };

  const handleSaveRequest = async () => {
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

    const parsedStart = dayjs(formStartDate).tz().startOf('day');
    const parsedEnd = dayjs(formEndDate).tz().startOf('day');

    if (!parsedStart.isValid() || !parsedEnd.isValid()) {
      alert('Invalid start or end date');
      return;
    }

    const startISO = parsedStart.format('YYYY-MM-DD');
    const endISO = parsedEnd.format('YYYY-MM-DD');

    if (parsedEnd.isBefore(parsedStart)) {
      alert('End date must be on or after the start date');
      return;
    }

    const numberOfDays = calculateDays(startISO, endISO, formEmployeeId);

    if (hasLeaveOverlap(formEmployeeId, startISO, endISO, editingRequest?.id)) {
      alert(
        'This leave request overlaps with an existing request for the employee'
      );
      return;
    }

    try {
      if (editingRequest) {
        // Update existing request
        await api.patch('/api/leave-requests', {
          id: editingRequest.id,
          employeeName: formEmployeeName,
          employeeId: formEmployeeId,
          leaveType: formLeaveType,
          paymentStatus: formPaymentStatus,
          startDate: startISO,
          endDate: endISO,
          numberOfDays,
          reason: formReason,
          notes: formNotes || null,
        });

        // Update local state
        setLeaveRequests((prev) =>
          prev.map((req) =>
            req.id === editingRequest.id
              ? {
                  ...req,
                  employeeName: formEmployeeName,
                  employeeId: formEmployeeId,
                  leaveType: formLeaveType as LeaveType,
                  paymentStatus: formPaymentStatus as PaymentStatus,
                  startDate: startISO,
                  endDate: endISO,
                  numberOfDays,
                  reason: formReason,
                  notes: formNotes,
                }
              : req
          )
        );
      } else {
        // Add new request - check if we need to split based on allocation
        const remainingAllocation =
          calculateRemainingLeaveAllocation(formEmployeeId);
        const requestedDays = numberOfDays;

        const requestsToCreate: Array<{
          employeeId: string;
          employeeName: string;
          leaveType: LeaveType;
          paymentStatus: PaymentStatus;
          startDate: string;
          endDate: string;
          numberOfDays: number;
          reason: string;
          status: LeaveStatus;
          appliedDate: string;
          notes: string | null;
        }> = [];

        if (requestedDays > remainingAllocation && remainingAllocation > 0) {
          // Split into PAID and UNPAID portions
          // Calculate split date based on SCHEDULED work days, not calendar days
          const normalizedEmployeeId = String(formEmployeeId || '')
            .trim()
            .toLowerCase();
          const scheduleSet = employeeScheduleIndex[normalizedEmployeeId];

          let daysCounter = 0;
          let splitDate = '';
          let offset = 0;
          const maxIterations = 365; // Safety limit

          while (offset < maxIterations) {
            const currentDay = parsedStart.add(offset, 'day');
            const currentDateStr = currentDay.format('YYYY-MM-DD');

            // Check if this day is a scheduled work day
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

            // Find the next scheduled day after splitDate for unpaid start
            let unpaidStartDate = '';
            let searchOffset = 1;
            const maxSearch = 365;

            while (searchOffset < maxSearch) {
              const nextDay = dayjs(splitDate).tz().add(searchOffset, 'day');
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

            // Fallback if no next scheduled day found
            if (!unpaidStartDate) {
              unpaidStartDate = dayjs(splitDate)
                .tz()
                .add(1, 'day')
                .format('YYYY-MM-DD');
            }

            // Create PAID request (uses allocation)
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
              notes: formNotes || null,
            });

            // Create UNPAID request (exceeds allocation)
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
              notes: formNotes || null,
            });
          }
        } else {
          // Single request (either within allocation or completely exceeds it)
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
            notes: formNotes || null,
          });
        }

        // Send request(s) to API
        await api.post(
          '/api/leave-requests',
          requestsToCreate.length === 1 ? requestsToCreate[0] : requestsToCreate
        );

        // Refresh data from server
        const data = await api.get<LeaveRequest[]>('/api/leave-requests');
        setLeaveRequests(data);

        // Show success message with details
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
      logger.error('Error saving leave request:', error);
      alert('Failed to save leave request. Please try again.');
    }
  };

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

  const handleClearForm = () => {
    if (isClearDisabled) {
      return;
    }
    resetFormFields();
  };
  const handleApprove = async (id: string) => {
    const targetRequest = leaveRequests.find((request) => request.id === id);

    try {
      await api.patch('/api/leave-requests', {
        id,
        status: 'approved',
        approvedBy: 'System Admin', // This should come from auth context
      });

      setLeaveRequests((prev) =>
        prev.map((req) =>
          req.id === id
            ? {
                ...req,
                status: 'approved' as LeaveStatus,
                approvedBy: 'System Admin',
              }
            : req
        )
      );

      if (
        targetRequest?.employeeId &&
        targetRequest.startDate &&
        targetRequest.endDate
      ) {
        try {
          await api.post('/api/attendance/apply-leave', {
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
    } catch (error) {
      logger.error('Error approving leave request:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to approve leave request: ${errorMessage}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.patch('/api/leave-requests', {
        id,
        status: 'rejected',
      });

      setLeaveRequests((prev) =>
        prev.map((req) =>
          req.id === id ? { ...req, status: 'rejected' as LeaveStatus } : req
        )
      );
    } catch (error) {
      logger.error('Error rejecting leave request:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to reject leave request: ${errorMessage}`);
    }
  };

  const handleImportCSV = (file: File | null) => {
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

        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

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

            const csvStart = dayjs(row.startdate).tz().startOf('day');
            const csvEnd = dayjs(row.enddate).tz().startOf('day');

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
          // Send to API
          await api.post('/api/leave-requests', importedRequests);

          // Refresh data from server
          const data = await api.get<LeaveRequest[]>('/api/leave-requests');
          setLeaveRequests(data);
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
  };

  const handleExportCSV = () => {
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

    const escapeCSV = (value: string | number | null | undefined): string => {
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const rows = filteredRequests.map((request) => [
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
      ...rows.map((row) => row.join(',')),
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
  };

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
