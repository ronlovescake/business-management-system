/**
 * Transaction Service
 *
 * ==============================================================================
 * 🚨🚨🚨 CRITICAL WARNING - PROTECTED BUSINESS LOGIC 🚨🚨🚨
 * ==============================================================================
 *
 * This service contains FINALIZED and BUSINESS-APPROVED logic including:
 * ✅ UNIT PRICE CALCULATION (Tier Price - Discount)
 * ✅ LINE TOTAL CALCULATION ((Quantity × Unit Price) - Adjustment)
 * ✅ CUSTOMER VALIDATION (Banned customers + 50% cancellation rate)
 * ✅ ORDER STATUS AUTO-POPULATION (Based on shipment status)
 * ✅ SHIPMENT CODE AUTO-POPULATION
 *
 * ❌ DO NOT MODIFY FORMULAS WITHOUT BUSINESS APPROVAL
 * ✅ ALLOWED: Fix bugs, improve code structure, add logging
 *
 * Reference: INVOICE_GENERATION_LOGIC_PROTECTION.md
 * ==============================================================================
 */

import { FormatterService } from '@/services/FormatterService';
import { ValidationService } from '@/services/ValidationService';
import type {
  TransactionData,
  PriceTier,
  CustomerValidationResult,
  SanitizedTransaction,
  TransactionStatistics,
  PackingListTransaction,
} from '../types/transaction.types';
import { logger } from '@/lib/logger';
import {
  isCancelledOrderStatus,
  normalizeOrderStatus,
} from '@/lib/transactions/order-status';

export class TransactionService {
  // ============================================================================
  // FORMATTER REUSE - From shared FormatterService
  // ============================================================================
  static formatCurrency = FormatterService.formatCurrency;
  static formatDate = FormatterService.formatDateShort;
  static formatNumber = FormatterService.formatNumber;

  // ============================================================================
  // VALUE SANITIZATION - Treat "null" string and empty as blank
  // ============================================================================

  /**
   * Sanitize any value (treat "null" string as empty)
   */
  static sanitizeValue(val: unknown): string {
    if (val === null || val === undefined || val === 'null' || val === '') {
      return '';
    }
    return String(val);
  }

  /**
   * Sanitize numeric value (also treat 0 as blank for display)
   */
  static sanitizeNumericValue(val: unknown): string {
    if (
      val === null ||
      val === undefined ||
      val === 'null' ||
      val === '' ||
      val === 0 ||
      val === '0'
    ) {
      return '';
    }
    return String(val);
  }

  // ============================================================================
  // ⚠️ FINALIZED FORMULA: UNIT PRICE CALCULATION
  // ============================================================================
  // Formula: Unit Price = Tier Price - Discount
  //
  // This function looks up the tier price from prices table and applies discount.
  // DO NOT MODIFY without business approval!
  // ============================================================================

  /**
   * Get unit price based on product code and quantity
   *
   * @param productCode - The product code to lookup
   * @param quantity - The quantity to match against tier ranges
   * @param priceTiers - Array of price tiers from prices API
   * @returns The tier price (Prices field) or null
   */
  static getUnitPriceForQuantity(
    productCode: string,
    quantity: number,
    priceTiers: PriceTier[]
  ): number | null {
    if (!productCode || !quantity || quantity <= 0) {
      return null;
    }

    // Find all price tiers for this product code
    const productTiers = priceTiers.filter(
      (tier) => tier['Product Code'] === productCode
    );

    if (productTiers.length === 0) {
      return null;
    }

    // Find the tier that contains this quantity
    const matchingTier = productTiers.find(
      (tier) =>
        quantity >= tier['Lower Limit'] && quantity <= tier['Upper Limit']
    );

    return matchingTier ? matchingTier.Prices : null;
  }

  /**
   * Calculate unit price with discount applied
   * ⚠️ FINALIZED FORMULA: Unit Price = Tier Price - Discount
   *
   * @param productCode - Product code
   * @param quantity - Quantity ordered
   * @param discount - Discount amount
   * @param priceTiers - Price tiers array
   * @returns Calculated unit price or 0
   */
  static calculateUnitPrice(
    productCode: string,
    quantity: number,
    discount: number,
    priceTiers: PriceTier[]
  ): number {
    const tierPrice = this.getUnitPriceForQuantity(
      productCode,
      quantity,
      priceTiers
    );
    if (tierPrice === null) {
      return 0;
    }

    // ⚠️ FINALIZED FORMULA
    return tierPrice - discount;
  }

