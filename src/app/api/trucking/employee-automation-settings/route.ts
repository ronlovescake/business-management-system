import {
  createTruckingEmployeeAutomationRun,
  getTruckingEmployeeAutomationOverview,
  getTruckingEmployeeAutomationSettings,
  updateTruckingEmployeeAutomationSettings,
} from '@/lib/settings/truckingEmployeeAutomation';
import { createEmployeeAutomationSettingsRoutes } from '@/modules/shared/employees/api/employeeAutomationRouteFactory';

const { GET, PUT, POST } = createEmployeeAutomationSettingsRoutes({
  domain: 'trucking',
  createRun: createTruckingEmployeeAutomationRun,
  getOverview: getTruckingEmployeeAutomationOverview,
  getSettings: getTruckingEmployeeAutomationSettings,
  updateSettings: updateTruckingEmployeeAutomationSettings,
});

export { GET, PUT, POST };
