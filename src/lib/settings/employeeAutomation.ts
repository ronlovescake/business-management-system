import { prisma } from '@/lib/db';
import {
  DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS,
  findRecordedAutomationRunForPeriod,
  hasRecordedAutomationRunForPeriod,
  readEmployeeAutomationOverview,
  readEmployeeAutomationSettings,
  recordEmployeeAutomationRun,
  saveEmployeeAutomationSettings,
  type EmployeeAutomationExecutionResult,
  type EmployeeAutomationOverview,
  type EmployeeAutomationRunRecord,
  type EmployeeAutomationSettings,
  type EmployeeAutomationSettingsUpdate,
  type EmployeeAutomationTriggerSource,
} from '@/modules/shared/employees/automation';

const settingsDelegate = prisma.employeeAutomationSetting;
const runDelegate = prisma.employeeAutomationRun;

export type {
  EmployeeAutomationExecutionResult,
  EmployeeAutomationOverview,
  EmployeeAutomationRunRecord,
  EmployeeAutomationSettings,
  EmployeeAutomationSettingsUpdate,
  EmployeeAutomationTriggerSource,
} from '@/modules/shared/employees/automation';

export async function getEmployeeAutomationSettings(): Promise<EmployeeAutomationSettings> {
  return readEmployeeAutomationSettings(settingsDelegate);
}

export async function getEmployeeAutomationOverview(): Promise<EmployeeAutomationOverview> {
  return readEmployeeAutomationOverview(settingsDelegate, runDelegate);
}

export async function updateEmployeeAutomationSettings(
  input: EmployeeAutomationSettingsUpdate
): Promise<EmployeeAutomationSettings> {
  return saveEmployeeAutomationSettings(settingsDelegate, input);
}

export async function createEmployeeAutomationRun(
  result: EmployeeAutomationExecutionResult,
  triggerSource: EmployeeAutomationTriggerSource,
  actor?: {
    userId?: string | null;
    userName?: string | null;
  }
): Promise<EmployeeAutomationRunRecord> {
  return recordEmployeeAutomationRun(runDelegate, result, triggerSource, actor);
}

export async function hasEmployeeAutomationRunForPeriod(
  automationType: EmployeeAutomationRunRecord['automationType'],
  periodKey: string
): Promise<boolean> {
  return hasRecordedAutomationRunForPeriod(
    runDelegate,
    automationType,
    periodKey
  );
}

export async function findEmployeeAutomationRunForPeriod(
  automationType: EmployeeAutomationRunRecord['automationType'],
  periodKey: string
): Promise<EmployeeAutomationRunRecord | null> {
  return findRecordedAutomationRunForPeriod(
    runDelegate,
    automationType,
    periodKey
  );
}

export function getDefaultEmployeeAutomationSettings(): EmployeeAutomationSettings {
  return { ...DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS };
}
