import { showError } from '@/lib/alerts';
import type { AttendanceRecord, AttendanceStatus } from '../types';

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

export const parseImportedAttendanceCsv = async (text: string) => {
  const lines = text.split('\n').filter((line) => line.trim());
  if (lines.length < 2) {
    await showError('CSV file is empty or invalid', 'Import Error');
    return null;
  }

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, '')
  );

  const requiredColumns = ['employeeid', 'employeename', 'date'];
  const missingColumns = requiredColumns.filter(
    (col) => !headers.includes(col)
  );
  if (missingColumns.length > 0) {
    await showError(
      `Missing required columns: ${missingColumns.join(', ')}\n\n` +
        'Required columns: employeeId, employeeName, date\n' +
        'Optional columns: timeIn, timeOut, department, position, status, ' +
        'break1Start, break1End, lunchStart, lunchEnd, break2Start, break2End, ' +
        'totalHours, details, notes',
      'Import Error'
    );
    return null;
  }

  const importedRecords: Array<Omit<AttendanceRecord, 'id'>> = [];
  let successCount = 0;
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCSVLine(lines[i]);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      if (!row.employeeid && !row.employeename && !row.date) {
        continue;
      }

      if (!row.employeeid || !row.employeename || !row.date) {
        errors.push(`Row ${i + 1}: Missing required field(s)`);
        continue;
      }

      let totalHours = 0;
      if (row.timein && row.timeout) {
        const [inHours, inMinutes] = row.timein.split(':').map(Number);
        const [outHours, outMinutes] = row.timeout.split(':').map(Number);
        const totalMinutes =
          outHours * 60 + outMinutes - (inHours * 60 + inMinutes);
        totalHours = totalMinutes > 0 ? totalMinutes / 60 : 0;
      } else if (row.totalhours) {
        totalHours = parseFloat(row.totalhours) || 0;
      }

      const status =
        (row.status?.toLowerCase() as AttendanceStatus) || 'present';
      const validStatus: AttendanceStatus = [
        'present',
        'late',
        'absent',
        'on-leave',
      ].includes(status)
        ? status
        : 'present';

      importedRecords.push({
        employeeId: row.employeeid,
        employeeName: row.employeename,
        department: row.department || 'N/A',
        position: row.position || 'N/A',
        date: row.date,
        timeIn: row.timein || '',
        timeOut: row.timeout || '',
        break1Start: row.break1start || undefined,
        break1End: row.break1end || undefined,
        lunchStart: row.lunchstart || undefined,
        lunchEnd: row.lunchend || undefined,
        break2Start: row.break2start || undefined,
        break2End: row.break2end || undefined,
        totalHours,
        status: validStatus,
        details: row.details || '',
        notes: row.notes || undefined,
      });
      successCount += 1;
    } catch (error) {
      errors.push(`Row ${i + 1}: ${error}`);
    }
  }

  return { importedRecords, successCount, errors };
};

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

export const buildAttendanceCsv = (records: AttendanceRecord[]) => {
  const headers = [
    'Employee ID',
    'Employee Name',
    'Department',
    'Position',
    'Date',
    'Time In',
    'Time Out',
    'Total Hours',
    'Status',
    'Details',
    'Notes',
  ];

  const rows = records.map((record) => [
    escapeCSV(record.employeeId),
    escapeCSV(record.employeeName),
    escapeCSV(record.department),
    escapeCSV(record.position),
    escapeCSV(record.date),
    escapeCSV(record.timeIn),
    escapeCSV(record.timeOut),
    escapeCSV(record.totalHours.toFixed(2)),
    escapeCSV(record.status),
    escapeCSV(record.details),
    escapeCSV(record.notes || ''),
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
};
