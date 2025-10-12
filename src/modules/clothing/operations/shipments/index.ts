/**
 * Shipments Module - Public API
 *
 * This file exports all public-facing components, hooks, services, and types
 * for the Shipments module.
 */

// ============================================================================
// COMPONENTS
// ============================================================================

export { ShipmentsPage } from './components/ShipmentsPage';
export { AddShipmentModal } from './components/AddShipmentModal';
export { EditShipmentModal } from './components/EditShipmentModal';

// ============================================================================
// HOOKS
// ============================================================================

export { useShipmentsData } from './hooks/useShipmentsData';
export { useShipmentForm } from './hooks/useShipmentForm';

// ============================================================================
// SERVICES
// ============================================================================

export { ShipmentService } from './services/ShipmentService';

// ============================================================================
// TYPES
// ============================================================================

export type {
  ShipmentData,
  ShipmentFormData,
  ShipmentStatistics,
  ValidationResult,
  ShipmentStatus,
  CreateShipmentRequest,
  UpdateShipmentRequest,
  BulkImportRequest,
  ShipmentResponse,
} from './types/shipment.types';

// ============================================================================
// CONSTANTS
// ============================================================================

export {
  SHIPMENT_STATUS_OPTIONS,
  COLUMN_ALIGNMENTS,
  ID_TO_KEY,
  GRID_COLUMNS,
  SEARCH_FIELDS,
  DOUBLE_CLICK_WINDOW_MS,
  API_REVALIDATION_SECONDS,
  FORM_VALIDATION_RULES,
} from './types/shipment.types';

// ============================================================================
// MODULE CONFIGURATION
// ============================================================================

export { shipmentsModule } from './module.config';
