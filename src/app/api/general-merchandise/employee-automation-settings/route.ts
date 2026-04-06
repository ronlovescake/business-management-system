import {
  createGeneralMerchandiseEmployeeAutomationRun,
  getGeneralMerchandiseEmployeeAutomationOverview,
  getGeneralMerchandiseEmployeeAutomationSettings,
  updateGeneralMerchandiseEmployeeAutomationSettings,
} from '@/lib/settings/generalMerchandiseEmployeeAutomation';
import { createEmployeeAutomationSettingsRoutes } from '@/modules/shared/employees/api/employeeAutomationRouteFactory';

const { GET, PUT, POST } = createEmployeeAutomationSettingsRoutes({
  domain: 'general-merchandise',
  createRun: createGeneralMerchandiseEmployeeAutomationRun,
  getOverview: getGeneralMerchandiseEmployeeAutomationOverview,
  getSettings: getGeneralMerchandiseEmployeeAutomationSettings,
  updateSettings: updateGeneralMerchandiseEmployeeAutomationSettings,
});

export { GET, PUT, POST };
