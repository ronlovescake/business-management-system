'use client';

import { useParams } from 'next/navigation';
import { PageLayout } from '@/components/layout/PageLayout';
import { CustomerDetailsView } from '@/app/clothing/operations/customers/[id]/components/CustomerDetailsView';

export default function CustomerDetailsPage() {
  const params = useParams();

  if (!params || !params.id) {
    throw new Error('Customer id is required for CustomerDetailsPage');
  }

  const customerId = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <PageLayout fluid withPadding>
      <CustomerDetailsView customerId={customerId} />
    </PageLayout>
  );
}
