export const EMPLOYEE_AUTOMATION_TYPES = [
  'stay-in-attendance',
  'payroll-generation',
] as const;

export type EmployeeAutomationType = (typeof EMPLOYEE_AUTOMATION_TYPES)[number];

export const EMPLOYEE_AUTOMATION_TRIGGER_SOURCES = [
  'manual',
  'scheduler',
] as const;

export type EmployeeAutomationTriggerSource =
  (typeof EMPLOYEE_AUTOMATION_TRIGGER_SOURCES)[number];

export const EMPLOYEE_AUTOMATION_STATUSES = [
  'success',
  'skipped',
  'error',
] as const;

export type EmployeeAutomationStatus =
  (typeof EMPLOYEE_AUTOMATION_STATUSES)[number];

export interface EmployeeAutomationSettings {
  stayInAutoPresenceEnabled: boolean;
  stayInAutoPresenceTime: string;
  stayInAutoPresenceTimezone: string;
  stayInAutoPresenceGraceMinutes: number;
  payrollAutoGenerationEnabled: boolean;
  payrollAutoGenerationTime: string;
  payrollAutoGenerationTimezone: string;
  payrollAutoGenerationCutoffDays: number[];
}

export interface EmployeeAutomationSettingsUpdate {
  stayInAutoPresenceEnabled?: boolean;
  stayInAutoPresenceTime?: string;
  stayInAutoPresenceTimezone?: string;
  stayInAutoPresenceGraceMinutes?: number;
  payrollAutoGenerationEnabled?: boolean;
  payrollAutoGenerationTime?: string;
  payrollAutoGenerationTimezone?: string;
  payrollAutoGenerationCutoffDays?: number[];
}

export interface EmployeeAutomationRunRecord {
  id: string;
  createdAt: string;
  automationType: EmployeeAutomationType;
  triggerSource: EmployeeAutomationTriggerSource;
  status: EmployeeAutomationStatus;
  periodKey: string | null;
  targetDate: string | null;
  payrollPeriodStart: string | null;
  payrollPeriodEnd: string | null;
  message: string | null;
  processed: number;
  inserted: number;
  skipped: number;
  triggeredByUserId: string | null;
  triggeredByUserName: string | null;
  metadata?: unknown;
}

export interface EmployeeAutomationOverview {
  settings: EmployeeAutomationSettings;
  history: EmployeeAutomationRunRecord[];
}

export interface EmployeeAutomationExecutionResult {
  automationType: EmployeeAutomationType;
  status: EmployeeAutomationStatus;
  message: string;
  processed?: number;
  inserted?: number;
  skipped?: number;
  periodKey?: string | null;
  targetDate?: string | null;
  payrollPeriodStart?: string | null;
  payrollPeriodEnd?: string | null;
  metadata?: unknown;
}
