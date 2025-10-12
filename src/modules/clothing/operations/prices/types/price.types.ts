import { ComponentType } from 'react';

/**
 * Icon component type for module registration
 */
export type IconComponent = ComponentType<{ size?: number; stroke?: number }>;

/**
 * Core price data structure
 */
export interface PriceData {
  id?: number;
  'Product Code': string;
  'Lower Limit': number;
  'Upper Limit': number;
  Prices: number;
  'Price Adjustment': number;
}

/**
 * Price tier for new price form (multi-tier pricing)
 */
export interface PriceTier {
  lowerLimit: number;
  upperLimit: number;
  price: number;
}

/**
 * Price form data (used in Add/Edit Price modal)
 */
export interface PriceFormData {
  productCode: string;
  tiers: PriceTier[];
  priceAdjustment: number;
}

/**
 * Price statistics for dashboard cards
 */
export interface PriceStats {
  total: number;
  filtered: number;
  avgPrice: number;
  totalAdjustments: number;
  priceIncreases: number;
  priceDecreases: number;
}

/**
 * Bulk price adjustment configuration
 */
export interface BulkAdjustmentConfig {
  type: 'percentage' | 'fixed';
  value: number;
  applyTo: 'all' | 'filtered';
}

/**
 * Price validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * CSV import result
 */
export interface CSVImportResult {
  success: boolean;
  data?: PriceData[];
  error?: string;
  rowsImported?: number;
}

/**
 * Price with search index (for performance optimization)
 */
export interface PriceWithSearchIndex extends PriceData {
  _searchIndex: string;
}

/**
 * Grid column mapping
 */
export type PriceColumnKey = keyof Omit<PriceData, 'id'>;

/**
 * API response types
 */
export interface PricesAPIResponse {
  data: PriceData[];
  total: number;
}

export interface PriceAPIError {
  error: string;
  details?: string;
}

/**
 * Price adjustment history entry
 */
export interface PriceAdjustmentHistory {
  timestamp: Date;
  type: 'percentage' | 'fixed';
  value: number;
  affectedRows: number;
}
