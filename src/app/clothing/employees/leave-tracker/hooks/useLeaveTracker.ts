import { useState, useMemo, useEffect } from 'react';
import type { LeaveRequest, LeaveStatus, LeaveType } from '../types';
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

  const resetFormFields = () => {
    setFormEmployeeName('');
    setFormEmployeeId('');
    setFormLeaveType('');
    setFormStartDate('');
    setFormEndDate('');
    setFormReason('');
    setFormNotes('');
  };

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch leave requests from database on mount
  useEffect(() => {
    const fetchLeaveRequests = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/leave-requests');
        if (response.ok) {
          const data = await response.json();
          setLeaveRequests(data);
        } else {
          console.error('Failed to fetch leave requests:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching leave requests:', error);
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
        const response = await fetch('/api/schedules');
        if (!response.ok) {
          throw new Error('Failed to fetch schedules');
        }

        const data: Schedule[] = await response.json();
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
        console.error('Error fetching schedules for leave tracker:', error);
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
        const response = await fetch('/api/employees');
        if (!response.ok) {
          console.error(
            'Failed to fetch employees:',
            response.status,
            response.statusText
          );
          return;
        }

        const data = await response.json();
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
        console.error('Error fetching employees:', error);
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

  const calculateDays = (
    startDate: string,
    endDate: string,
    employeeId?: string
  ): number => {
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
  };

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
    setFormStartDate(request.startDate);
    setFormEndDate(request.endDate);
    setFormReason(request.reason);
    setFormNotes(request.notes || '');
    setIsModalOpen(true);
  };

  const handleDeleteRequest = async (id: string) => {
    if (confirm('Are you sure you want to delete this leave request?')) {
      try {
        const response = await fetch(`/api/leave-requests/${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setLeaveRequests((prev) => prev.filter((req) => req.id !== id));
        } else {
          const error = await response.json();
          alert(
            `Failed to delete leave request: ${error.error || 'Unknown error'}`
          );
        }
      } catch (error) {
        console.error('Error deleting leave request:', error);
        alert('Failed to delete leave request. Please try again.');
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
        const response = await fetch('/api/leave-requests', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingRequest.id,
            employeeName: formEmployeeName,
            employeeId: formEmployeeId,
            leaveType: formLeaveType,
            startDate: startISO,
            endDate: endISO,
            numberOfDays,
            reason: formReason,
            notes: formNotes || null,
          }),
        });

        if (response.ok) {
          // Update local state
          setLeaveRequests((prev) =>
            prev.map((req) =>
              req.id === editingRequest.id
                ? {
                    ...req,
                    employeeName: formEmployeeName,
                    employeeId: formEmployeeId,
                    leaveType: formLeaveType as LeaveType,
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
          const error = await response.json();
          alert(
            `Failed to update leave request: ${error.error || 'Unknown error'}`
          );
          return;
        }
      } else {
        // Add new request
        const newRequest = {
          employeeId: formEmployeeId,
          employeeName: formEmployeeName,
          leaveType: formLeaveType,
          startDate: startISO,
          endDate: endISO,
          numberOfDays,
          reason: formReason,
          status: 'pending' as LeaveStatus,
          appliedDate: getCurrentDateISO(),
          notes: formNotes || null,
        };

        const response = await fetch('/api/leave-requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newRequest),
        });

        if (response.ok) {
          // Refresh data from server
          const fetchResponse = await fetch('/api/leave-requests');
          if (fetchResponse.ok) {
            const data = await fetchResponse.json();
            setLeaveRequests(data);
          }
          resetFormFields();
        } else {
          const error = await response.json();
          alert(
            `Failed to create leave request: ${error.error || 'Unknown error'}`
          );
          return;
        }
      }

      setIsModalOpen(false);
    } catch (error) {
      console.error('Error saving leave request:', error);
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
    try {
      const response = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'approved',
          approvedBy: 'System Admin', // This should come from auth context
        }),
      });

      if (response.ok) {
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
      } else {
        const error = await response.json();
        alert(
          `Failed to approve leave request: ${error.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      console.error('Error approving leave request:', error);
      alert('Failed to approve leave request. Please try again.');
    }
  };

  const handleReject = async (id: string) => {
    try {
      const response = await fetch('/api/leave-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: 'rejected',
        }),
      });

      if (response.ok) {
        setLeaveRequests((prev) =>
          prev.map((req) =>
            req.id === id ? { ...req, status: 'rejected' as LeaveStatus } : req
          )
        );
      } else {
        const error = await response.json();
        alert(
          `Failed to reject leave request: ${error.error || 'Unknown error'}`
        );
      }
    } catch (error) {
      console.error('Error rejecting leave request:', error);
      alert('Failed to reject leave request. Please try again.');
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

            const newRequest = {
              employeeId: row.employeeid,
              employeeName: row.employeename,
              leaveType: row.leavetype as LeaveType,
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
          const response = await fetch('/api/leave-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(importedRequests),
          });

          if (response.ok) {
            // Refresh data from server
            const fetchResponse = await fetch('/api/leave-requests');
            if (fetchResponse.ok) {
              const data = await fetchResponse.json();
              setLeaveRequests(data);
            }
            alert(`Successfully imported ${successCount} leave requests`);
          } else {
            const error = await response.json();
            alert(`Failed to import: ${error.error || 'Unknown error'}`);
          }
        }

        if (errors.length > 0 && errors.length <= 10) {
          console.error('Import errors:', errors);
        }
      } catch (error) {
        console.error('CSV import error:', error);
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
    formStartDate,
    setFormStartDate,
    formEndDate,
    setFormEndDate,
    formReason,
    setFormReason,
    formNotes,
    setFormNotes,

    // Computed values
    leaveTypes,
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
