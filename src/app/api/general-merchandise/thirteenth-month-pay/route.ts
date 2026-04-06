import { generalMerchandiseThirteenthMonthPayService } from './serviceAdapter';
import { createThirteenthMonthPayRoutes } from '@/modules/shared/employees/api/thirteenthMonthPayRouteFactory';

const { GET, PATCH } = createThirteenthMonthPayRoutes(
  generalMerchandiseThirteenthMonthPayService
);

export { GET, PATCH };
