import type { RecurringRule, Schedule, ShiftType } from '../types';
import {
  generateId,
  parseDateInput,
  SHIFT_CONFIG,
  toDateKey,
} from './scheduleHookUtils';

export const generateSchedulesForRule = (
  rule: RecurringRule,
  overrides: Record<string, boolean>,
  stayInEmployees: Set<string>
): Schedule[] => {
  const start = parseDateInput(rule.startDate);
  const end = rule.endDate
    ? parseDateInput(rule.endDate)
    : new Date(start.getFullYear(), start.getMonth() + 3, start.getDate());

  const schedulesForRule: Schedule[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    const dayOfWeek = cursor.getDay();
    const includeSunday = rule.daysOfWeek.includes(0);
    if (dayOfWeek === 0 && !includeSunday) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    if (rule.daysOfWeek.includes(dayOfWeek)) {
      const dateStr = toDateKey(cursor);
      if (!overrides[dateStr]) {
        const stayIn = rule.isStayIn || stayInEmployees.has(rule.employeeId);
        const shiftType = stayIn ? ('full-day' as ShiftType) : rule.shiftType;
        const defaults = SHIFT_CONFIG[shiftType];

        schedulesForRule.push({
          id: generateId(),
          employeeId: rule.employeeId,
          employeeName: rule.employeeName,
          date: dateStr,
          shiftType,
          startTime: defaults.start,
          break1: rule.break1,
          lunch: rule.lunch,
          break2: rule.break2,
          endTime: defaults.end,
          position: rule.position,
          department: rule.department,
          status: 'scheduled',
          notes: rule.notes,
          source: 'recurrence',
          recurrenceId: rule.id,
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return schedulesForRule;
};
