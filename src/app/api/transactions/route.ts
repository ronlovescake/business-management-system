import { createTransactionRoutes } from '@/modules/transactions/api/routeFactory';
import { transactionService } from '@/modules/transactions/api/service';

const { GET, POST, PUT, PATCH, DELETE } = createTransactionRoutes({
  service: transactionService,
});

export { GET, POST, PUT, PATCH, DELETE };
