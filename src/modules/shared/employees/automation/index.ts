export {
  DEFAULT_EMPLOYEE_AUTOMATION_SETTINGS,
  findRecordedAutomationRunForPeriod,
  hasRecordedAutomationRunForPeriod,
  listEmployeeAutomationRuns,
  readEmployeeAutomationOverview,
  readEmployeeAutomationSettings,
  recordEmployeeAutomationRun,
  sanitizeEmployeeAutomationSettingsUpdate,
  saveEmployeeAutomationSettings,
} from './settingsService';

export {
  STAY_IN_ATTENDANCE_LOOKBACK_DAYS,
  buildRollingDateRange,
} from './stayInBackfill';

export { normalizePayrollCutoffDays } from './payrollCutoffDays';

export {
  executeDueAutomations,
  executePayrollAutomation,
  executeStayInAutomation,
} from './execution';

export type { EmployeeAutomationDomain } from './execution';

export type {
  EmployeeAutomationExecutionResult,
  EmployeeAutomationOverview,
  EmployeeAutomationRunRecord,
  EmployeeAutomationSettings,
  EmployeeAutomationSettingsUpdate,
  EmployeeAutomationStatus,
  EmployeeAutomationTriggerSource,
  EmployeeAutomationType,
} from './types';
