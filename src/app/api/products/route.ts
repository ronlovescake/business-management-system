import { createProductRoutes } from '@/modules/products/api/routeFactory';
import { productService } from '@/modules/products/api/service';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const { GET, POST, PUT, DELETE } = createProductRoutes({
  service: productService,
  loggerScope: 'Products',
});

export { GET, POST, PUT, DELETE };
