import { ProductsPage } from '@/modules/clothing/operations/products/components/ProductsPage';
import { ProductsErrorBoundary } from '@/modules/clothing/operations/products/components/ProductsErrorBoundary';

type ProductsRoutePageProps = {
  apiBasePath?: string;
};

export function ProductsRoutePage(props: ProductsRoutePageProps) {
  const { apiBasePath } = props;

  return (
    <ProductsErrorBoundary>
      <ProductsPage apiBasePath={apiBasePath} />
    </ProductsErrorBoundary>
  );
}
