/**
 * Sorting Distribution Service
 *
 * Business logic for the Sorting Distribution module.
 * Handles data validation, calculations, API calls, and data transformations.
 */

import type {
  DistributionRow,
  Product,
  Transaction,
  SortingDistributionStatistics,
  SortingDistributionSaveResponse,
  ValidationResult,
} from '../types/sortingDistribution.types';
import {
  GRID_ROW_COUNT,
  DEFAULT_DISTRIBUTION_ROW,
  SORTING_SHIPMENT_STATUS,
} from '../types/sortingDistribution.types';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/client';

/**
 * Sorting Distribution Service
 * All methods are static - no instance needed
 */
export class SortingDistributionService {
  /**
   * Validate distribution data
   */
  static validateDistribution(
    rows: DistributionRow[],
    productCode: string
  ): ValidationResult {
    const errors: string[] = [];

    // Check if product code is provided
    if (!productCode || productCode.trim() === '') {
      errors.push('Product code is required');
    }

    // Check if rows array has correct length
    if (rows.length !== GRID_ROW_COUNT) {
      errors.push(`Grid must have exactly ${GRID_ROW_COUNT} rows`);
    }

    // Validate each row
    rows.forEach((row, index) => {
      if (row.quantity < 0) {
        errors.push(`Row ${index + 1}: Quantity cannot be negative`);
      }
      if (row.percentage < 0 || row.percentage > 100) {
        errors.push(`Row ${index + 1}: Percentage must be between 0 and 100`);
      }
      if (row.distribution < 0) {
        errors.push(`Row ${index + 1}: Distribution cannot be negative`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate percentage for a row
   * Formula: (quantity / totalQuantity) * 100
   */
  static calculatePercentage(quantity: number, totalQuantity: number): number {
    if (totalQuantity <= 0) {
      return 0;
    }
    return (quantity / totalQuantity) * 100;
  }

  /**
   * Calculate distribution for a row
   * Formula: (quantity / estQtyReceived) * selectedQuantity, rounded to whole number
   */
  static calculateDistribution(
    quantity: number,
    estQtyReceived: number,
    selectedQuantity: number | null
  ): number {
    if (estQtyReceived <= 0 || selectedQuantity === null) {
      return 0;
    }
    return Math.round((quantity / estQtyReceived) * selectedQuantity);
  }

  /**
   * Auto-populate group numbers for rows with quantity > 0
   * Format: "Number 1", "Number 2", etc.
   */
  static assignGroupNumbers(rows: DistributionRow[]): DistributionRow[] {
    let counter = 1;
    return rows.map((row) => {
      if (row.quantity > 0) {
        return {
          ...row,
          groupNumber: `Number ${counter++}`,
        };
      }
      return {
        ...row,
        groupNumber: '',
      };
    });
  }

  /**
   * Calculate all derived fields for rows
   * Updates percentage, groupNumber, and distribution for all rows
   */
  static calculateDerivedFields(
    rows: DistributionRow[],
    estQtyReceived: number,
    selectedQuantity: number | null
  ): DistributionRow[] {
    // Calculate total quantity from rows with quantity > 0
    const totalQuantity = rows.reduce(
      (sum, row) => sum + (row.quantity > 0 ? row.quantity : 0),
      0
    );

    // Update percentage and distribution for each row
    let counter = 1;
    return rows.map((row) => {
      if (row.quantity > 0) {
        return {
          ...row,
          percentage: this.calculatePercentage(row.quantity, totalQuantity),
          groupNumber: `Number ${counter++}`,
          distribution: this.calculateDistribution(
            row.quantity,
            estQtyReceived,
            selectedQuantity
          ),
        };
      }
      return {
        ...row,
        percentage: 0,
        groupNumber: '',
        distribution: 0,
      };
    });
  }

  /**
   * Calculate statistics from distribution data
   */
  static calculateStatistics(
    rows: DistributionRow[],
    totalReservation: number,
    totalCustomers: number,
    customerWithOrderQty: number
  ): SortingDistributionStatistics {
    const estQtyReceived = rows.reduce(
      (sum, row) => sum + (row.quantity || 0),
      0
    );
    const availableStock = estQtyReceived - totalReservation;
    const totalDistribution = rows.reduce(
      (sum, row) => sum + (row.distribution || 0),
      0
    );

    return {
      estQtyReceived,
      totalReservation,
      availableStock,
      totalCustomers,
      customerWithOrderQty,
      totalDistribution,
    };
  }

  /**
   * Create default empty rows
   */
  static createDefaultRows(): DistributionRow[] {
    return Array.from({ length: GRID_ROW_COUNT }, () => ({
      ...DEFAULT_DISTRIBUTION_ROW,
    }));
  }

  /**
   * Load products from API
   * Filters by shipment status "Sorting"
   */
  static async loadProducts(): Promise<{
    productOptions: string[];
    allProducts: Product[];
  }> {
    try {
      const products = await api.get<Product[]>('/api/products');
      logger.debug('Loaded products:', products.length);

      // Filter products with "Sorting" shipment status
      const sortingProducts = products.filter(
        (p) => p['Shipment Status'] === SORTING_SHIPMENT_STATUS
      );

      // Extract unique product codes
      const productCodes = sortingProducts
        .map((p) => p['Product Code'])
        .filter((code): code is string => code !== null && code.trim() !== '');

      const uniqueCodes = Array.from(new Set(productCodes));
      logger.debug('Unique sorting product codes:', uniqueCodes.length);

      return {
        productOptions: uniqueCodes,
        allProducts: products,
      };
    } catch (error) {
      logger.error('Error loading products:', error);
      return { productOptions: [], allProducts: [] };
    }
  }

  /**
   * Get total quantity for a product code from all products
   */
  static getTotalQuantityForProduct(
    productCode: string,
    allProducts: Product[]
  ): number {
    const matchingProducts = allProducts.filter(
      (p) => p['Product Code'] === productCode
    );
    return matchingProducts.reduce((sum, p) => sum + (p.Quantity || 0), 0);
  }

  /**
   * Load transactions from API
   */
  static async loadTransactions(): Promise<Transaction[]> {
    try {
      return await api.get<Transaction[]>('/api/transactions');
    } catch (error) {
      logger.error('Failed to load transactions:', error);
      return [];
    }
  }

  /**
   * Get total reservation (order quantity) for a product code
   */
  static getTotalReservation(
    productCode: string,
    transactions: Transaction[]
  ): number {
    logger.debug(`Getting reservation for product code: "${productCode}"`);
    const matchingTransactions = transactions.filter(
      (t) => {
        const matches = t['Product Code'] === productCode;
        if (!matches && t['Product Code']?.includes('Lace')) {
          logger.debug(`Transaction code: "${t['Product Code']}" vs Product code: "${productCode}"`);
        }
        return matches;
      }
    );
    logger.debug(`Found ${matchingTransactions.length} matching transactions`);
    return matchingTransactions.reduce((sum, t) => sum + (t.Quantity || 0), 0);
  }

  /**
   * Get unique quantities for pill buttons
   */
  static getUniqueQuantities(
    productCode: string,
    transactions: Transaction[]
  ): number[] {
    const matchingTransactions = transactions.filter(
      (t) => t['Product Code'] === productCode
    );
    const quantities = matchingTransactions
      .map((t) => t.Quantity || 0)
      .filter((qty) => qty > 0);
    return Array.from(new Set(quantities)).sort((a, b) => a - b);
  }

  /**
   * Get total customer count for a product code
   */
  static getTotalCustomers(
    productCode: string,
    transactions: Transaction[]
  ): number {
    const matchingTransactions = transactions.filter(
      (t) => t['Product Code'] === productCode
    );
    return matchingTransactions.length;
  }

  /**
   * Get customer count with specific order quantity
   */
  static getCustomerCountWithQuantity(
    productCode: string,
    selectedQuantity: number,
    transactions: Transaction[]
  ): number {
    const matchingTransactions = transactions.filter(
      (t) =>
        t['Product Code'] === productCode && t.Quantity === selectedQuantity
    );
    const uniqueCustomers = new Set(
      matchingTransactions.map((t) => t.Customers)
    );
    return uniqueCustomers.size;
  }

  /**
   * Load saved distribution data from API
   */
  static async loadDistributionData(productCode: string): Promise<{
    rows: DistributionRow[];
    selectedQuantity: number | null;
  }> {
    if (!productCode || productCode.trim() === '') {
      logger.debug('No product code provided, skipping load');
      return {
        rows: this.createDefaultRows(),
        selectedQuantity: null,
      };
    }

    try {
      logger.debug('Loading distribution data from API', { productCode });
      
      const response = await api.get<{
        data: DistributionRow[];
        selectedQuantity: number | null;
      }>(`/api/sorting-distribution?productCode=${encodeURIComponent(productCode)}`);

      logger.debug('Loaded distribution data', {
        rowCount: response.data.length,
        selectedQuantity: response.selectedQuantity,
      });

      // If we have saved data, use it; otherwise return empty rows
      if (response.data.length > 0) {
        // Ensure we have exactly GRID_ROW_COUNT rows
        const rows = this.createDefaultRows();
        response.data.forEach((savedRow, index) => {
          if (index < GRID_ROW_COUNT) {
            rows[index] = { ...savedRow };
          }
        });
        return {
          rows,
          selectedQuantity: response.selectedQuantity,
        };
      }

      return {
        rows: this.createDefaultRows(),
        selectedQuantity: null,
      };
    } catch (error) {
      logger.error('Error loading distribution data:', error);
      return {
        rows: this.createDefaultRows(),
        selectedQuantity: null,
      };
    }
  }

  /**
   * Save distribution data to API
   */
  static async saveDistributionData(
    productCode: string,
    selectedQuantity: number | null,
    rows: DistributionRow[]
  ): Promise<SortingDistributionSaveResponse> {
    try {
      logger.debug('Saving distribution data to API', {
        productCode,
        selectedQuantity,
        rowCount: rows.length,
      });

      const response = await api.post<SortingDistributionSaveResponse>(
        '/api/sorting-distribution',
        {
          productCode,
          selectedQuantity,
          rows,
        }
      );

      logger.info('Saved distribution data successfully', {
        productCode,
        savedCount: response.savedCount,
      });

      return response;
    } catch (error) {
      logger.error('Error saving distribution data:', error);
      return {
        success: false,
        savedCount: 0,
        message: 'Failed to save distribution data',
      };
    }
  }

  /**
   * Clear all quantities in the grid
   */
  static clearAllQuantities(rows: DistributionRow[]): DistributionRow[] {
    return rows.map((row) => ({
      ...row,
      quantity: 0,
      percentage: 0,
      groupNumber: '',
      distribution: 0,
    }));
  }

  /**
   * Toggle all checkboxes
   * If any checkbox is unchecked, check all. If all are checked, uncheck all.
   */
  static toggleAllCheckboxes(rows: DistributionRow[]): DistributionRow[] {
    const hasUnchecked = rows.some((row) => !row.checked);
    const newCheckedState = hasUnchecked;

    return rows.map((row) => ({
      ...row,
      checked: newCheckedState,
    }));
  }

  /**
   * Handle paste event
   * Parse pasted values and update quantity column
   */
  static handlePaste(
    rows: DistributionRow[],
    startRow: number,
    pastedValues: readonly (readonly string[])[]
  ): DistributionRow[] {
    const newRows = [...rows];

    pastedValues.forEach((rowData, rowOffset) => {
      const targetRow = startRow + rowOffset;
      if (targetRow < newRows.length && rowData.length > 0) {
        const pastedValue = parseFloat(rowData[0]) || 0;
        newRows[targetRow] = {
          ...newRows[targetRow],
          quantity: pastedValue,
        };
      }
    });

    logger.debug(
      `Pasted ${pastedValues.length} values starting at row ${startRow + 1}`
    );

    return newRows;
  }

  /**
   * Update a single row's quantity
   */
  static updateRowQuantity(
    rows: DistributionRow[],
    rowIndex: number,
    quantity: number
  ): DistributionRow[] {
    const newRows = [...rows];
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      quantity,
    };
    return newRows;
  }

  /**
   * Update a single row's checkbox
   */
  static updateRowCheckbox(
    rows: DistributionRow[],
    rowIndex: number,
    checked: boolean
  ): DistributionRow[] {
    const newRows = [...rows];
    newRows[rowIndex] = {
      ...newRows[rowIndex],
      checked,
    };
    return newRows;
  }

  /**
   * Get non-empty rows (for debugging/logging)
   */
  static getNonEmptyRows(rows: DistributionRow[]): DistributionRow[] {
    return rows.filter(
      (r) =>
        r.quantity > 0 ||
        r.percentage > 0 ||
        r.groupNumber ||
        r.distribution > 0 ||
        r.checked
    );
  }
}
