/**
 * Product Service
 * Handles all business logic for Products module
 * - Financial calculations (via calculateProductFinancials)
 * - Product Code generation with initials
 * - CSV import/export
 * - Validation
 * - Shipment integration
 * - Search functionality
 *
 * Costing note (ops workflow):
 * - We effectively use lot/batch costing by shipment code. Shipment-level costs (e.g.
 *   forwarder's fee, lalamove, packaging) are allocated across product codes in the same
 *   shipment (see the Products page "Shipping Fee Calculator").
 * - Those allocated amounts are saved onto each Product row (forwardersFee/lalamove/
 *   packagingCost) and included in the landed unit cost / `cogs`, which accounting uses as the
 *   unit-cost basis for COGS and shrinkage.
 */

import type {
  ProductData,
  ProductFormData,
  ProductStatistics,
  CSVImportResult,
  ProductValidationResult,
  ShipmentData,
  ProductCalculationInputs,
  ProductCalculationResults,
  ColumnAlignment,
} from '../types/product.types';
import {
  TRANSACTION_FEE_RATE,
  SUGGESTED_PRICE_MARKUP,
  SKIP_WORDS,
  PRODUCT_CODE_SPECIAL_CASES,
  TWO_DECIMAL_COLUMNS,
  CENTER_ALIGN_COLUMNS,
  LEFT_ALIGN_COLUMNS,
  RIGHT_ALIGN_COLUMNS,
} from '../types/product.types';

import { calculateProductFinancials } from '@/lib/productCalculations';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { ensureArray } from '@/lib/api/normalize';
import { logger } from '@/lib/logger';
import type { ApiResponse } from '@/types/api';

/**
 * Product Service Class
 * All static methods for product operations
 */