  // ============================================================================
  // ⚠️ FINALIZED FORMULA: LINE TOTAL CALCULATION
  // ============================================================================
  // Formula: LINE TOTAL = (QUANTITY × UNIT PRICE) - ADJUSTMENT
  //
  // IMPORTANT: Discount is NOT subtracted here (already in Unit Price)
  // DO NOT MODIFY without business approval!
  // ============================================================================

  /**
   * Calculate line total
   * ⚠️ FINALIZED FORMULA: (Quantity × Unit Price) - Adjustment
   *
   * @param quantity - Number of units
   * @param unitPrice - Price per unit (already includes discount)
   * @param adjustment - Order-level adjustment amount
   * @returns The calculated line total
   */
  static calculateLineTotal(
    quantity: number,
    unitPrice: number,
    adjustment: number
  ): number {
    return quantity * unitPrice - adjustment;
  }

  // ============================================================================
  // ORDER STATUS LOGIC - Auto-populate based on shipment status
  // ============================================================================

  // ============================================================================
  // ⚠️ STATUS NORMALIZATION & CANCELLATION RULES
  // ============================================================================
  // - normalizeOrderStatus() is the single source of truth for comparisons.
  // - Cancelled means ONLY the explicit "Cancelled" status from the dropdown.
  // - This prevents accidental filtering of other labels (e.g. typos or legacy values).
  // ============================================================================

  /**
   * Determine Order Status based on Shipment Status
   *
   * Rules:
   * - Blank, "In Transit", "Manila Port", "With Pier Gatepass", "PH Warehouse" → "In Transit"
   * - "For Pickup", "Sorting", "Delivered" → "Warehouse"
   * - Default fallback → "In Transit"
   *
   * Note:
   * - Any unknown shipment status logs a warning and defaults to "In Transit"
   *   to preserve current operations workflow.
   *
   * @param shipmentStatus - The shipment status
   * @returns The corresponding order status
   */
  static getOrderStatusFromShipmentStatus(shipmentStatus: string): string {
    if (!shipmentStatus || shipmentStatus.trim() === '') {
      return 'In Transit';
    }

    const normalizedStatus = shipmentStatus.trim();
    const normalizedLower = normalizedStatus.toLowerCase();

    const inTransitStatuses = new Set([
      'in transit',
      'manila port',
      'with pier gatepass',
      'ph warehouse',
    ]);

    const warehouseStatuses = new Set(['for pickup', 'sorting', 'delivered']);

    if (inTransitStatuses.has(normalizedLower)) {
      return 'In Transit';
    } else if (warehouseStatuses.has(normalizedLower)) {
      return 'Warehouse';
    }

    logger.warn('Unknown shipment status; defaulting to In Transit', {
      shipmentStatus: normalizedStatus,
    });

    return 'In Transit'; // Default fallback
  }

  // ============================================================================
  // CUSTOMER VALIDATION - Check banned status and cancellation rate
  // ============================================================================

  /**
   * Validate customer before creating transaction
   * Checks for:
   * - Banned status (isValid = false)
   * - High cancellation rate >= 50% (warning)
   *
   * @param customerName - Customer name to validate
   * @returns Validation result with warnings
   */
  static async validateCustomer(
    customerName: string
  ): Promise<CustomerValidationResult> {
    try {
      // Use shared ValidationService for customer validation
      const result = await ValidationService.validateCustomer(customerName);
      const alerts = [...(result.errors || []), ...result.warnings];

      return {
        isValid: result.isValid,
        warnings: alerts,
        customerData: result.customerData,
      };
    } catch (error) {
      logger.error('Error validating customer:', error);
      return { isValid: true, warnings: [] };
    }
  }

  // ============================================================================
  // DATA SANITIZATION - Convert nullable to non-nullable for API
  // ============================================================================

