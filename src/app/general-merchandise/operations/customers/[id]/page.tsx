'use client';

import { CustomerDetailsRoutePage } from '@/app/operations/customers/_shared/CustomerDetailsRoutePage';

export default function CustomerDetailsPage() {
  return (
    <CustomerDetailsRoutePage
      apiBasePath="/api/general-merchandise"
      customerApiBasePath="/api"
    />
  );
}
