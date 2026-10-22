import { getCalculatedThirteenthMonthPayRecords } from '../calculatedRecords';
import { createThirteenthMonthPayCalculationRoute } from '@/modules/shared/employees/api/thirteenthMonthPayRouteFactory';

export const dynamic = 'force-dynamic';

export const GET = createThirteenthMonthPayCalculationRoute(
  getCalculatedThirteenthMonthPayRecords
);