  /**
   * Sanitize transaction for API operations
   * Converts nullable numeric fields to 0 (non-null).
   *
   * @param transaction - Transaction with nullable fields
   * @returns Transaction with non-null numeric fields
   */
  static sanitizeTransaction(
    transaction: TransactionData
  ): SanitizedTransaction {
    return {
      ...transaction,
      Quantity: transaction.Quantity ?? 0,
      'Unit Price': transaction['Unit Price'] ?? 0,
      Discount: transaction.Discount ?? 0,
      Adjustment: transaction.Adjustment ?? 0,
      'Line Total': transaction['Line Total'] ?? 0,
    };
  }

  /**
   * Sanitize multiple transactions
   */
  static sanitizeTransactions(
    transactions: TransactionData[]
  ): SanitizedTransaction[] {
    return transactions.map((t) => this.sanitizeTransaction(t));
  }

  // ============================================================================
  // STATISTICS CALCULATION
  // ============================================================================

  /**
   * Calculate transaction statistics for stat cards
   * Excludes cancelled orders from revenue calculations.
   *
   * @param filteredData - Filtered transaction data
   * @returns Calculated statistics
   */
  static calculateStatistics(
    filteredData: TransactionData[]
  ): TransactionStatistics {
    // Only count rows with actual transaction data (has customer or product code)
    const totalTransactions = filteredData.filter(
      (t) => t.Customers || t['Product Code']
    ).length;

    // Exclude cancelled orders from revenue
    const activeTransactions = filteredData.filter(
      (t) => !isCancelledOrderStatus(t['Order Status'])
    );

    const totalRevenue = activeTransactions.reduce(
      (sum, t) => sum + (t.Quantity || 0) * (t['Unit Price'] || 0),
      0
    );

    const inTransitTotal = filteredData
      .filter((t) => normalizeOrderStatus(t['Order Status']) === 'in transit')
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);

