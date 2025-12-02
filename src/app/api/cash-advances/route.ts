import { createCashAdvanceRoutes } from '@/modules/employees/cash-advance/api/routeFactory';
import {
  cashAdvanceService,
  CashAdvanceQuerySchema,
  CashAdvanceCreateSchema,
  CashAdvanceUpdateSchema,
} from '@/modules/clothing/employees/cash-advance/api';

const { GET, POST, PUT, DELETE } = createCashAdvanceRoutes({
  service: cashAdvanceService,
  schemas: {
    query: CashAdvanceQuerySchema,
    create: CashAdvanceCreateSchema,
    update: CashAdvanceUpdateSchema,
  },
  loggerScope: 'Clothing cash advance',
});

export { GET, POST, PUT, DELETE };
