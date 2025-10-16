import { useState, useMemo } from 'react';
import type { LeaveRequest, LeaveStatus, LeaveType } from '../types';

const generateId = () =>
  `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([
    {
      id: '1',
      employeeId: 'EMP-0001',
      employeeName: 'Ronald Allan Balng',
      leaveType: 'Sick Leave',
      startDate: '2025-10-20',
      endDate: '2025-10-22',
      numberOfDays: 3,
      reason: 'Medical checkup and recovery',
      status: 'approved',
      appliedDate: '2025-10-15',
      approvedBy: 'HR Manager',
      notes: 'Medical certificate submitted',
    },
    {
      id: '2',
      employeeId: 'EMP-0002',
      employeeName: 'Czarina Cortez Balng',
      leaveType: 'Vacation Leave',
      startDate: '2025-11-01',
      endDate: '2025-11-05',
      numberOfDays: 5,
      reason: 'Family vacation',
      status: 'pending',
      appliedDate: '2025-10-10',
    },
    {
      id: '3',
      employeeId: 'EMP-0003',
      employeeName: 'Arnel Ephraim Subia Aliangan',
      leaveType: 'Emergency Leave',
      startDate: '2025-10-18',
      endDate: '2025-10-18',
      numberOfDays: 1,
      reason: 'Family emergency',
      status: 'approved',
      appliedDate: '2025-10-18',
      approvedBy: 'Operations Manager',
      notes: 'Emergency leave granted',
    },
    {
      id: '4',
      employeeId: 'EMP-0004',
      employeeName: 'Joan Lacualan Tapic',
      leaveType: 'Sick Leave',
      startDate: '2025-10-25',
      endDate: '2025-10-26',
      numberOfDays: 2,
      reason: 'Flu symptoms',
      status: 'rejected',
      appliedDate: '2025-10-14',
      notes: 'Insufficient sick leave balance',
    },
  ]);

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

  const calculateDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) {
      return 0;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Include both start and end dates
  };

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  const handleAddRequest = () => {
    setEditingRequest(null);
    setFormEmployeeName('');
    setFormEmployeeId('');
    setFormLeaveType('');
    setFormStartDate('');
    setFormEndDate('');
    setFormReason('');
    setFormNotes('');
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

  const handleDeleteRequest = (id: string) => {
    if (confirm('Are you sure you want to delete this leave request?')) {
      setLeaveRequests((prev) => prev.filter((req) => req.id !== id));
    }
  };

  const handleSaveRequest = () => {
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

    const numberOfDays = calculateDays(formStartDate, formEndDate);

    if (editingRequest) {
      // Update existing request
      setLeaveRequests((prev) =>
        prev.map((req) =>
          req.id === editingRequest.id
            ? {
                ...req,
                employeeName: formEmployeeName,
                employeeId: formEmployeeId,
                leaveType: formLeaveType as LeaveType,
                startDate: formStartDate,
                endDate: formEndDate,
                numberOfDays,
                reason: formReason,
                notes: formNotes,
              }
            : req
        )
      );
    } else {
      // Add new request
      const newRequest: LeaveRequest = {
        id: generateId(),
        employeeId: formEmployeeId,
        employeeName: formEmployeeName,
        leaveType: formLeaveType as LeaveType,
        startDate: formStartDate,
        endDate: formEndDate,
        numberOfDays,
        reason: formReason,
        status: 'pending',
        appliedDate: new Date().toISOString().split('T')[0],
        notes: formNotes,
      };

      setLeaveRequests((prev) => [...prev, newRequest]);
    }

    setIsModalOpen(false);
  };

  const handleApprove = (id: string) => {
    setLeaveRequests((prev) =>
      prev.map((req) =>
        req.id === id
          ? {
              ...req,
              status: 'approved' as LeaveStatus,
              approvedBy: 'System Admin', // This should come from auth context
            }
          : req
      )
    );
  };

  const handleReject = (id: string) => {
    setLeaveRequests((prev) =>
      prev.map((req) =>
        req.id === id ? { ...req, status: 'rejected' as LeaveStatus } : req
      )
    );
  };

  const handleImportCSV = (file: File | null) => {
    if (!file) {
      return;
    }

    setIsImporting(true);
    const reader = new FileReader();

    reader.onload = (e) => {
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

        const importedRequests: LeaveRequest[] = [];
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

            const numberOfDays = calculateDays(row.startdate, row.enddate);

            const status =
              (row.status?.toLowerCase() as LeaveStatus) || 'pending';
            const validStatus: LeaveStatus = [
              'pending',
              'approved',
              'rejected',
            ].includes(status)
              ? status
              : 'pending';

            const newRequest: LeaveRequest = {
              id: generateId(),
              employeeId: row.employeeid,
              employeeName: row.employeename,
              leaveType: row.leavetype as LeaveType,
              startDate: row.startdate,
              endDate: row.enddate,
              numberOfDays,
              reason: row.reason,
              status: validStatus,
              appliedDate:
                row.applieddate || new Date().toISOString().split('T')[0],
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
          setLeaveRequests((prev) => [...prev, ...importedRequests]);
          alert(`Successfully imported ${successCount} leave requests`);
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
    link.setAttribute(
      'download',
      `leave_requests_${new Date().toISOString().split('T')[0]}.csv`
    );
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
    handleApprove,
    handleReject,
    handleImportCSV,
    handleExportCSV,
  };
}
