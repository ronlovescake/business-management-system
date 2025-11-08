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

  /**
   * Determine Order Status based on Shipment Status
   *
   * Rules:
   * - Blank, "In Transit", "Manila Port", "With Pier Gatepass", "PH Warehouse" → "In Transit"
   * - "For Pickup", "Sorting", "Delivered" → "Warehouse"
   * - Default fallback → "In Transit"
   *
   * @param shipmentStatus - The shipment status
   * @returns The corresponding order status
   */
  static getOrderStatusFromShipmentStatus(shipmentStatus: string): string {
    if (!shipmentStatus || shipmentStatus.trim() === '') {
      return 'In Transit';
    }

    const normalizedStatus = shipmentStatus.trim();

    const inTransitStatuses = [
      'In Transit',
      'Manila Port',
      'With Pier Gatepass',
      'PH Warehouse',
    ];

    const warehouseStatuses = ['For Pickup', 'Sorting', 'Delivered'];

    if (inTransitStatuses.includes(normalizedStatus)) {
      return 'In Transit';
    } else if (warehouseStatuses.includes(normalizedStatus)) {
      return 'Warehouse';
    }

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
    const totalTransactions = filteredData.length;

    // Exclude cancelled orders from revenue
    const activeTransactions = filteredData.filter(
      (t) => t['Order Status']?.toLowerCase() !== 'cancelled'
    );

    const totalRevenue = activeTransactions.reduce(
      (sum, t) => sum + (t.Quantity || 0) * (t['Unit Price'] || 0),
      0
    );

    const inTransitTotal = filteredData
      .filter((t) => t['Order Status']?.toLowerCase() === 'in transit')
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);

    const warehouseTotal = filteredData
      .filter((t) => t['Order Status']?.toLowerCase() === 'warehouse')
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);

    const preparedTotal = filteredData
      .filter((t) => t['Order Status']?.toLowerCase() === 'prepared')
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);

    const pendingPaymentTotal = filteredData
      .filter((t) => t['Order Status']?.toLowerCase() === 'pending payment')
      .reduce((sum, t) => sum + (t['Line Total'] || 0), 0);

    const uniqueCustomers = new Set(
      filteredData.map((t) => t.Customers).filter(Boolean)
    ).size;

    const lalamoveOrders = filteredData.filter(
      (t) => t['Order Status']?.toLowerCase() === 'lalamove'
    ).length;

    const shippedOrders = filteredData.filter(
      (t) => t['Order Status']?.toLowerCase() === 'shipped'
    ).length;

    const deliveredOrders = filteredData.filter(
      (t) => t['Order Status']?.toLowerCase() === 'delivered'
    ).length;

    return {
      totalTransactions,
      totalRevenue,
      inTransitTotal,
      warehouseTotal,
      preparedTotal,
      pendingPaymentTotal,
      uniqueCustomers,
      lalamoveOrders,
      shippedOrders,
      deliveredOrders,
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

      // Only auto-populate if order status is blank
      if (currentOrderStatus !== '') {
        return transaction;
      }

      // Default to empty string if product not in statusMap
      const currentShipmentStatus = statusMap[productCode] || '';

      const newOrderStatus = this.getOrderStatusFromShipmentStatus(
        currentShipmentStatus
      );

      if (currentOrderStatus !== newOrderStatus) {
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

  // ============================================================================
  // EMPTY ROWS GENERATION
  // ============================================================================

  /**
   * Generate empty transaction rows
   */
  static generateEmptyRows(count: number): TransactionData[] {
    const newEmptyRows: TransactionData[] = [];

    for (let i = 0; i < count; i++) {
      newEmptyRows.push({
        id: Date.now() + Math.random() * 10000 + i * 100,
        'Order Date': '',
        Customers: '',
        'Product Code': '',
        Quantity: null,
        'Unit Price': null,
        Discount: null,
        Adjustment: null,
        'Line Total': null,
        'Order Status': '',
        Notes: '',
        'Invoice Date': '',
        'Packed Date': '',
        'Shipment Code': '-',
      });
    }

    return newEmptyRows;
  }
}
