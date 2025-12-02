import { createCustomerRoutes } from '@/modules/customers/api/routeFactory';
import { customerService } from '@/modules/customers/api/service';

const { GET, PUT, POST, DELETE } = createCustomerRoutes({
  service: customerService,
  loggerScope: 'Customers',
});

export { GET, PUT, POST, DELETE };
