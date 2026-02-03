/**
 * GM Shipments Page Route Handler
 */

import { ShipmentsPage } from '@/modules/clothing/operations/shipments/components/ShipmentsPage';
import { ShipmentsErrorBoundary } from '@/app/clothing/operations/shipments/components/ShipmentsErrorBoundary';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/shipments',
    <ShipmentsErrorBoundary>
      <ShipmentsPage apiBasePath="/api/general-merchandise" />
    </ShipmentsErrorBoundary>
  );
}
