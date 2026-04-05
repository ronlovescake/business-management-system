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

const settingsDelegate = prisma.generalMerchandiseEmployeeAutomationSetting;
const runDelegate = prisma.generalMerchandiseEmployeeAutomationRun;

export type GeneralMerchandiseEmployeeAutomationSettings =
  EmployeeAutomationSettings;
export type GeneralMerchandiseEmployeeAutomationSettingsUpdate =
  EmployeeAutomationSettingsUpdate;

export async function getGeneralMerchandiseEmployeeAutomationSettings(): Promise<GeneralMerchandiseEmployeeAutomationSettings> {
  return readEmployeeAutomationSettings(settingsDelegate);
}

export async function getGeneralMerchandiseEmployeeAutomationOverview(): Promise<EmployeeAutomationOverview> {
  return readEmployeeAutomationOverview(settingsDelegate, runDelegate);
}

export async function updateGeneralMerchandiseEmployeeAutomationSettings(
  input: GeneralMerchandiseEmployeeAutomationSettingsUpdate
): Promise<GeneralMerchandiseEmployeeAutomationSettings> {
  return saveEmployeeAutomationSettings(settingsDelegate, input);
}

export async function createGeneralMerchandiseEmployeeAutomationRun(
  result: EmployeeAutomationExecutionResult,
  triggerSource: EmployeeAutomationTriggerSource,
  actor?: {
    userId?: string | null;
    userName?: string | null;
  }
): Promise<EmployeeAutomationRunRecord> {
  return recordEmployeeAutomationRun(runDelegate, result, triggerSource, actor);
}

export async function hasGeneralMerchandiseEmployeeAutomationRunForPeriod(
  automationType: EmployeeAutomationRunRecord['automationType'],
  periodKey: string
): Promise<boolean> {
  return hasRecordedAutomationRunForPeriod(
    runDelegate,
    automationType,
    periodKey
  );
}

export async function findGeneralMerchandiseEmployeeAutomationRunForPeriod(
  automationType: EmployeeAutomationRunRecord['automationType'],
  periodKey: string
): Promise<EmployeeAutomationRunRecord | null> {
  return findRecordedAutomationRunForPeriod(
    runDelegate,
    automationType,
    periodKey
  );
}

export function getDefaultGeneralMerchandiseEmployeeAutomationSettings(): GeneralMerchandiseEmployeeAutomationSettings {
  return { ...DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS };
}
