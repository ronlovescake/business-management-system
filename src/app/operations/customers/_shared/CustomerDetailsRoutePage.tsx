'use client';

import { useParams } from 'next/navigation';
import { PageLayout } from '@/components/layout/PageLayout';
import { CustomerDetailsView } from '@/app/clothing/operations/customers/[id]/components/CustomerDetailsView';

interface CustomerDetailsRoutePageProps {
  apiBasePath?: string;
  customerApiBasePath?: string;
}

export function CustomerDetailsRoutePage({
  apiBasePath,
  customerApiBasePath,
}: CustomerDetailsRoutePageProps) {
  const params = useParams();

  if (!params || !params.id) {
    throw new Error('Customer id is required for CustomerDetailsPage');
  }

  const customerId = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <PageLayout fluid withPadding>
      <CustomerDetailsView
        customerId={customerId}
        apiBasePath={apiBasePath}
        customerApiBasePath={customerApiBasePath}
      />
    </PageLayout>
  );
}
