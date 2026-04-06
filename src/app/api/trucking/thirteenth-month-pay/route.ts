import { thirteenthMonthPayService } from '@/modules/trucking/employees/thirteenth-month-pay/api';
import { createThirteenthMonthPayRoutes } from '@/modules/shared/employees/api/thirteenthMonthPayRouteFactory';

const { GET, PATCH } = createThirteenthMonthPayRoutes(
  thirteenthMonthPayService
);

export { GET, PATCH };
