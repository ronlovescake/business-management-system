import type {
  LeaveRequest,
  LeaveStatus,
  LeaveType,
  PaymentStatus,
} from '../types';
import { TIMEZONE } from './leaveTrackerUtils';
import { dayjs } from '@/utils/date';
import { escapeCSV, parseCSVLine } from '@/components/expenses';

export const validateLeaveImportColumns = (headers: string[]) => {
  const requiredColumns = [
    'employeeid',
    'employeename',
    'leavetype',
    'startdate',
    'enddate',
    'reason',
  ];

  return requiredColumns.filter((col) => !headers.includes(col));
};

type ParseImportedLeaveRequestsArgs = {
  text: string;
  hasLeaveOverlap: (
    employeeId: string,
    startDate: string,
    endDate: string,
    ignoreRequestId?: string,
    additionalRequests?: Omit<LeaveRequest, 'id'>[]
  ) => boolean;
  calculateDays: (
    startDate: string,
    endDate: string,
    employeeId?: string
  ) => number;
  getCurrentDateISO: () => string;
};

export const parseImportedLeaveRequests = ({
  text,
  hasLeaveOverlap,
  calculateDays,
  getCurrentDateISO,
}: ParseImportedLeaveRequestsArgs) => {
  const lines = text.split('\n').filter((line) => line.trim());
  if (lines.length < 2) {
    return { error: 'CSV file is empty or invalid' } as const;
  }

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, '')
  );
  const missingColumns = validateLeaveImportColumns(headers);
  if (missingColumns.length > 0) {
    return {
      error:
        `Missing required columns: ${missingColumns.join(', ')}\n\n` +
        'Required columns: employeeId, employeeName, leaveType, startDate, endDate, reason\n' +
        'Optional columns: status, appliedDate, approvedBy, notes',
    } as const;
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

      const numberOfDays = calculateDays(startISO, endISO, row.employeeid);
      const status = (row.status?.toLowerCase() as LeaveStatus) || 'pending';
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

      importedRequests.push({
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
      });
      successCount += 1;
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error}`);
    }
  }

  return { importedRequests, successCount, errors } as const;
};

export const buildLeaveRequestsCsv = (requests: LeaveRequest[]) => {
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

  const rows = requests.map((request) => [
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

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
};
