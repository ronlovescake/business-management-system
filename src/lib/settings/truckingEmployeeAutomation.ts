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

const settingsDelegate = prisma.truckingEmployeeAutomationSetting;
const runDelegate = prisma.truckingEmployeeAutomationRun;

export type TruckingEmployeeAutomationSettings = EmployeeAutomationSettings;
export type TruckingEmployeeAutomationSettingsUpdate =
  EmployeeAutomationSettingsUpdate;

export async function getTruckingEmployeeAutomationSettings(): Promise<TruckingEmployeeAutomationSettings> {
  return readEmployeeAutomationSettings(settingsDelegate);
}

export async function getTruckingEmployeeAutomationOverview(): Promise<EmployeeAutomationOverview> {
  return readEmployeeAutomationOverview(settingsDelegate, runDelegate);
}

export async function updateTruckingEmployeeAutomationSettings(
  input: TruckingEmployeeAutomationSettingsUpdate
): Promise<TruckingEmployeeAutomationSettings> {
  return saveEmployeeAutomationSettings(settingsDelegate, input);
}

export async function createTruckingEmployeeAutomationRun(
  result: EmployeeAutomationExecutionResult,
  triggerSource: EmployeeAutomationTriggerSource,
  actor?: {
    userId?: string | null;
    userName?: string | null;
  }
): Promise<EmployeeAutomationRunRecord> {
  return recordEmployeeAutomationRun(runDelegate, result, triggerSource, actor);
}

export async function hasTruckingEmployeeAutomationRunForPeriod(
  automationType: EmployeeAutomationRunRecord['automationType'],
  periodKey: string
): Promise<boolean> {
  return hasRecordedAutomationRunForPeriod(
    runDelegate,
    automationType,
    periodKey
  );
}

export async function findTruckingEmployeeAutomationRunForPeriod(
  automationType: EmployeeAutomationRunRecord['automationType'],
  periodKey: string
): Promise<EmployeeAutomationRunRecord | null> {
  return findRecordedAutomationRunForPeriod(
    runDelegate,
    automationType,
    periodKey
  );
}

export function getDefaultTruckingEmployeeAutomationSettings(): TruckingEmployeeAutomationSettings {
  return { ...DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS };
}