    const warehouseTotal = filteredData
      .filter((t) => normalizeOrderStatus(t['Order Status']) === 'warehouse')
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);

    const preparedTotal = filteredData
      .filter((t) => normalizeOrderStatus(t['Order Status']) === 'prepared')
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);

    const pendingPaymentTotal = filteredData
      .filter(
        (t) => normalizeOrderStatus(t['Order Status']) === 'pending payment'
      )
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);

    const uniqueCustomers = new Set(
      filteredData.map((t) => t.Customers).filter(Boolean)
    ).size;

    const adjustmentTotal = filteredData.reduce(
      (sum, t) => sum + (t['Adjustment'] || 0),
      0
    );

    const shippedOrders = filteredData.filter(
      (t) => normalizeOrderStatus(t['Order Status']) === 'shipped'
    ).length;

    const lineTotalExcludingCancelled = filteredData
      .filter((t) => !isCancelledOrderStatus(t['Order Status']))
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);

    return {
      totalTransactions,
      totalRevenue,
      inTransitTotal,
      warehouseTotal,
      preparedTotal,
      pendingPaymentTotal,
      uniqueCustomers,
      adjustmentTotal,
      shippedOrders,
      lineTotalExcludingCancelled,
    };
  }

  // ============================================================================
  // TRANSACTION SYNC - Update order status based on shipment status
  // ============================================================================

  /**
   * Sync transactions with current shipment status
   * Only updates "In Transit" or "Warehouse" statuses (doesn't override manual statuses).
   *
   * @param transactions - All transactions
   * @param statusMap - Product code to shipment status mapping
   * @returns Array of [updated transactions, count of updates]
   */
  static syncTransactionsWithShipmentStatus(
    transactions: TransactionData[],
    statusMap: Record<string, string>
  ): [TransactionData[], number] {
    let updatedCount = 0;

    const updatedTransactions = transactions.map((transaction) => {
      const productCode = transaction['Product Code'];

      if (!productCode) {
        return transaction;
      }

      const currentOrderStatus = transaction['Order Status'] || '';

      const normalizedCurrentOrderStatus =
        normalizeOrderStatus(currentOrderStatus);

      const isAutoStatus =
        normalizedCurrentOrderStatus === '' ||
        normalizedCurrentOrderStatus === 'in transit' ||
        normalizedCurrentOrderStatus === 'warehouse';

      // Only auto-populate if order status is blank / In Transit / Warehouse.
      // Don't overwrite manual statuses (e.g. Shipped, Cancelled, Prepared, etc.)
      if (!isAutoStatus) {
        return transaction;
      }

      // Get shipment status from the map
      const currentShipmentStatus = statusMap[productCode] || '';

      // If shipment status is blank, set to "In Transit"
      // Otherwise, convert shipment status to order status
      const newOrderStatus = currentShipmentStatus
        ? this.getOrderStatusFromShipmentStatus(currentShipmentStatus)
        : 'In Transit';

      if (
        normalizeOrderStatus(currentOrderStatus) !==
        normalizeOrderStatus(newOrderStatus)
      ) {
        updatedCount++;
        logger.debug(
          `Syncing transaction: ${productCode} -> ${currentOrderStatus} to ${newOrderStatus} (shipment status: ${currentShipmentStatus || 'none'})`
        );
        return {
          ...transaction,
          'Order Status': newOrderStatus,
        };
      }

      return transaction;
    });

    return [updatedTransactions, updatedCount];
  }

  // ============================================================================
  // CSV IMPORT TRANSFORMATION
  // ============================================================================

  /**
   * Parse CSV line handling quoted fields
   */
  static parseCSVLine(line: string): string[] {
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
   * Transform CSV text to TransactionData array
   */
  static transformCSVToTransactions(csvText: string): TransactionData[] {
    const lines = csvText.split('\n');
    const headers = this.parseCSVLine(lines[0]);

    const headerMap: Record<string, keyof TransactionData> = {
      'ORDER DATE': 'Order Date',
      CUSTOMERS: 'Customers',
      'PRODUCT CODE': 'Product Code',
      QUANTITY: 'Quantity',
      'UNIT PRICE': 'Unit Price',
      DISCOUNT: 'Discount',
      ADJUSTMENT: 'Adjustment',
      'LINE TOTAL': 'Line Total',
      'ORDER STATUS': 'Order Status',
      NOTES: 'Notes',
      'INVOICE DATE': 'Invoice Date',
      'PACKED DATE': 'Packed Date',
      'SHIPMENT CODE': 'Shipment Code',
    };

    const importedTransactions: TransactionData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const values = this.parseCSVLine(line);
        const transactionData: Record<string, string | number | null> = {
          id: Date.now() + Math.random() * 10000 + i * 100,
        };

        headers.forEach((rawHeader, index) => {
          const normalized = headerMap[rawHeader.trim().toUpperCase()];
          if (!normalized) {
            return;
          }

          const rawValue = values[index];
          if (rawValue === undefined || rawValue === '') {
            return;
          }

          // Convert numeric fields
          if (
            [
              'Quantity',
              'Unit Price',
              'Discount',
              'Adjustment',
              'Line Total',
            ].includes(normalized as string)
          ) {
            const sanitized = rawValue.replace(/[^0-9.\-]/g, '').trim();
            const num = parseFloat(sanitized);
            transactionData[normalized] = Number.isFinite(num) ? num : 0;
          } else {
            transactionData[normalized] = rawValue;
          }
        });

        importedTransactions.push(
          transactionData as unknown as TransactionData
        );
      }
    }

    return importedTransactions;
  }

  // ============================================================================
  // PACKING LIST TRANSFORMATION
  // ============================================================================

  /**
   * Transform TransactionData to PackingListTransaction format
   */
  static transformToPackingListTransaction(
    transaction: TransactionData
  ): PackingListTransaction {
    return {
      id: String(transaction.id || ''),
      orderDate: transaction['Order Date'] || '',
      customers: transaction.Customers || '',
      productCode: transaction['Product Code'] || '',
      quantity: Number(transaction.Quantity) || 0,
      unitPrice: Number(transaction['Unit Price']) || 0,
      discount: Number(transaction.Discount) || 0,
      adjustment: Number(transaction.Adjustment) || 0,
      lineTotal: Number(transaction['Line Total']) || 0,
      status: transaction['Order Status'] || '',
      notes: transaction.Notes || '',
      invoiceDate: transaction['Invoice Date'] || '',
      packedDate: transaction['Packed Date'] || '',
      shipmentCode: transaction['Shipment Code'] || '',
    };
  }

  /**
   * Transform array of transactions to packing list format
   */
  static transformToPackingListTransactions(
    transactions: TransactionData[]
  ): PackingListTransaction[] {
    return transactions.map((t) => this.transformToPackingListTransaction(t));
  }
}
