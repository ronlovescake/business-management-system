import type { Schedule, ScheduleStatus, ShiftType } from '../types';
import { getTimeRange, hasScheduleOverlap } from './scheduleTimeUtils';

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

export const parseImportedSchedulesCsv = (
  text: string,
  schedules: Schedule[]
) => {
  const lines = text.split('\n').filter((line) => line.trim());

  if (lines.length < 2) {
    return {
      kind: 'invalid' as const,
      message: 'CSV file is empty or invalid',
    };
  }

  const headers = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/\s+/g, '')
  );

  const requiredColumns = [
    'employeeid',
    'employeename',
    'date',
    'shifttype',
    'starttime',
    'endtime',
    'position',
    'department',
  ];
  const missingColumns = requiredColumns.filter(
    (col) => !headers.includes(col)
  );

  if (missingColumns.length > 0) {
    return {
      kind: 'invalid' as const,
      message:
        `Missing required columns: ${missingColumns.join(', ')}\n\n` +
        'Required columns: employeeId, employeeName, date, shiftType, startTime, endTime, position, department\n' +
        'Optional columns: status, notes',
    };
  }

  const importedSchedules: Schedule[] = [];
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
        !row.date &&
        !row.starttime &&
        !row.endtime
      ) {
        continue;
      }

      if (
        !row.employeeid ||
        !row.employeename ||
        !row.date ||
        !row.shifttype ||
        !row.starttime ||
        !row.endtime ||
        !row.position ||
        !row.department
      ) {
        errors.push(`Row ${i + 1}: Missing required field(s)`);
        continue;
      }

      const timeRange = getTimeRange(row.starttime, row.endtime);
      if (!timeRange) {
        errors.push(`Row ${i + 1}: Invalid start or end time`);
        continue;
      }

      if (
        hasScheduleOverlap(
          schedules,
          row.employeeid,
          row.date,
          row.starttime,
          row.endtime,
          undefined,
          importedSchedules
        )
      ) {
        errors.push(
          `Row ${i + 1}: Schedule overlaps with an existing schedule for employee ${row.employeeid}`
        );
        continue;
      }

      importedSchedules.push({
        employeeId: row.employeeid,
        employeeName: row.employeename,
        date: row.date,
        shiftType: row.shifttype as ShiftType,
        startTime: row.starttime,
        endTime: row.endtime,
        position: row.position,
        department: row.department,
        status: (row.status as ScheduleStatus) || 'scheduled',
        notes: row.notes || undefined,
        source: 'manual',
        isOverride: false,
      } as Schedule);
    } catch (error) {
      errors.push(
        `Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  return {
    kind: 'parsed' as const,
    importedSchedules,
    errors,
  };
};

const escapeCSVField = (value: string | null | undefined) => {
  const stringField = String(value || '');
  if (stringField.includes(',') || stringField.includes('"')) {
    return `"${stringField.replace(/"/g, '""')}"`;
  }
  return stringField;
};

export const buildSchedulesCsv = (schedules: Schedule[]) => {
  const headers = [
    'employeeId',
    'employeeName',
    'date',
    'shiftType',
    'startTime',
    'endTime',
    'position',
    'department',
    'status',
    'notes',
  ];

  return [
    headers.join(','),
    ...schedules.map((schedule) => {
      return [
        schedule.employeeId,
        schedule.employeeName,
        schedule.date,
        schedule.shiftType,
        schedule.startTime,
        schedule.endTime,
        schedule.position,
        schedule.department,
        schedule.status,
        schedule.notes || '',
      ]
        .map((field) => escapeCSVField(String(field)))
        .join(',');
    }),
  ].join('\n');
};
