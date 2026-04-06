import { thirteenthMonthPayService } from '@/modules/clothing/employees/thirteenth-month-pay/api';
import { createThirteenthMonthPayRoutes } from '@/modules/shared/employees/api/thirteenthMonthPayRouteFactory';

const { GET, PATCH } = createThirteenthMonthPayRoutes(
  thirteenthMonthPayService
);

export { GET, PATCH };
