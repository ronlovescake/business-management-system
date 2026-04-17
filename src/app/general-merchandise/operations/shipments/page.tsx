/**
 * GM Shipments Page Route Handler
 */

import { ShipmentsRoutePage } from '@/app/operations/shipments/_shared/ShipmentsRoutePage';
import { renderOperationsPage } from '@/app/operations/_shared/renderOperationsPage';

export default async function Page() {
  return renderOperationsPage(
    '/general-merchandise/operations/shipments',
    <ShipmentsRoutePage apiBasePath="/api/general-merchandise" />
  );
}
