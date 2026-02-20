/**
 * GM Shipments Page Route Handler
 */

import { ShipmentsRoutePage } from '@/app/operations/shipments/_shared/ShipmentsRoutePage';
import { renderGmOperationsPage } from '@/app/general-merchandise/operations/_shared/renderGmOperationsPage';

export default async function Page() {
  return renderGmOperationsPage(
    '/general-merchandise/operations/shipments',
    <ShipmentsRoutePage apiBasePath="/api/general-merchandise" />
  );
}
