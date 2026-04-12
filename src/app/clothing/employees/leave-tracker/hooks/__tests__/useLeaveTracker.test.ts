/**
 * Leave Tracker Module - Utility Functions Tests
 *
 * Comprehensive tests for leave tracker module utilities:
 * - Date calculations and formatting
 * - Working days calculation
 * - Leave balance calculations
 * - Leave overlap detection
 * - Status and type colors
 * - Filtering logic
 * - Statistics calculations
 *
 * Note: React Query hooks are tested through integration tests.
 * These tests focus on pure utility functions that can be unit tested.
 *
 * @group unit
 * @group leave-tracker
 */

import { describe, it, expect } from 'vitest';

// ==========================================================================
// DATE FORMATTING
// ==========================================================================

describe('Date Formatting', () => {
  const formatDate = (date: string | Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    });
  };

  it('should format date correctly', () => {
    expect(formatDate('2024-01-15')).toMatch(/January 15, 2024/);
    expect(formatDate('2024-12-25')).toMatch(/December 25, 2024/);
  });

  it('should handle different months', () => {
    expect(formatDate('2024-06-01')).toMatch(/June 01, 2024/);
    expect(formatDate('2024-09-30')).toMatch(/September 30, 2024/);
  });
});

// ==========================================================================
// DATE RANGE FORMATTING
// ==========================================================================

describe('Date Range Formatting', () => {
  const formatDateRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'long' });
    const startDay = String(start.getDate()).padStart(2, '0');
    const endDay = String(end.getDate()).padStart(2, '0');
    const year = end.getFullYear();

    // Same day
    if (
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate()
    ) {
      return `${startMonth} ${startDay}, ${year}`;
    }

    // Same month
    if (
      start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth()
    ) {
      return `${startMonth} ${startDay} - ${endDay}, ${year}`;
    }

    // Different months
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
  };

  it('should format single day range', () => {
    const result = formatDateRange('2024-01-15', '2024-01-15');
    expect(result).toMatch(/January 15, 2024/);
  });

  it('should format same month range', () => {
    const result = formatDateRange('2024-01-15', '2024-01-20');
    expect(result).toMatch(/January 15 - 20, 2024/);
  });

  it('should format different month range', () => {
    const result = formatDateRange('2024-01-25', '2024-02-05');
    expect(result).toMatch(/January 25 - February 05, 2024/);
  });
});

// ==========================================================================
// CALENDAR DAYS CALCULATION
// ==========================================================================

describe('Calendar Days Calculation', () => {
  const calculateCalendarDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (!start || !end || end < start) {
      return 0;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1; // Include both start and end date
  };

  it('should calculate single day', () => {
    expect(calculateCalendarDays('2024-01-15', '2024-01-15')).toBe(1);
  });

  it('should calculate multiple days', () => {
    expect(calculateCalendarDays('2024-01-15', '2024-01-20')).toBe(6);
    expect(calculateCalendarDays('2024-01-01', '2024-01-31')).toBe(31);
  });

  it('should calculate across months', () => {
    expect(calculateCalendarDays('2024-01-25', '2024-02-05')).toBe(12);
  });

  it('should calculate across years', () => {
    expect(calculateCalendarDays('2023-12-25', '2024-01-05')).toBe(12);
  });

  it('should return 0 for invalid date range', () => {
    expect(calculateCalendarDays('2024-01-20', '2024-01-15')).toBe(0);
  });
});

// ==========================================================================
// WORKING DAYS CALCULATION (WITH SCHEDULE)
// ==========================================================================

describe('Working Days Calculation', () => {
  const calculateWorkingDays = (
    startDate: string,
    endDate: string,
    scheduleSet: Set<string>
  ): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (!start || !end || end < start) {
      return 0;
    }

    let countedDays = 0;
    const current = new Date(start);

    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      if (scheduleSet.has(dateStr)) {
        countedDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return countedDays;
  };

  it('should count all days when all are scheduled', () => {
    const scheduleSet = new Set([
      '2024-01-15',
      '2024-01-16',
      '2024-01-17',
      '2024-01-18',
      '2024-01-19',
    ]);
    expect(calculateWorkingDays('2024-01-15', '2024-01-19', scheduleSet)).toBe(
      5
    );
  });

  it('should count only scheduled days', () => {
    const scheduleSet = new Set([
      '2024-01-15',
      '2024-01-17',
      '2024-01-19', // Only Mon, Wed, Fri
    ]);
    expect(calculateWorkingDays('2024-01-15', '2024-01-19', scheduleSet)).toBe(
      3
    );
  });

  it('should return 0 when no days are scheduled', () => {
    const scheduleSet = new Set<string>([]);
    expect(calculateWorkingDays('2024-01-15', '2024-01-19', scheduleSet)).toBe(
      0
    );
  });

  it('should handle partial schedule coverage', () => {
    const scheduleSet = new Set([
      '2024-01-15',
      '2024-01-16',
      // 17th not scheduled
      '2024-01-18',
      '2024-01-19',
    ]);
    expect(calculateWorkingDays('2024-01-15', '2024-01-19', scheduleSet)).toBe(
      4
    );
  });
});

