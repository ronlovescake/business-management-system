import { thirteenthMonthPayService } from '@/modules/trucking/employees/thirteenth-month-pay/api';
import { createThirteenthMonthPayRoutes } from '@/modules/shared/employees/api/thirteenthMonthPayRouteFactory';
import { getCalculatedThirteenthMonthPayRecords } from './calculatedRecords';

const { GET, PATCH } = createThirteenthMonthPayRoutes(
  thirteenthMonthPayService,
  { calculateRecords: getCalculatedThirteenthMonthPayRecords }
);

export { GET, PATCH };
