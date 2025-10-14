import type {
  PriceData,
  PriceFormData,
  PriceStats,
  BulkAdjustmentConfig,
  ValidationResult,
  CSVImportResult,
} from '../types/price.types';
import { logger } from '@/lib/logger';

/**
 * Service for managing price data and operations
 */
class PriceService {
  /**
   * Validate price data
   */
  static validatePrice(price: PriceFormData): ValidationResult {
    const errors: string[] = [];

    // Validate product code
    if (!price.productCode.trim()) {
      errors.push('Product code is required');
    }

    // Validate at least one tier is filled
    const hasValidTier = price.tiers.some(
      (tier) => tier.lowerLimit > 0 || tier.upperLimit > 0 || tier.price > 0
    );

    if (!hasValidTier) {
      errors.push('At least one pricing tier is required');
    }

    // Validate each filled tier
    price.tiers.forEach((tier, index) => {
      const isFilled =
        tier.lowerLimit > 0 || tier.upperLimit > 0 || tier.price > 0;

      if (isFilled) {
        // Check all fields are filled
        if (tier.lowerLimit === 0) {
          errors.push(`Tier ${index + 1}: Lower limit is required`);
        }
        if (tier.upperLimit === 0) {
          errors.push(`Tier ${index + 1}: Upper limit is required`);
        }
        if (tier.price === 0) {
          errors.push(`Tier ${index + 1}: Price is required`);
        }

        // Check lower < upper
        if (tier.lowerLimit > 0 && tier.upperLimit > 0) {
          if (tier.lowerLimit >= tier.upperLimit) {
            errors.push(
              `Tier ${index + 1}: Lower limit must be less than upper limit`
            );
          }
        }

        // Check tier ordering (each tier's lower limit should be greater than previous)
        if (index > 0) {
          const previousTier = price.tiers[index - 1];
          if (
            previousTier.lowerLimit > 0 &&
            tier.lowerLimit > 0 &&
            tier.lowerLimit <= previousTier.lowerLimit
          ) {
            errors.push(
              `Tier ${index + 1}: Lower limit must be greater than previous tier's lower limit`
            );
          }
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert form data to price data (first tier only for backward compatibility)
   */
  static formToPriceData(form: PriceFormData): PriceData {
    const firstTier = form.tiers[0];
    return {
      'Product Code': form.productCode.trim(),
      'Lower Limit': firstTier.lowerLimit,
      'Upper Limit': firstTier.upperLimit,
      Prices: firstTier.price,
      'Price Adjustment': form.priceAdjustment,
    };
  }

  /**
   * Create empty price form
   */
  static createEmptyForm(): PriceFormData {
    return {
      productCode: '',
      tiers: [
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
        { lowerLimit: 0, upperLimit: 0, price: 0 },
      ],
      priceAdjustment: 0,
    };
  }

  /**
   * Create empty price data
   */
  static createEmptyPrice(): PriceData {
    return {
      'Product Code': '',
      'Lower Limit': 0,
      'Upper Limit': 0,
      Prices: 0,
      'Price Adjustment': 0,
    };
  }

  /**
   * Calculate price statistics
   */
  static calculateStats(
    prices: PriceData[],
    filteredPrices: PriceData[]
  ): PriceStats {
    const total = prices.length;
    const filtered = filteredPrices.length;

    // Calculate average price
    const avgPrice =
      filteredPrices.length > 0
        ? Math.round(
            filteredPrices.reduce((sum, p) => sum + p.Prices, 0) /
              filteredPrices.length
          )
        : 0;

    // Count adjustments
    const totalAdjustments = filteredPrices.filter(
      (p) => p['Price Adjustment'] !== 0
    ).length;

    const priceIncreases = filteredPrices.filter(
      (p) => p['Price Adjustment'] > 0
    ).length;

    const priceDecreases = filteredPrices.filter(
      (p) => p['Price Adjustment'] < 0
    ).length;

    return {
      total,
      filtered,
      avgPrice,
      totalAdjustments,
      priceIncreases,
      priceDecreases,
    };
  }

  /**
   * Parse CSV line handling quoted fields with commas
   */
  static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Push the last field
    result.push(current.trim());

    return result;
  }

  /**
   * Import prices from CSV content
   */
  static importFromCSV(csvContent: string): CSVImportResult {
    try {
      const lines = csvContent.split('\n').filter((line) => line.trim());

      if (lines.length === 0) {
        return {
          success: false,
          error: 'CSV file is empty',
        };
      }

      // Skip header row
      const dataLines = lines.slice(1);
      const importedPrices: PriceData[] = [];
      let id = 1;

      for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i].trim();
        if (!line || line === ',,,,') {
          continue; // Skip empty lines
        }

        const values = line.split(',');
        if (values.length < 5) {
          continue; // Skip incomplete rows
        }

        const productCode = values[0]?.trim();
        const lowerLimit = parseFloat(values[1]?.trim()) || 0;
        const upperLimit = parseFloat(values[2]?.trim()) || 0;
        const prices = parseFloat(values[3]?.trim()) || 0;
        const priceAdjustment = parseFloat(values[4]?.trim()) || 0;

        if (!productCode) {
          continue; // Skip rows without product code
        }

        // Convert prices to proper format (remove commas and quotes)
        const cleanPrices = prices.toString().replace(/[,"]/g, '');
        const cleanAdjustment = priceAdjustment.toString().replace(/[,"]/g, '');

        const priceData: PriceData = {
          id: id++,
          'Product Code': productCode,
          'Lower Limit': Math.round(lowerLimit),
          'Upper Limit': Math.round(upperLimit),
          Prices: Math.round(parseFloat(cleanPrices)),
          'Price Adjustment': Math.round(parseFloat(cleanAdjustment)),
        };

        importedPrices.push(priceData);
      }

      if (importedPrices.length === 0) {
        return {
          success: false,
          error: 'No valid price data found in the CSV file',
        };
      }

      return {
        success: true,
        data: importedPrices,
        rowsImported: importedPrices.length,
      };
    } catch (error) {
      logger.error('CSV import error:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to parse CSV file',
      };
    }
  }

  /**
   * Search prices by query
   */
  static searchPrices(prices: PriceData[], query: string): PriceData[] {
    if (!query.trim()) {
      return prices;
    }

    const q = query.toLowerCase();
    return prices.filter(
      (price) =>
        price['Product Code'].toLowerCase().includes(q) ||
        price['Lower Limit'].toString().includes(q) ||
        price['Upper Limit'].toString().includes(q) ||
        price['Prices'].toString().includes(q) ||
        price['Price Adjustment'].toString().includes(q)
    );
  }

  /**
   * Create search index for a price
   */
  static createSearchIndex(price: PriceData): string {
    return [
      price['Product Code'],
      price['Lower Limit'].toString(),
      price['Upper Limit'].toString(),
      price['Prices'].toString(),
      price['Price Adjustment'].toString(),
    ]
      .join(' ')
      .toLowerCase();
  }

  /**
   * Apply bulk price adjustment
   */
  static applyBulkAdjustment(
    prices: PriceData[],
    config: BulkAdjustmentConfig
  ): PriceData[] {
    return prices.map((price) => {
      let newAdjustment = price['Price Adjustment'];

      if (config.type === 'percentage') {
        // Apply percentage adjustment to the base price
        const adjustmentAmount = Math.round(
          price.Prices * (config.value / 100)
        );
        newAdjustment = adjustmentAmount;
      } else {
        // Apply fixed adjustment
        newAdjustment = Math.round(config.value);
      }

      return {
        ...price,
        'Price Adjustment': newAdjustment,
      };
    });
  }

  /**
   * Load prices from API
   */
  static async loadPrices(): Promise<PriceData[]> {
    try {
      const response = await fetch('/api/prices', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch prices: ${response.statusText}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      logger.error('Error loading prices:', error);
      return [];
    }
  }

  /**
   * Add a new price
   */
  static async addPrice(price: PriceData): Promise<boolean> {
    try {
      const response = await fetch('/api/prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([price]), // Send as array
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to save price');
      }

      return true;
    } catch (error) {
      logger.error('Error adding price:', error);
      return false;
    }
  }

  /**
   * Bulk update prices
   */
  static async bulkUpdatePrices(prices: PriceData[]): Promise<boolean> {
    try {
      const response = await fetch('/api/prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prices),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to update prices');
      }

      return true;
    } catch (error) {
      logger.error('Error updating prices:', error);
      return false;
    }
  }

  /**
   * Replace all prices (used after CSV import)
   */
  static async replaceAllPrices(prices: PriceData[]): Promise<number> {
    try {
      const response = await fetch('/api/prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prices),
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to save to database');
      }

      const result = await response.json();
      return result.count || prices.length;
    } catch (error) {
      logger.error('Error replacing prices:', error);
      throw error;
    }
  }
}

// Export both the class and a default instance
const priceService = new PriceService();
export default priceService;
export { PriceService };