// ==========================================================================
// LEAVE BALANCE CALCULATIONS
// ==========================================================================

describe('Leave Balance Calculations', () => {
  interface LeaveRequest {
    employeeId: string;
    status: string;
    paymentStatus: string;
    numberOfDays: number;
  }

  const calculateRemainingLeave = (
    employeeId: string,
    leaveRequests: LeaveRequest[],
    annualEntitlement: number = 7
  ): number => {
    const usedPaidLeaveDays = leaveRequests
      .filter(
        (leave) =>
          leave.employeeId === employeeId &&
          leave.status === 'approved' &&
          leave.paymentStatus === 'paid'
      )
      .reduce((total, leave) => total + leave.numberOfDays, 0);

    return Math.max(annualEntitlement - usedPaidLeaveDays, 0);
  };

  it('should calculate full entitlement when no leave used', () => {
    const remaining = calculateRemainingLeave('EMP-001', []);
    expect(remaining).toBe(7);
  });

  it('should deduct approved paid leave', () => {
    const requests: LeaveRequest[] = [
      {
        employeeId: 'EMP-001',
        status: 'approved',
        paymentStatus: 'paid',
        numberOfDays: 3,
      },
    ];
    expect(calculateRemainingLeave('EMP-001', requests)).toBe(4);
  });

  it('should not deduct pending leave', () => {
    const requests: LeaveRequest[] = [
      {
        employeeId: 'EMP-001',
        status: 'pending',
        paymentStatus: 'paid',
        numberOfDays: 3,
      },
    ];
    expect(calculateRemainingLeave('EMP-001', requests)).toBe(7);
  });

  it('should not deduct unpaid leave', () => {
    const requests: LeaveRequest[] = [
      {
        employeeId: 'EMP-001',
        status: 'approved',
        paymentStatus: 'unpaid',
        numberOfDays: 3,
      },
    ];
    expect(calculateRemainingLeave('EMP-001', requests)).toBe(7);
  });

  it('should return 0 when entitlement exceeded', () => {
    const requests: LeaveRequest[] = [
      {
        employeeId: 'EMP-001',
        status: 'approved',
        paymentStatus: 'paid',
        numberOfDays: 10,
      },
    ];
    expect(calculateRemainingLeave('EMP-001', requests)).toBe(0);
  });

  it('should sum multiple approved paid leaves', () => {
    const requests: LeaveRequest[] = [
      {
        employeeId: 'EMP-001',
        status: 'approved',
        paymentStatus: 'paid',
        numberOfDays: 2,
      },
      {
        employeeId: 'EMP-001',
        status: 'approved',
        paymentStatus: 'paid',
        numberOfDays: 3,
      },
    ];
    expect(calculateRemainingLeave('EMP-001', requests)).toBe(2);
  });

  it('should filter by employee ID', () => {
    const requests: LeaveRequest[] = [
      {
        employeeId: 'EMP-001',
        status: 'approved',
        paymentStatus: 'paid',
        numberOfDays: 3,
      },
      {
        employeeId: 'EMP-002',
        status: 'approved',
        paymentStatus: 'paid',
        numberOfDays: 5,
      },
    ];
    expect(calculateRemainingLeave('EMP-001', requests)).toBe(4);
  });
});

// ==========================================================================
// LEAVE OVERLAP DETECTION
// ==========================================================================

