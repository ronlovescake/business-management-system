import type { ComponentType } from 'react';

/**
 * Icon component type for module registration
 */
export type IconComponent = ComponentType<{ size?: number; stroke?: number }>;

/**
 * Core customer data structure
 */
export interface CustomerData {
  id?: number;
  Date: string;
  'Customer Name': string;
  'Phone Number': string;
  Address: string;
  Facebook: string;
  'Email Address': string;
  'Business Name': string;
  'Tax Number': string;
  'Business Address': string;
  'Business Contact Number': string;
  'Customer Status': string;
}

/**
 * Customer form data (used in Add Customer modal)
 */
export interface CustomerFormData {
  customerName: string;
  phoneNumber: string;
  address: string;
  facebook: string;
  emailAddress: string;
  businessName: string;
  taxNumber: string;
  businessAddress: string;
  businessContactNumber: string;
  customerStatus: string;
}

/**
 * Customer statistics for dashboard cards
 */
export interface CustomerStats {
  total: number;
  filtered: number;
  uniqueBusinesses: number;
  contactable: number;
  contactablePct: number;
}

/**
 * Customer validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Customer status options
 */
export type CustomerStatus =
  | 'Active'
  | 'Inactive'
  | 'Prospect'
  | 'VIP'
  | 'Banned';

/**
 * Customer status option for dropdown
 */
export interface CustomerStatusOption {
  label: string;
  value: CustomerStatus;
}

/**
 * CSV import result
 */
export interface CSVImportResult {
  success: boolean;
  data?: CustomerData[];
  error?: string;
  rowsImported?: number;
}

/**
 * Customer with search index (for performance optimization)
 */
export interface CustomerWithSearchIndex extends CustomerData {
  _searchIndex: string;
}

/**
 * Grid column mapping
 */
export type CustomerColumnKey = keyof Omit<CustomerData, 'id'>;

/**
 * API response types
 */
export interface CustomersAPIResponse {
  data: CustomerData[];
  total: number;
}

export interface CustomerAPIError {
  error: string;
  details?: string;
}
