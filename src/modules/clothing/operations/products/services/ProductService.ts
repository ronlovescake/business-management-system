/**
 * Product Service
 * Handles all business logic for Products module
 * - Financial calculations (via calculateProductFinancials)
 * - Product Code generation with initials
 * - CSV import/export
 * - Validation
 * - Shipment integration
 * - Search functionality
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
import { logger } from '@/lib/logger';

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

      // Take first letter (uppercase)
      if (word.length > 0) {
        initials += word[0].toUpperCase();
      }
    }

    // Format: "Product Name (INITIALS-DATE)"
    return `${productName} (${initials}-${postingDate})`;
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
    isEditMode: boolean = false,
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
    });

    // Generate or preserve Product Code
    const productCode =
      isEditMode && existingProduct
        ? existingProduct['Product Code']
        : this.generateProductCode(form.product.trim(), form.postingDate);

    return {
      id: existingProduct?.id,
      'Shipment Code': form.shipmentCode.trim(),
      'CV Number': existingProduct?.['CV Number'] || '',
      'No. Of Sacks': existingProduct?.['No. Of Sacks'] || 0,
      'Total CBM': existingProduct?.['Total CBM'] || 0,
      Weight: existingProduct?.Weight || 0,
      'Shipment Status': existingProduct?.['Shipment Status'] || '',
      'Posting Date': form.postingDate,
      'Order Date': form.orderDate,
      Payment: form.payment,
      Product: form.product.trim(),
      'Product Code': productCode,
      'Age Range': form.ageRange,
      Unit: form.unit,
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
      'Base Price': calculations.basePrice,
      COGS: calculations.cogs,
      'Projected Sales': calculations.projectedSales,
      'Projected Profit': calculations.projectedProfit,
      'Projected Profit (%)': calculations.projectedProfitPercent,
      'Total Markup': calculations.totalMarkup,
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
      product: '',
      ageRange: '',
      unit: '',
      unitPrice: 0,
      quantity: 0,
      alibabaShippingCost: 0,
      exchangeRates: 1,
      forwardersFee: 0,
      lalamove: 0,
      packagingCost: 0,
      actualPrice: 0,
    };
  }

  /**
   * Convert ProductData to form data
   */
  static productToForm(product: ProductData): ProductFormData {
    return {
      shipmentCode: product['Shipment Code'],
      postingDate: product['Posting Date'],
      orderDate: product['Order Date'],
      payment: product.Payment,
      product: product.Product,
      ageRange: product['Age Range'],
      unit: product.Unit,
      unitPrice: product['Unit Price'],
      quantity: product.Quantity,
      alibabaShippingCost: product['Alibaba Shipping Cost'],
      exchangeRates: product['Exchange Rates'],
      forwardersFee: product["Forwarder's Fee"],
      lalamove: product.Lalamove,
      packagingCost: product['Packaging Cost'],
      actualPrice: product['Actual Price'],
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
   * Import products from CSV
   * Handles 32+ columns with quoted fields
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
          while (values.length < 32) {
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
            'Posting Date': this.toSafeString(values[6]),
            'Order Date': this.toSafeString(values[7]),
            Payment: this.toSafeString(values[8]),
            Product: this.toSafeString(values[9]),
            'Product Code':
              this.toSafeString(values[10]) ||
              this.generateProductCode(
                this.toSafeString(values[9]),
                this.toSafeString(values[6])
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
            'Base Price':
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
   */
  static async loadProducts(): Promise<ProductData[]> {
    try {
      // Fetch products from API
      const products = await api.get<ProductData[]>('/api/products');

      // Fetch shipments for lookup
      let shipments: ShipmentData[] = [];
      try {
        shipments = await api.get<ShipmentData[]>('/api/shipments');
      } catch {
        // Continue without shipment data if API fails
        logger.warn(
          'Failed to fetch shipments, continuing without shipment data'
        );
        return products;
      }

      // Enrich products with shipment data
      return products.map((product) => {
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
    } catch (error) {
      logger.error('Failed to load products:', error);
      return [];
    }
  }

  /**
   * Lookup shipment by code
   */
  static async lookupShipment(
    shipmentCode: string
  ): Promise<ShipmentData | null> {
    if (!shipmentCode.trim()) {
      return null;
    }

    try {
      const shipments = await api.get<ShipmentData[]>('/api/shipments');
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
    product: ProductData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await api.post('/api/products', [product]);
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
    product: Partial<ProductData>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await api.put(`/api/products/${productId}`, product);
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
    products: ProductData[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await api.put('/api/products', products);
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