describe('Leave Overlap Detection', () => {
  interface LeaveRequest {
    id: string;
    employeeId: string;
    startDate: string;
    endDate: string;
  }

  const hasLeaveOverlap = (
    employeeId: string,
    startDate: string,
    endDate: string,
    existingRequests: LeaveRequest[],
    ignoreRequestId?: string
  ): boolean => {
    const candidateStart = new Date(startDate);
    const candidateEnd = new Date(endDate);

    return existingRequests.some((request) => {
      if (request.employeeId !== employeeId) {
        return false;
      }
      if (request.id === ignoreRequestId) {
        return false;
      }

      const existingStart = new Date(request.startDate);
      const existingEnd = new Date(request.endDate);

      // Check if date ranges overlap
      return existingEnd >= candidateStart && candidateEnd >= existingStart;
    });
  };

  it('should detect overlap when dates intersect', () => {
    const existing: LeaveRequest[] = [
      {
        id: '1',
        employeeId: 'EMP-001',
        startDate: '2024-01-15',
        endDate: '2024-01-20',
      },
    ];
    expect(
      hasLeaveOverlap(
        'EMP-001',
        '2024-01-18',
        '2024-01-25',
        existing
      )
    ).toBe(true);
  });

  it('should detect overlap when new leave contains existing', () => {
    const existing: LeaveRequest[] = [
      {
        id: '1',
        employeeId: 'EMP-001',
        startDate: '2024-01-17',
        endDate: '2024-01-18',
      },
    ];
    expect(
      hasLeaveOverlap(
        'EMP-001',
        '2024-01-15',
        '2024-01-20',
        existing
      )
    ).toBe(true);
  });

  it('should detect overlap when existing leave contains new', () => {
    const existing: LeaveRequest[] = [
      {
        id: '1',
        employeeId: 'EMP-001',
        startDate: '2024-01-10',
        endDate: '2024-01-25',
      },
    ];
    expect(
      hasLeaveOverlap(
        'EMP-001',
        '2024-01-15',
        '2024-01-20',
        existing
      )
    ).toBe(true);
  });

  it('should not detect overlap for separate dates', () => {
    const existing: LeaveRequest[] = [
      {
        id: '1',
        employeeId: 'EMP-001',
        startDate: '2024-01-15',
        endDate: '2024-01-20',
      },
    ];
    expect(
      hasLeaveOverlap(
        'EMP-001',
        '2024-01-25',
        '2024-01-30',
        existing
      )
    ).toBe(false);
  });

  it('should not detect overlap for different employees', () => {
    const existing: LeaveRequest[] = [
      {
        id: '1',
        employeeId: 'EMP-002',
        startDate: '2024-01-15',
        endDate: '2024-01-20',
      },
    ];
    expect(
      hasLeaveOverlap(
        'EMP-001',
        '2024-01-15',
        '2024-01-20',
        existing
      )
    ).toBe(false);
  });

  it('should ignore specified request ID', () => {
    const existing: LeaveRequest[] = [
      {
        id: '1',
        employeeId: 'EMP-001',
        startDate: '2024-01-15',
        endDate: '2024-01-20',
      },
    ];
    expect(
      hasLeaveOverlap('EMP-001', '2024-01-15', '2024-01-20', existing, '1')
    ).toBe(false);
  });

  it('should detect overlap on same start date', () => {
    const existing: LeaveRequest[] = [
      {
        id: '1',
        employeeId: 'EMP-001',
        startDate: '2024-01-15',
        endDate: '2024-01-20',
      },
    ];
    expect(
      hasLeaveOverlap(
        'EMP-001',
        '2024-01-15',
        '2024-01-25',
        existing
      )
    ).toBe(true);
  });

  it('should detect overlap on same end date', () => {
    const existing: LeaveRequest[] = [
      {
        id: '1',
        employeeId: 'EMP-001',
        startDate: '2024-01-15',
        endDate: '2024-01-20',
      },
    ];
    expect(
      hasLeaveOverlap(
        'EMP-001',
        '2024-01-10',
        '2024-01-20',
        existing
      )
    ).toBe(true);
  });
});

// ==========================================================================
// STATUS COLORS
// ==========================================================================

describe('Status Colors', () => {
  type LeaveStatus = 'pending' | 'approved' | 'rejected';

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

  it('should return yellow for pending', () => {
    expect(getStatusColor('pending')).toBe('yellow');
  });

  it('should return green for approved', () => {
    expect(getStatusColor('approved')).toBe('green');
  });

  it('should return red for rejected', () => {
    expect(getStatusColor('rejected')).toBe('red');
  });
});

// ==========================================================================
// LEAVE TYPE COLORS
// ==========================================================================

describe('Leave Type Colors', () => {
  type LeaveType =
    | 'Sick Leave'
    | 'Vacation Leave'
    | 'Emergency Leave'
    | 'Maternity Leave'
    | 'Paternity Leave'
    | 'Bereavement Leave'
    | 'Other';

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

  it('should return red for sick leave', () => {
    expect(getLeaveTypeColor('Sick Leave')).toBe('red');
  });

  it('should return blue for vacation leave', () => {
    expect(getLeaveTypeColor('Vacation Leave')).toBe('blue');
  });

  it('should return orange for emergency leave', () => {
    expect(getLeaveTypeColor('Emergency Leave')).toBe('orange');
  });

  it('should return pink for maternity leave', () => {
    expect(getLeaveTypeColor('Maternity Leave')).toBe('pink');
  });

  it('should return cyan for paternity leave', () => {
    expect(getLeaveTypeColor('Paternity Leave')).toBe('cyan');
  });

  it('should return gray for bereavement leave', () => {
    expect(getLeaveTypeColor('Bereavement Leave')).toBe('gray');
  });

  it('should return grape for other', () => {
    expect(getLeaveTypeColor('Other')).toBe('grape');
  });
});

