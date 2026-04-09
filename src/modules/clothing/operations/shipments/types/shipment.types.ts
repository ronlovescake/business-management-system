/**
 * Shipments Module - Type Definitions
 *
 * This file contains all TypeScript interfaces, types, and constants
 * for the Shipments module.
 */

import type { GridColumn } from '@glideapps/glide-data-grid';

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * ShipmentData - Represents a single shipment record
 *
 * @property id - Unique identifier for the shipment
 * @property Shipment Code - Primary identifier, searchable, double-click editable
 * @property CV Number - Commercial vehicle number
 * @property No. Of Sacks - Quantity in sacks
 * @property Total CBM - Total cubic meters
 * @property Weight - Weight in kilograms
 * @property Fee - Fee in Philippine Peso (₱)
 * @property Shipment Status - Current status (7 options)
 * @property Date Created - Creation date (formatted: "MMM d, yyyy")
 * @property Date Delivered - Delivery date (formatted: "MMM d, yyyy")
 * @property Duration - **CALCULATED** - Days between dates
 * @property Notes - Optional notes
 */
export interface ShipmentData {
  id: number;
  'Shipment Code': string;
  'CV Number': string;
  'No. Of Sacks': number;
  'Total CBM': number;
  Weight: number;
  Fee: number | string;
  'Shipment Status': string;
  'Date Created': string;
  'Date Delivered': string;
  Duration: string;
  Notes: string;

  /** Derived from Products table: number of non-deleted Products with this shipmentCode. */
  linkedProductCount?: number;
  /** Convenience flag derived from linkedProductCount. */
  hasLinkedProducts?: boolean;
  /** Derived from Products table: sum of Product COGS for this shipmentCode. */
  linkedProductCogsTotal?: number;
  /** Derived from Products: sum of grandTotal (supplier cost) for this shipmentCode. */
  linkedProductGrandTotal?: number;
  /** Derived from Products: sum of forwardersFee for this shipmentCode. */
  linkedProductForwardersFee?: number;
  /** Derived from Products: sum of lalamove (courier) for this shipmentCode. */
  linkedProductLalamove?: number;
  /** Derived from Products: sum of packagingCost for this shipmentCode. */
  linkedProductPackagingCost?: number;
}

/**
 * ShipmentFormData - Form input data for add/edit modals
 *
 * Used for both Add and Edit shipment forms.
 * Dates are Date objects in forms, converted to strings for API.
 */
export interface ShipmentFormData {
  shipmentCode: string; // Required
  cvNumber: string; // Optional
  noOfSacks: number; // Required, min: 0
  totalCBM: number; // Required, min: 0, 2 decimals
  weight: number; // Required, min: 0, 2 decimals
  fee: number; // Required, min: 0, 2 decimals
  shipmentStatus: string; // Required, dropdown
  dateCreated: Date | null; // Required, DateInput
  dateDelivered: Date | null; // Optional, DateInput
  notes: string; // Optional, Textarea
}

/**
 * ShipmentStatistics - Calculated statistics from shipments data
 *
 * All statistics are dynamically calculated from filtered data.
 */
export interface ShipmentStatistics {
  // Aggregate Metrics
  totalShipments: number;
  totalFees: number;
  totalSacks: number;
  totalCBM: number;
  totalWeight: number;

  // Status-Specific Counts
  inTransitShipments: number;
  manilaPortShipments: number;
  withPierGatepassShipments: number;
  phWarehouseShipments: number;
  forPickupShipments: number;
  deliveredShipments: number;
}

/**
 * ValidationResult - Result of form validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * API Request/Response Types
 */
export interface CreateShipmentRequest {
  shipment: ShipmentData;
}

export interface UpdateShipmentRequest {
  id: number;
  shipment: ShipmentData;
}

export interface BulkImportRequest {
  shipments: ShipmentData[];
}

