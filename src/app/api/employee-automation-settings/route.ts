import {
  createEmployeeAutomationRun,
  getEmployeeAutomationOverview,
  getEmployeeAutomationSettings,
  updateEmployeeAutomationSettings,
} from '@/lib/settings/employeeAutomation';
import { createEmployeeAutomationSettingsRoutes } from '@/modules/shared/employees/api/employeeAutomationRouteFactory';

const { GET, PUT, POST } = createEmployeeAutomationSettingsRoutes({
  domain: 'clothing',
  createRun: createEmployeeAutomationRun,
  getOverview: getEmployeeAutomationOverview,
  getSettings: getEmployeeAutomationSettings,
  updateSettings: updateEmployeeAutomationSettings,
});

export { GET, PUT, POST };