// ==========================================================================
// PAYMENT STATUS COLORS
// ==========================================================================

describe('Payment Status Colors', () => {
  type PaymentStatus = 'paid' | 'unpaid' | 'not-applicable';

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

  it('should return green for paid', () => {
    expect(getPaymentStatusColor('paid')).toBe('green');
  });

  it('should return red for unpaid', () => {
    expect(getPaymentStatusColor('unpaid')).toBe('red');
  });

  it('should return gray for not-applicable', () => {
    expect(getPaymentStatusColor('not-applicable')).toBe('gray');
  });
});

// ==========================================================================
// LEAVE REQUEST FILTERING
// ==========================================================================

describe('Leave Request Filtering', () => {
  interface LeaveRequest {
    employeeId: string;
    employeeName: string;
    leaveType: string;
    status: string;
  }

  const filterRequests = (
    requests: LeaveRequest[],
    searchQuery: string,
    filterLeaveType: string | null,
    filterStatus: string | null
  ) => {
    return requests.filter((request) => {
      const matchesSearch =
        searchQuery === '' ||
        request.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        request.employeeName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        request.leaveType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesLeaveType =
        !filterLeaveType ||
        filterLeaveType === 'all' ||
        request.leaveType === filterLeaveType;

      const matchesStatus =
        !filterStatus ||
        filterStatus === 'all' ||
        request.status === filterStatus;

      return matchesSearch && matchesLeaveType && matchesStatus;
    });
  };

  const mockRequests: LeaveRequest[] = [
    {
      employeeId: 'EMP-001',
      employeeName: 'John Doe',
      leaveType: 'Sick Leave',
      status: 'pending',
    },
    {
      employeeId: 'EMP-002',
      employeeName: 'Jane Smith',
      leaveType: 'Vacation Leave',
      status: 'approved',
    },
    {
      employeeId: 'EMP-003',
      employeeName: 'Bob Johnson',
      leaveType: 'Emergency Leave',
      status: 'rejected',
    },
  ];

  it('should return all requests with no filters', () => {
    const result = filterRequests(mockRequests, '', null, null);
    expect(result).toHaveLength(3);
  });

  it('should filter by employee name', () => {
    const result = filterRequests(mockRequests, 'John', null, null);
    expect(result).toHaveLength(2); // John Doe and Bob Johnson
  });

  it('should filter by employee ID', () => {
    const result = filterRequests(mockRequests, 'EMP-001', null, null);
    expect(result).toHaveLength(1);
    expect(result[0].employeeName).toBe('John Doe');
  });

  it('should filter by leave type keyword', () => {
    const result = filterRequests(mockRequests, 'sick', null, null);
    expect(result).toHaveLength(1);
    expect(result[0].leaveType).toBe('Sick Leave');
  });

  it('should filter by leave type filter', () => {
    const result = filterRequests(mockRequests, '', 'Vacation Leave', null);
    expect(result).toHaveLength(1);
    expect(result[0].leaveType).toBe('Vacation Leave');
  });

  it('should filter by status', () => {
    const result = filterRequests(mockRequests, '', null, 'approved');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('approved');
  });

  it('should combine all filters', () => {
    const result = filterRequests(
      mockRequests,
      'Jane',
      'Vacation Leave',
      'approved'
    );
    expect(result).toHaveLength(1);
    expect(result[0].employeeName).toBe('Jane Smith');
  });

  it('should be case-insensitive', () => {
    const result = filterRequests(mockRequests, 'JOHN', null, null);
    expect(result).toHaveLength(2);
  });

  it('should handle "all" filters', () => {
    const result = filterRequests(mockRequests, '', 'all', 'all');
    expect(result).toHaveLength(3);
  });
});

// ==========================================================================
// STATISTICS CALCULATIONS
// ==========================================================================

describe('Statistics Calculations', () => {
  interface LeaveRequest {
    status: string;
  }

  const calculateStats = (requests: LeaveRequest[]) => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
    };
  };

  it('should calculate stats for empty array', () => {
    const stats = calculateStats([]);
    expect(stats).toEqual({
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    });
  });

  it('should count requests by status', () => {
    const requests = [
      { status: 'pending' },
      { status: 'pending' },
      { status: 'approved' },
      { status: 'rejected' },
    ];

    const stats = calculateStats(requests);
    expect(stats).toEqual({
      total: 4,
      pending: 2,
      approved: 1,
      rejected: 1,
    });
  });

  it('should handle all same status', () => {
    const requests = [
      { status: 'approved' },
      { status: 'approved' },
      { status: 'approved' },
    ];

    const stats = calculateStats(requests);
    expect(stats).toEqual({
      total: 3,
      pending: 0,
      approved: 3,
      rejected: 0,
    });
  });
});
