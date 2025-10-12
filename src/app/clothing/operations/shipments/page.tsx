/**
 * Shipments Page Route Handler
 *
 * This is a thin wrapper that imports the Shipments module and renders
 * the main ShipmentsPage component. All business logic, state management,
 * and UI components are organized in the module structure.
 *
 * Module Location: @/modules/clothing/operations/shipments
 *
 * Features:
 * - 11-column data grid (Shipment Code, CV Number, No. Of Sacks, Total CBM,
 *   Weight, Fee, Shipment Status, Date Created, Date Delivered, Duration, Notes)
 * - 11 statistics cards (Total Shipments, Total Fees, Total Sacks, Total CBM,
 *   Total Weight, In Transit, Manila Port, With Pier Gatepass, PH Warehouse,
 *   For Pickup, Delivered)
 * - Add/Edit shipments via modal forms (10 input fields)
 * - Double-click edit on Shipment Code column (500ms detection window)
 * - Duration auto-calculation (days between dates)
 * - CSV bulk import with duration auto-calculation
 * - Search functionality (Shipment Code, CV Number, Status, Notes)
 * - Optimistic UI updates for CRUD operations
 * - Memoized statistics (dynamic from filtered data)
 * - 30-second API revalidation
 *
 * API Endpoints:
 * - GET /api/shipments - Fetch all shipments
 * - POST /api/shipments - Create shipment(s)
 * - PUT /api/shipments/:id - Update shipment
 *
 * @returns {JSX.Element} The Shipments page component
 */

import { ShipmentsPage } from '@/modules/clothing/operations/shipments';

export default function Page() {
  return <ShipmentsPage />;
}