export interface ShipmentResponse {
  success: boolean;
  data?: ShipmentData | ShipmentData[];
  error?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * SHIPMENT_STATUS_OPTIONS - Available shipment status values
 *
 * Status Flow:
 * In Transit → Manila Port → With Pier Gatepass → PH Warehouse → For Pickup/Sorting → Delivered
 */
export const SHIPMENT_STATUS_OPTIONS = [
  'In Transit',
  'Manila Port',
  'With Pier Gatepass',
  'PH Warehouse',
  'For Pickup',
  'Sorting', // Integration with Sorting Distribution module
  'Delivered',
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUS_OPTIONS)[number];

/**
 * COLUMN_ALIGNMENTS - Alignment configuration for each column
 */
export const COLUMN_ALIGNMENTS: Record<string, 'left' | 'center' | 'right'> = {
  shipmentCode: 'left',
  cvNumber: 'left',
  noOfSacks: 'right',
  totalCBM: 'right',
  weight: 'right',
  fee: 'right',
  shipmentStatus: 'center',
  dateCreated: 'center',
  dateDelivered: 'center',
  duration: 'center',
  notes: 'left',
};

/**
 * ID_TO_KEY - Maps column IDs to ShipmentData keys
 */
export const ID_TO_KEY: Record<string, keyof ShipmentData> = {
  shipmentCode: 'Shipment Code',
  cvNumber: 'CV Number',
  noOfSacks: 'No. Of Sacks',
  totalCBM: 'Total CBM',
  weight: 'Weight',
  fee: 'Fee',
  shipmentStatus: 'Shipment Status',
  dateCreated: 'Date Created',
  dateDelivered: 'Date Delivered',
  duration: 'Duration',
  notes: 'Notes',
};

/**
 * GRID_COLUMNS - Column configuration for Glide Data Grid
 */
export const GRID_COLUMNS: GridColumn[] = [
  { title: 'Shipment Code', width: 200, id: 'shipmentCode' },
  { title: 'CV Number', width: 200, id: 'cvNumber' },
  { title: 'No. Of Sacks', width: 200, id: 'noOfSacks' },
  { title: 'Total CBM', width: 200, id: 'totalCBM' },
  { title: 'Weight', width: 200, id: 'weight' },
  { title: 'Fee', width: 200, id: 'fee' },
  { title: 'Shipment Status', width: 200, id: 'shipmentStatus' },
  { title: 'Date Created', width: 200, id: 'dateCreated' },
  { title: 'Date Delivered', width: 200, id: 'dateDelivered' },
  { title: 'Duration', width: 200, id: 'duration' },
  { title: 'Notes', width: 200, grow: 1, id: 'notes' }, // Last column grows
];

/**
 * SEARCH_FIELDS - Fields to search in shipments data
 */
export const SEARCH_FIELDS: Array<keyof ShipmentData> = [
  'Shipment Code',
  'CV Number',
  'Shipment Status',
  'Notes',
];

/**
 * DOUBLE_CLICK_WINDOW_MS - Time window (ms) for double-click detection
 */
export const DOUBLE_CLICK_WINDOW_MS = 500;

/**
 * API_REVALIDATION_SECONDS - API cache revalidation time
 */
export const API_REVALIDATION_SECONDS = 30;

/**
 * FORM_VALIDATION_RULES - Validation rules for form fields
 */
export const FORM_VALIDATION_RULES = {
  shipmentCode: {
    required: true,
    message: 'Shipment Code is required',
  },
  shipmentStatus: {
    required: true,
    message: 'Shipment Status is required',
  },
  noOfSacks: {
    required: true,
    min: 0,
    messageRequired: 'Number of sacks is required',
    messageMin: 'Number of sacks must be positive',
  },
  totalCBM: {
    required: true,
    min: 0,
    messageRequired: 'Total CBM is required',
    messageMin: 'Total CBM must be positive',
  },
  weight: {
    required: true,
    min: 0,
    messageRequired: 'Weight is required',
    messageMin: 'Weight must be positive',
  },
  fee: {
    required: true,
    min: 0,
    messageRequired: 'Fee is required',
    messageMin: 'Fee must be positive',
  },
  dateCreated: {
    required: true,
    message: 'Date Created is required',
  },
} as const;
