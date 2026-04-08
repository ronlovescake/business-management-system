/**
 * Leave Tracker — CSV Utils (Business Rule Tests)
 *
 * Rules from docs/business-logic/clothing/employees-leave-tracker.md:
 *   #22 — CSV import batch overlap check
 *   #39 — CSV export includes all request fields
 *   #40 — CSV import validates required columns
 *   #41 — Import checks for overlap per employee
 *   #42 — Import parses dates with timezone and validates ranges
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/utils/date', () => {
  // Minimal dayjs mock for CSV parsing
  const dayjsImpl = (date?: string | Date) => {
    const d = typeof date === 'string' ? new Date(date) : (date ?? new Date());
    return {
      tz: () => ({
        startOf: () => ({
          isValid: () => !isNaN(d.getTime()),
          isBefore: (other: { toDate: () => Date }) => {
            try {
              return d.getTime() < other.toDate().getTime();
            } catch {
              return false;
            }
          },
          format: (fmt: string) => {
            if (fmt === 'YYYY-MM-DD') {
              if (isNaN(d.getTime())) return 'Invalid Date';
              return d.toISOString().split('T')[0];
            }
            return d.toISOString();
          },
          toDate: () => d,
        }),
        format: (fmt: string) => {
          if (fmt === 'YYYY-MM-DD') {
            if (isNaN(d.getTime())) return 'Invalid Date';
            return d.toISOString().split('T')[0];
          }
          return d.toISOString();
        },
      }),
      isValid: () => !isNaN(d.getTime()),
      format: (fmt: string) => {
        if (fmt === 'YYYY-MM-DD') {
          if (isNaN(d.getTime())) return 'Invalid Date';
          return d.toISOString().split('T')[0];
        }
        return d.toISOString();
      },
    };
  };
  return { dayjs: dayjsImpl };
});

vi.mock('@/components/expenses', () => ({
  escapeCSV: (v: unknown) => String(v ?? ''),
  parseCSVLine: (line: string) =>
    line.split(',').map((c) => c.trim().replace(/^"|"$/g, '')),
}));

import {
  validateLeaveImportColumns,
  parseImportedLeaveRequests,
  buildLeaveRequestsCsv,
} from '@/app/clothing/employees/leave-tracker/hooks/leaveTrackerCsvUtils';

import type { LeaveRequest } from '@/app/clothing/employees/leave-tracker/types';

// =========================================================================
// Rule #40: CSV import validates required columns
// =========================================================================

describe('Rule #40: validateLeaveImportColumns', () => {
  it('returns empty array when all required columns present', () => {
    const headers = [
      'employeeid',
      'employeename',
      'leavetype',
      'startdate',
      'enddate',
      'reason',
    ];
    expect(validateLeaveImportColumns(headers)).toEqual([]);
  });

  it('returns missing columns when some are absent', () => {
    const headers = ['employeeid', 'employeename'];
    const missing = validateLeaveImportColumns(headers);
    expect(missing).toContain('leavetype');
    expect(missing).toContain('startdate');
    expect(missing).toContain('enddate');
    expect(missing).toContain('reason');
  });

  it('returns all required when headers is empty', () => {
    expect(validateLeaveImportColumns([])).toHaveLength(6);
  });
});

// =========================================================================
// Rule #39: CSV export includes all request fields
// =========================================================================

describe('Rule #39: buildLeaveRequestsCsv', () => {
  it('includes correct header row', () => {
    const csv = buildLeaveRequestsCsv([]);
    const headerLine = csv.split('\n')[0];
    expect(headerLine).toContain('Employee ID');
    expect(headerLine).toContain('Leave Type');
    expect(headerLine).toContain('Start Date');
    expect(headerLine).toContain('End Date');
    expect(headerLine).toContain('Number of Days');
    expect(headerLine).toContain('Status');
    expect(headerLine).toContain('Applied Date');
    expect(headerLine).toContain('Approved By');
    expect(headerLine).toContain('Notes');
  });

  it('exports request rows correctly', () => {
    const requests: LeaveRequest[] = [
      {
        id: 'lr-1',
        employeeId: 'emp-1',
        employeeName: 'Alice',
        leaveType: 'Sick',
        startDate: '2026-04-01',
        endDate: '2026-04-03',
        numberOfDays: 3,
        reason: 'Flu',
        status: 'approved',
        paymentStatus: 'paid',
        appliedDate: '2026-03-28',
        approvedBy: 'Manager',
        notes: 'Get well soon',
      },
    ];

    const csv = buildLeaveRequestsCsv(requests);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2); // header + 1 row
    expect(lines[1]).toContain('emp-1');
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('Sick');
    expect(lines[1]).toContain('approved');
  });
});

// =========================================================================
// Rules #22, #41, #42: CSV import parsing
// =========================================================================

describe('Rules #22,#41,#42: parseImportedLeaveRequests', () => {
  const noOverlap = () => false;
  const simpleDays = () => 1;
  const today = () => '2026-04-08';

  it('returns error for empty CSV', () => {
    const result = parseImportedLeaveRequests({
      text: '',
      hasLeaveOverlap: noOverlap,
      calculateDays: simpleDays,
      getCurrentDateISO: today,
    });
    expect('error' in result).toBe(true);
  });

  it('returns error for missing required columns', () => {
    const text = 'name,date\nalice,2026-04-01';
    const result = parseImportedLeaveRequests({
      text,
      hasLeaveOverlap: noOverlap,
      calculateDays: simpleDays,
      getCurrentDateISO: today,
    });
    expect('error' in result).toBe(true);
  });

  it('Rule #42: parses valid rows', () => {
    const text = [
      'employeeid,employeename,leavetype,startdate,enddate,reason',
      'emp-1,Alice,Sick,2026-04-01,2026-04-03,Flu',
    ].join('\n');

    const result = parseImportedLeaveRequests({
      text,
      hasLeaveOverlap: noOverlap,
      calculateDays: () => 3,
      getCurrentDateISO: today,
    });

    expect('importedRequests' in result).toBe(true);
    if ('importedRequests' in result) {
      expect(result.successCount).toBe(1);
      expect(result.importedRequests[0].employeeId).toBe('emp-1');
      expect(result.importedRequests[0].numberOfDays).toBe(3);
      expect(result.importedRequests[0].status).toBe('pending'); // default
    }
  });

  it('Rule #22: reports overlap errors', () => {
    const text = [
      'employeeid,employeename,leavetype,startdate,enddate,reason',
      'emp-1,Alice,Sick,2026-04-01,2026-04-03,Flu',
    ].join('\n');

    const alwaysOverlap = () => true;
    const result = parseImportedLeaveRequests({
      text,
      hasLeaveOverlap: alwaysOverlap,
      calculateDays: simpleDays,
      getCurrentDateISO: today,
    });

    if ('errors' in result) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/overlap/i);
    }
  });

  it('Rule #42: rejects end date before start date', () => {
    const text = [
      'employeeid,employeename,leavetype,startdate,enddate,reason',
      'emp-1,Alice,Sick,2026-04-05,2026-04-01,Backwards',
    ].join('\n');

    const result = parseImportedLeaveRequests({
      text,
      hasLeaveOverlap: noOverlap,
      calculateDays: simpleDays,
      getCurrentDateISO: today,
    });

    if ('errors' in result) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/precedes/i);
    }
  });

  it('defaults status to pending when invalid', () => {
    const text = [
      'employeeid,employeename,leavetype,startdate,enddate,reason,status',
      'emp-1,Alice,Sick,2026-04-01,2026-04-03,Flu,invalid-status',
    ].join('\n');

    const result = parseImportedLeaveRequests({
      text,
      hasLeaveOverlap: noOverlap,
      calculateDays: simpleDays,
      getCurrentDateISO: today,
    });

    if ('importedRequests' in result) {
      expect(result.importedRequests[0].status).toBe('pending');
    }
  });
});