export class ProductService {
  /**
   * Validate product data
   */
  static validateProduct(form: ProductFormData): ProductValidationResult {
    const errors: string[] = [];

    if (!form.product.trim()) {
      errors.push('Product name is required');
    }

    if (form.unitPrice < 0) {
      errors.push('Unit price cannot be negative');
    }

    if (form.quantity < 0) {
      errors.push('Quantity cannot be negative');
    }

    if (form.exchangeRates <= 0) {
      errors.push('Exchange rate must be greater than 0');
    }

    if (form.bulkQuantity < 0) {
      errors.push('Bulk quantity cannot be negative');
    }

    if (form.bulkWeight < 0) {
      errors.push('Bulk weight cannot be negative');
    }

    if (form.weightPerPiece < 0) {
      errors.push('Weight per piece cannot be negative');
    }

    if (form.paymentMethod === 'CARD' && !form.paymentCardId.trim()) {
      errors.push('Select a saved card when payment method is Card');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate Product Code with initials logic
   *
   * Logic:
   * 1. Take first letter of each significant word
   * 2. Skip common words (and, the, of, etc.)
   * 3. Handle special cases (2-PC → 2S, 3-PC → 3S, 4-PC → 4S)
   * 4. Format: "Product Name (INITIALS-DATE)"
   *
   * Example: "Kids T-Shirt 2-PC" + "2024-10-12" → "Kids T-Shirt 2-PC (KTS2S-2024-10-12)"
   */
  static generateProductCode(productName: string, postingDate: string): string {
    if (!productName || !postingDate) {
      return '';
    }

    // Split product name into words
    const words = productName.trim().split(/\s+/);

    let initials = '';

    for (const word of words) {
      const lowerWord = word.toLowerCase();

      // Skip non-alphanumeric words (like "/", "&", etc.) except for special cases with hyphens
      if (!/[a-zA-Z0-9]/.test(word)) {
        continue;
      }

      // Check for special cases (2-PC, 3-PC, 4-PC)
      if (PRODUCT_CODE_SPECIAL_CASES[word]) {
        initials += PRODUCT_CODE_SPECIAL_CASES[word];
        continue;
      }

      // Skip common words
      const skipWordsArray = SKIP_WORDS as readonly string[];
      if (skipWordsArray.includes(lowerWord)) {
        continue;
      }

      // For words with special characters like "H&M", "Rabbit+Bear", extract all uppercase letters
      if (/[&/.+]/.test(word)) {
        // Extract all uppercase letters from the word
        const uppercaseLetters = word.match(/[A-Z]/g);
        if (uppercaseLetters) {
          initials += uppercaseLetters.join('');
        } else {
          // If no uppercase, take first letter of each alphanumeric part
          const parts = word.split(/[^a-zA-Z0-9]+/);
          for (const part of parts) {
            if (part.length > 0) {
              initials += part[0].toUpperCase();
            }
          }
        }
      } else {
        // Take first letter (uppercase)
        if (word.length > 0) {
          initials += word[0].toUpperCase();
        }
      }
    }

    // Convert date from ISO format (YYYY-MM-DD) to MMDDYY (no dashes)
    let formattedDate = postingDate;
    if (/^\d{4}-\d{2}-\d{2}$/.test(postingDate)) {
      const [year, month, day] = postingDate.split('-');
      // Use last 2 digits of year (YY format)
      formattedDate = `${month}${day}${year.slice(2)}`;
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(postingDate)) {
      // If already in MM-DD-YYYY format, remove dashes and use last 2 digits of year
      const [month, day, year] = postingDate.split('-');
      formattedDate = `${month}${day}${year.slice(2)}`;
    }

    // Format: "Product Name (INITIALS-MMDDYY)"
    return `${productName} (${initials}-${formattedDate})`;
  }

  /**
   * Calculate all financial metrics for a product
   * Uses external calculateProductFinancials function
   */
  static calculateFinancials(
    inputs: ProductCalculationInputs
  ): ProductCalculationResults {
    return calculateProductFinancials(inputs);
  }

  /**
   * Convert form data to ProductData with calculations
   */
  static formToProductData(
    form: ProductFormData,
    _isEditMode: boolean = false,
    existingProduct?: ProductData
  ): ProductData {
    // Calculate all financial metrics
    const calculations = this.calculateFinancials({
      unitPrice: form.unitPrice,
      quantity: form.quantity,
      alibabaShippingCost: form.alibabaShippingCost,
      exchangeRates: form.exchangeRates,
      forwardersFee: form.forwardersFee,
      lalamove: form.lalamove,
      packagingCost: form.packagingCost,
      actualPrice: form.actualPrice,
      applyTransactionFee: form.applyTransactionFee,
      bulkWeight: form.bulkWeight,
      bulkQuantity: form.bulkQuantity,
    });

    // Always regenerate Product Code based on current Product Name and Posting Date
    const productCode = this.generateProductCode(
      form.product.trim(),
      form.postingDate
    );

    const paymentMethod =
      form.paymentMethod && form.paymentMethod.trim().length
        ? form.paymentMethod.trim().toUpperCase()
        : null;

    const paymentCardId =
      form.paymentCardId && form.paymentCardId.trim().length
        ? form.paymentCardId.trim()
        : null;

    // Combine age range fields into a single string
    // Supports: "0-12 months", "12 years", "0-12 years", etc.
    let ageRange = '';
    if (form.ageRangeStart && form.ageRangeEnd && form.ageRangeUnit) {
      // Both start and end: "0-12 months"
      ageRange = `${form.ageRangeStart}-${form.ageRangeEnd} ${form.ageRangeUnit}`;
    } else if (form.ageRangeEnd && form.ageRangeUnit) {
      // Only end and unit: "12 years"
      ageRange = `${form.ageRangeEnd} ${form.ageRangeUnit}`;
    } else if (form.ageRangeStart && form.ageRangeUnit) {
      // Only start and unit: "12 years"
      ageRange = `${form.ageRangeStart} ${form.ageRangeUnit}`;
    } else {
      // Fallback to old ageRange field if exists
      ageRange = form.ageRange || '';
    }

    return {
      id: existingProduct?.id,
      'Shipment Code': form.shipmentCode?.trim() || '',
      'CV Number': existingProduct?.['CV Number'] || '',
      'No. Of Sacks': existingProduct?.['No. Of Sacks'] || 0,
      'Total CBM': existingProduct?.['Total CBM'] || 0,
      Weight: existingProduct?.Weight || 0,
      'Shipment Status': existingProduct?.['Shipment Status'] || '',
      'Posting Date': form.postingDate || '',
      'Order Date': form.orderDate || '',
      Payment: form.payment || '',
      'Payment Method': paymentMethod,
      'Payment Card Id': paymentCardId,
      Product: form.product?.trim() || '',
      'Product Code': productCode,
      'Age Range': ageRange,
      Unit: form.unit || '',
      'Unit Price': form.unitPrice,
      Quantity: form.quantity,
      'Alibaba Shipping Cost': form.alibabaShippingCost,
      'Exchange Rates': form.exchangeRates,
      PHP: calculations.php,
      'Sub Total (PHP)': calculations.subTotalPHP,
      'Transaction Fee': calculations.transactionFee,
      'Grand Total': calculations.grandTotal,
      "Forwarder's Fee": form.forwardersFee,
      Lalamove: form.lalamove,
      'Packaging Cost': form.packagingCost,
      'Suggested Price': calculations.suggestedPrice,
      'Actual Price': form.actualPrice,
      'Landed Unit Cost': calculations.basePrice,
      COGS: calculations.cogs,
      'Projected Sales': calculations.projectedSales,
      'Projected Profit': calculations.projectedProfit,
      'Projected Profit (%)': calculations.projectedProfitPercent,
      'Total Markup': calculations.totalMarkup,
      'Link To Post': form.linkToPost?.trim() || '',
      'Bulk Quantity': form.bulkQuantity,
      'Bulk Weight': form.bulkWeight,
      'Weight Per Piece': calculations.weightPerPiece,
    };
  }

  /**
   * Create empty form data
   */
  static createEmptyForm(): ProductFormData {
    return {
      shipmentCode: '',
      postingDate: '',
      orderDate: '',
      payment: '',
      paymentMethod: '',
      paymentCardId: '',
      product: '',
      previousProductCode: '',
      ageRange: '',
      ageRangeStart: '',
      ageRangeEnd: '',
      ageRangeUnit: '',
      unit: '',
      unitPrice: 0,
      quantity: 0,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
      applyTransactionFee: true,
      linkToPost: '',
      bulkQuantity: 0,
      bulkWeight: 0,
      weightPerPiece: 0,
    };
  }

  /**
   * Convert ProductData to form data
   */
  static productToForm(product: ProductData): ProductFormData {
    // Parse age range into components (e.g., "3-6 months" -> start: "3", end: "6", unit: "months")
    const ageRange = this.toSafeString(product['Age Range']);
    let ageRangeStart = '';
    let ageRangeEnd = '';
    let ageRangeUnit = '';

    if (ageRange) {
      // Match pattern: "number-number unit" (e.g., "3-6 months", "2-3 years")
      const match = ageRange.match(/^(\d+)-(\d+)\s+(.+)$/);
      if (match) {
        ageRangeStart = match[1];
        ageRangeEnd = match[2];
        ageRangeUnit = match[3];
      }
    }

    const exchangeRates = this.toSafeNumber(product['Exchange Rates']);
    const transactionFee = this.toSafeNumber(product['Transaction Fee']);

    return {
      shipmentCode: this.toSafeString(product['Shipment Code']),
      postingDate: this.toSafeString(product['Posting Date']),
      orderDate: this.toSafeString(product['Order Date']),
      payment: this.toSafeString(product.Payment),
      paymentMethod: this.toSafeString(product['Payment Method'] || ''),
      paymentCardId: this.toSafeString(product['Payment Card Id'] || ''),
      product: this.toSafeString(product.Product),
      previousProductCode: this.toSafeString(product['Product Code']),
      ageRange,
      ageRangeStart,
      ageRangeEnd,
      ageRangeUnit,
      unit: this.toSafeString(product.Unit),
      unitPrice: this.toSafeNumber(product['Unit Price']),
      quantity: this.toSafeNumber(product.Quantity),
      alibabaShippingCost: this.toSafeNumber(product['Alibaba Shipping Cost']),
      exchangeRates: exchangeRates === 0 ? 1 : exchangeRates,
      forwardersFee: this.toSafeNumber(product["Forwarder's Fee"]),
      lalamove: this.toSafeNumber(product.Lalamove),
      packagingCost: this.toSafeNumber(product['Packaging Cost']),
      actualPrice: this.toSafeNumber(product['Actual Price']),
      applyTransactionFee: transactionFee > 0,
      linkToPost: this.toSafeString(product['Link To Post']),
      bulkQuantity: this.toSafeNumber(product['Bulk Quantity']),
      bulkWeight: this.toSafeNumber(product['Bulk Weight']),
      weightPerPiece: this.toSafeNumber(product['Weight Per Piece']),
    };
  }

  /**
   * Parse CSV with quoted fields handling
   * Handles fields with commas inside quotes
   */
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Safe string conversion
   */
  private static toSafeString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return String(value);
  }

  /**
   * Safe number conversion
   */
  private static toSafeNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    const num =
      typeof value === 'string'
        ? parseFloat(value.replace(/,/g, ''))
        : Number(value);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Parse date from CSV format to ISO format (YYYY-MM-DD)
   * Supports multiple formats:
   * - "MM-DD-YYYY" -> "YYYY-MM-DD" (e.g., "01-04-2025" -> "2025-01-04")
   * - "MMDDYY" -> "YYYY-MM-DD" (e.g., "061224" -> "2024-12-06")
   * - "YYYY-MM-DD" -> "YYYY-MM-DD" (already ISO format)
   */
  private static parseCSVDate(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const dateStr = String(value).trim();

    // If already in ISO format (YYYY-MM-DD), return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }

    // Parse MM-DD-YYYY format
    if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
      const parts = dateStr.split('-');
      const month = parts[0];
      const day = parts[1];
      const year = parts[2];

      // Validate month and day ranges
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);

      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
        return `${year}-${month}-${day}`;
      }
    }

    // Parse MMDDYY format (6 digits) - legacy support
    if (/^\d{6}$/.test(dateStr)) {
      const month = dateStr.substring(0, 2);
      const day = dateStr.substring(2, 4);
      const year = dateStr.substring(4, 6);

      // Assume 20xx for year (2000-2099)
      const fullYear = `20${year}`;

      // Validate month and day ranges
      const monthNum = parseInt(month, 10);
      const dayNum = parseInt(day, 10);

      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
        return `${fullYear}-${month}-${day}`;
      }
    }

    // If date cannot be parsed, return empty string
    return '';
  }

  /**
   * Import products from CSV
   * Handles 36 columns with quoted fields
   */
  static async importFromCSV(csvText: string): Promise<CSVImportResult> {
    try {
      const lines = csvText.split('\n').filter((line) => line.trim());

      if (lines.length < 2) {
        return {
          success: false,
          count: 0,
          products: [],
          errors: ['CSV file is empty or contains no data rows'],
        };
      }

      // Skip header row
      const dataLines = lines.slice(1);
      const importedProducts: ProductData[] = [];
      const errors: string[] = [];

      for (let i = 0; i < dataLines.length; i++) {
        try {
          const line = dataLines[i];
          const values = this.parseCSVLine(line);

          // Pad array with empty strings to handle missing columns
          while (values.length < 36) {
            values.push('');
          }

          const parseNumeric = (val: string) => this.toSafeNumber(val);

          // Build product data with calculations
          const productData: ProductData = {
            'Shipment Code': this.toSafeString(values[0]),
            'CV Number': this.toSafeString(values[1]),
            'No. Of Sacks': parseNumeric(values[2]),
            'Total CBM': parseNumeric(values[3]),
            Weight: parseNumeric(values[4]),
            'Shipment Status': this.toSafeString(values[5]),
            'Posting Date': this.parseCSVDate(values[6]),
            'Order Date': this.parseCSVDate(values[7]),
            Payment: this.toSafeString(values[8]),
            Product: this.toSafeString(values[9]),
            'Product Code':
              this.toSafeString(values[10]) ||
              this.generateProductCode(
                this.toSafeString(values[9]),
                this.parseCSVDate(values[6])
              ),
            'Age Range': this.toSafeString(values[11]),
            Unit: this.toSafeString(values[12]),
            'Unit Price': parseNumeric(values[13]),
            Quantity: parseNumeric(values[14]),
            'Alibaba Shipping Cost': parseNumeric(values[15]),
            'Exchange Rates': parseNumeric(values[16]),
            PHP: parseNumeric(values[13]) * parseNumeric(values[16]),
            'Sub Total (PHP)':
              (parseNumeric(values[13]) * parseNumeric(values[14]) +
                parseNumeric(values[15])) *
              parseNumeric(values[16]),
            'Transaction Fee':
              (parseNumeric(values[13]) * parseNumeric(values[14]) +
                parseNumeric(values[15])) *
              parseNumeric(values[16]) *
              TRANSACTION_FEE_RATE,
            'Grand Total':
              (parseNumeric(values[13]) * parseNumeric(values[14]) +
                parseNumeric(values[15])) *
                parseNumeric(values[16]) +
              (parseNumeric(values[13]) * parseNumeric(values[14]) +
                parseNumeric(values[15])) *
                parseNumeric(values[16]) *
                TRANSACTION_FEE_RATE,
            "Forwarder's Fee": parseNumeric(values[21]),
            Lalamove: parseNumeric(values[22]),
            'Packaging Cost': parseNumeric(values[23]),
            'Suggested Price': Math.ceil(
              (parseNumeric(values[14]) > 0
                ? ((parseNumeric(values[13]) * parseNumeric(values[14]) +
                    parseNumeric(values[15])) *
                    parseNumeric(values[16]) +
                    (parseNumeric(values[13]) * parseNumeric(values[14]) +
                      parseNumeric(values[15])) *
                      parseNumeric(values[16]) *
                      TRANSACTION_FEE_RATE +
                    parseNumeric(values[21]) +
                    parseNumeric(values[22]) +
                    parseNumeric(values[23])) /
                  parseNumeric(values[14])
                : 0) * SUGGESTED_PRICE_MARKUP
            ),
            'Actual Price': parseNumeric(values[25]),
            'Landed Unit Cost':
              parseNumeric(values[14]) > 0
                ? ((parseNumeric(values[13]) * parseNumeric(values[14]) +
                    parseNumeric(values[15])) *
                    parseNumeric(values[16]) +
                    (parseNumeric(values[13]) * parseNumeric(values[14]) +
                      parseNumeric(values[15])) *
                      parseNumeric(values[16]) *
                      TRANSACTION_FEE_RATE +
                    parseNumeric(values[21]) +
                    parseNumeric(values[22]) +
                    parseNumeric(values[23])) /
                  parseNumeric(values[14])
                : 0,
            COGS:
              (parseNumeric(values[13]) * parseNumeric(values[14]) +
                parseNumeric(values[15])) *
                parseNumeric(values[16]) +
              (parseNumeric(values[13]) * parseNumeric(values[14]) +
                parseNumeric(values[15])) *
                parseNumeric(values[16]) *
                TRANSACTION_FEE_RATE +
              parseNumeric(values[21]) +
              parseNumeric(values[22]) +
              parseNumeric(values[23]),
            'Projected Sales':
              parseNumeric(values[25]) * parseNumeric(values[14]),
            'Projected Profit':
              parseNumeric(values[25]) * parseNumeric(values[14]) -
              ((parseNumeric(values[13]) * parseNumeric(values[14]) +
                parseNumeric(values[15])) *
                parseNumeric(values[16]) +
                (parseNumeric(values[13]) * parseNumeric(values[14]) +
                  parseNumeric(values[15])) *
                  parseNumeric(values[16]) *
                  TRANSACTION_FEE_RATE +
                parseNumeric(values[21]) +
                parseNumeric(values[22]) +
                parseNumeric(values[23])),
            'Projected Profit (%)':
              (parseNumeric(values[13]) * parseNumeric(values[14]) +
                parseNumeric(values[15])) *
                parseNumeric(values[16]) +
                (parseNumeric(values[13]) * parseNumeric(values[14]) +
                  parseNumeric(values[15])) *
                  parseNumeric(values[16]) *
                  TRANSACTION_FEE_RATE +
                parseNumeric(values[21]) +
                parseNumeric(values[22]) +
                parseNumeric(values[23]) >
              0
                ? ((parseNumeric(values[25]) * parseNumeric(values[14]) -
                    ((parseNumeric(values[13]) * parseNumeric(values[14]) +
                      parseNumeric(values[15])) *
                      parseNumeric(values[16]) +
                      (parseNumeric(values[13]) * parseNumeric(values[14]) +
                        parseNumeric(values[15])) *
                        parseNumeric(values[16]) *
                        TRANSACTION_FEE_RATE +
                      parseNumeric(values[21]) +
                      parseNumeric(values[22]) +
                      parseNumeric(values[23]))) /
                    ((parseNumeric(values[13]) * parseNumeric(values[14]) +
                      parseNumeric(values[15])) *
                      parseNumeric(values[16]) +
                      (parseNumeric(values[13]) * parseNumeric(values[14]) +
                        parseNumeric(values[15])) *
                        parseNumeric(values[16]) *
                        TRANSACTION_FEE_RATE +
                      parseNumeric(values[21]) +
                      parseNumeric(values[22]) +
                      parseNumeric(values[23]))) *
                  100
                : 0,
            'Total Markup':
              parseNumeric(values[13]) * parseNumeric(values[16]) > 0
                ? (parseNumeric(values[25]) /
                    (parseNumeric(values[13]) * parseNumeric(values[16]))) *
                  100
                : 0,
            'Link To Post': this.toSafeString(values[32]),
            'Bulk Quantity': parseNumeric(values[33]),
            'Bulk Weight': parseNumeric(values[34]),
            'Weight Per Piece': parseNumeric(values[35]),
          };

          // Only add if we have essential data
          if (
            productData['Product'] ||
            productData['Product Code'] ||
            productData['Shipment Code']
          ) {
            importedProducts.push(productData);
          }
        } catch (rowError) {
          errors.push(`Error parsing row ${i + 2}: ${rowError}`);
        }
      }

      if (importedProducts.length === 0) {
        return {
          success: false,
          count: 0,
          products: [],
          errors: ['No valid product data found in the CSV file'],
        };
      }

      return {
        success: true,
        count: importedProducts.length,
        products: importedProducts,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        products: [],
        errors: [`CSV import failed: ${error}`],
      };
    }
  }

  /**
   * Create search index for a product (all searchable fields)
   */
  static createSearchIndex(product: ProductData): string {
    return [
      product['Shipment Code'],
      product['CV Number'],
      product.Product,
      product['Product Code'],
      product['Shipment Status'],
      product['Age Range'],
      product.Unit,
      product['Link To Post'],
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  /**
   * Search products by query (multi-field search)
   */
  static searchProducts(products: ProductData[], query: string): ProductData[] {
    if (!query.trim()) {
      return products;
    }

    const searchTerm = query.toLowerCase();

    return products.filter((product) => {
      const searchIndex = this.createSearchIndex(product);
      return searchIndex.includes(searchTerm);
    });
  }

  /**
   * Calculate product statistics
   */
  static calculateStatistics(products: ProductData[]): ProductStatistics {
    if (products.length === 0) {
      return {
        total: 0,
        totalValue: 0,
        avgValue: 0,
        totalProfit: 0,
      };
    }

    const totalValue = products.reduce(
      (sum, product) => sum + (product['Projected Sales'] || 0),
      0
    );

    const totalProfit = products.reduce(
      (sum, product) => sum + (product['Projected Profit'] || 0),
      0
    );

    return {
      total: products.length,
      totalValue,
      avgValue: totalValue / products.length,
      totalProfit,
    };
  }

  /**
   * Load products with shipment integration
   * Fetches products and enriches with shipment data
   * Sorted by newest first (highest ID first)
   */
  static async loadProducts(apiBasePath?: string): Promise<ProductData[]> {
    try {
      // Fetch products from API
      const productResponse = await api.get<
        ProductData[] | ApiResponse<ProductData[]>
      >(buildApiPath(apiBasePath, '/products'));
      const products = ensureArray<ProductData>(productResponse);

      // Fetch shipments for lookup
      let shipments: ShipmentData[] = [];
      try {
        const shipmentResponse = await api.get<
          ShipmentData[] | ApiResponse<ShipmentData[]>
        >(buildApiPath(apiBasePath, '/shipments'));
        shipments = ensureArray<ShipmentData>(shipmentResponse);
      } catch (error) {
        // Continue without shipment data if API fails
        logger.warn(
          'Failed to fetch shipments, continuing without shipment data'
        );
        return this.sortProducts(products);
      }

      const enrichedProducts = products.map((product) => {
        if (product['Shipment Code']) {
          const shipment = shipments.find(
            (s) => s['Shipment Code'] === product['Shipment Code']
          );
          if (shipment) {
            return {
              ...product,
              'CV Number': shipment['CV Number'] || product['CV Number'],
              'No. Of Sacks':
                shipment['No. Of Sacks'] || product['No. Of Sacks'],
              'Total CBM': shipment['Total CBM'] || product['Total CBM'],
              Weight: shipment.Weight || product.Weight,
              'Shipment Status':
                shipment['Shipment Status'] || product['Shipment Status'],
            };
          }
        }
        return product;
      });

      return this.sortProducts(enrichedProducts);
    } catch (error) {
      logger.error('Failed to load products:', error);
      return [];
    }
  }

  private static sortProducts(products: ProductData[]): ProductData[] {
    const normalizedCode = (product: ProductData) =>
      (product['Shipment Code'] || '').trim().toUpperCase();

    return [...products].sort((a, b) => {
      const codeA = normalizedCode(a);
      const codeB = normalizedCode(b);
      const hasCodeA = codeA.length > 0;
      const hasCodeB = codeB.length > 0;

      if (!hasCodeA && hasCodeB) {
        return -1;
      }

      if (hasCodeA && !hasCodeB) {
        return 1;
      }

      if (!hasCodeA && !hasCodeB) {
        const timestampDiff =
          this.getCreatedTimestamp(b) - this.getCreatedTimestamp(a);
        if (timestampDiff !== 0) {
          return timestampDiff;
        }
        return (b.id ?? 0) - (a.id ?? 0);
      }

      const codeComparison = codeB.localeCompare(codeA, undefined, {
        numeric: true,
        sensitivity: 'base',
      });

      if (codeComparison !== 0) {
        return codeComparison;
      }

      const timestampDiff =
        this.getCreatedTimestamp(b) - this.getCreatedTimestamp(a);
      if (timestampDiff !== 0) {
        return timestampDiff;
      }

      return (b.id ?? 0) - (a.id ?? 0);
    });
  }

  private static getCreatedTimestamp(product: ProductData): number {
    if (product.createdAt) {
      const date = new Date(product.createdAt);
      if (!Number.isNaN(date.getTime())) {
        return date.getTime();
      }
    }
    return product.id ?? 0;
  }

  /**
   * Lookup shipment by code
   */
  static async lookupShipment(
    shipmentCode: string,
    apiBasePath?: string
  ): Promise<ShipmentData | null> {
    if (!shipmentCode.trim()) {
      return null;
    }

    try {
      const shipments = await api.get<ShipmentData[]>(
        buildApiPath(apiBasePath, '/shipments')
      );
      return shipments.find((s) => s['Shipment Code'] === shipmentCode) || null;
    } catch (error) {
      logger.error('Failed to lookup shipment:', error);
      return null;
    }
  }

  /**
   * Add new product to database
   */
  static async addProduct(
    product: ProductData,
    apiBasePath?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await api.post(buildApiPath(apiBasePath, '/products'), [product]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to add product to database',
      };
    }
  }

  /**
   * Update existing product in database
   */
  static async updateProduct(
    productId: number,
    product: Partial<ProductData>,
    apiBasePath?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const path = buildApiPath(apiBasePath, '/products');
      await api.put(`${path}/${productId}`, product);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update product in database',
      };
    }
  }

  /**
   * Bulk update products (for paste operations)
   */
  static async bulkUpdateProducts(
    products: ProductData[],
    apiBasePath?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await api.put(buildApiPath(apiBasePath, '/products'), products);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update products in database',
      };
    }
  }

  static async postTransitBuildUpByShipmentCode(
    shipmentCode: string,
    apiBasePath?: string
  ): Promise<
    | {
        success: true;
        data: { created: number; skipped: number; products: number };
      }
    | { success: false; error: string }
  > {
    const normalized = (shipmentCode ?? '').toString().trim();
    if (!normalized) {
      return { success: false, error: 'Shipment Code is required' };
    }

    try {
      const data = await api.post<{
        created: number;
        skipped: number;
        products: number;
      }>(buildApiPath(apiBasePath, '/products/transit-build'), {
        shipmentCode: normalized,
      });
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to post transit build-up',
      };
    }
  }

  /**
   * Get column alignment
   */
  static getColumnAlignment(columnId: string): ColumnAlignment {
    if ((CENTER_ALIGN_COLUMNS as readonly string[]).includes(columnId)) {
      return 'center';
    }
    if ((LEFT_ALIGN_COLUMNS as readonly string[]).includes(columnId)) {
      return 'left';
    }
    if ((RIGHT_ALIGN_COLUMNS as readonly string[]).includes(columnId)) {
      return 'right';
    }
    return 'left'; // default
  }

  /**
   * Check if column should display with 2 decimal places
   */
  static usesTwoDecimalPlaces(columnId: string): boolean {
    return (TWO_DECIMAL_COLUMNS as readonly string[]).includes(columnId);
  }
}
