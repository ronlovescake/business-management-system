'use client';

import type {
  EmployeeAutomationRunRecord,
  EmployeeAutomationSettings,
  EmployeeAutomationSettingsUpdate,
  EmployeeAutomationType,
} from '@/modules/shared/employees/automation/types';

export const SETTINGS_API_PATH = '/employee-automation-settings';

export const FALLBACK_SETTINGS: EmployeeAutomationSettings = {
  stayInAutoPresenceEnabled: true,
  stayInAutoPresenceTime: '02:00',
  stayInAutoPresenceTimezone: 'Asia/Manila',
  stayInAutoPresenceGraceMinutes: 0,
  payrollAutoGenerationEnabled: false,
  payrollAutoGenerationTime: '02:00',
  payrollAutoGenerationTimezone: 'Asia/Manila',
  payrollAutoGenerationCutoffDays: [],
};

export const AUTOMATION_LABELS: Record<EmployeeAutomationType, string> = {
  'stay-in-attendance': 'Stay-in Attendance',
  'payroll-generation': 'Payroll Generation',
};

export const END_OF_MONTH_CUTOFF_DAY = 31;

export type SettingsKey = keyof EmployeeAutomationSettings;

export function areCutoffDaysEqual(left: number[], right: number[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function formatOrdinal(value: number) {
  const modTen = value % 10;
  const modHundred = value % 100;

  if (modTen === 1 && modHundred !== 11) {
    return `${value}st`;
  }

  if (modTen === 2 && modHundred !== 12) {
    return `${value}nd`;
  }

  if (modTen === 3 && modHundred !== 13) {
    return `${value}rd`;
  }

  return `${value}th`;
}

export function formatCutoffDayLabel(value: number) {
  if (value === END_OF_MONTH_CUTOFF_DAY) {
    return 'End of month';
  }

  return formatOrdinal(value);
}

export function formatCutoffSummary(cutoffDays: number[]) {
  if (cutoffDays.length === 0) {
    return 'No cutoff dates configured yet.';
  }

  return cutoffDays.map((day) => formatCutoffDayLabel(day)).join(', ');
}

export function getStatusColor(status: EmployeeAutomationRunRecord['status']) {
  if (status === 'success') {
    return 'green';
  }

  if (status === 'error') {
    return 'red';
  }

  return 'yellow';
}

export function getTriggerColor(
  triggerSource: EmployeeAutomationRunRecord['triggerSource']
) {
  return triggerSource === 'manual' ? 'blue' : 'gray';
}

export function formatRunTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

export function formatRunTarget(run: EmployeeAutomationRunRecord) {
  if (run.automationType === 'stay-in-attendance') {
    return run.targetDate ?? 'Not specified';
  }

  if (run.payrollPeriodStart && run.payrollPeriodEnd) {
    return `${run.payrollPeriodStart} to ${run.payrollPeriodEnd}`;
  }

  return run.periodKey ?? 'Not specified';
}

export function buildUpdatePayload(
  initial: EmployeeAutomationSettings | null,
  draft: EmployeeAutomationSettings
): EmployeeAutomationSettingsUpdate {
  const payload: EmployeeAutomationSettingsUpdate = {};

  if (
    !initial ||
    draft.stayInAutoPresenceEnabled !== initial.stayInAutoPresenceEnabled
  ) {
    payload.stayInAutoPresenceEnabled = draft.stayInAutoPresenceEnabled;
  }

  if (
    !initial ||
    draft.stayInAutoPresenceTime !== initial.stayInAutoPresenceTime
  ) {
    payload.stayInAutoPresenceTime = draft.stayInAutoPresenceTime;
  }

  if (
    !initial ||
    draft.stayInAutoPresenceTimezone !== initial.stayInAutoPresenceTimezone
  ) {
    payload.stayInAutoPresenceTimezone = draft.stayInAutoPresenceTimezone;
  }

  if (
    !initial ||
    draft.stayInAutoPresenceGraceMinutes !==
      initial.stayInAutoPresenceGraceMinutes
  ) {
    payload.stayInAutoPresenceGraceMinutes =
      draft.stayInAutoPresenceGraceMinutes;
  }

  if (
    !initial ||
    draft.payrollAutoGenerationEnabled !== initial.payrollAutoGenerationEnabled
  ) {
    payload.payrollAutoGenerationEnabled = draft.payrollAutoGenerationEnabled;
  }

  if (
    !initial ||
    draft.payrollAutoGenerationTime !== initial.payrollAutoGenerationTime
  ) {
    payload.payrollAutoGenerationTime = draft.payrollAutoGenerationTime;
  }

  if (
    !initial ||
    draft.payrollAutoGenerationTimezone !==
      initial.payrollAutoGenerationTimezone
  ) {
    payload.payrollAutoGenerationTimezone = draft.payrollAutoGenerationTimezone;
  }

  if (
    !initial ||
    !areCutoffDaysEqual(
      draft.payrollAutoGenerationCutoffDays,
      initial.payrollAutoGenerationCutoffDays
    )
  ) {
    payload.payrollAutoGenerationCutoffDays =
      draft.payrollAutoGenerationCutoffDays;
  }

  return payload;
}
