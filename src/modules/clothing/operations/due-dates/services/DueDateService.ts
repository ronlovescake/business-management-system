/**
 * Due Dates Service - Business Logic
 *
 * This service handles all due dates calculations and data processing.
 * It reuses FormatterService for consistent formatting across the app.
 */

import { FormatterService } from '@/services/FormatterService';
import type { DueDateItem, DueDateStats } from '../types/dueDate.types';

// Transaction type (from existing codebase)
interface Transaction {
  'Invoice Date': string;
  'Line Total': number;
  'Order Status': string;
  Customers: string;
  'Product Code'?: string;
  Quantity?: number;
  'Unit Price'?: number;
  'Order Date'?: string;
}

export class DueDateService {
  /**
   * Reuse shared formatter for currency
   */
  static formatCurrency = FormatterService.formatCurrency;

  /**
   * Reuse shared formatter for dates (short format)
   */
  static formatDate = FormatterService.formatDateShort;

  /**
   * Process transactions into due date items
   * Groups by customer and sums line totals
   */
  static processDueDateItems(transactions: Transaction[]): DueDateItem[] {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Filter transactions that have an invoice date
    const transactionsWithInvoice = transactions.filter(
      (t) =>
        t['Invoice Date'] &&
        t['Invoice Date'].trim() !== '' &&
        t['Line Total'] > 0 &&
        t['Order Status'] === 'Prepared'
    );

    if (transactionsWithInvoice.length === 0) {
      return [];
    }

    // Group by customer and sum line totals
    const customerMap = new Map<
      string,
      {
        customer: string;
        lineTotal: number;
        invoiceDate: string;
        count: number;
      }
    >();

    transactionsWithInvoice.forEach((txn) => {
      const customer = txn.Customers;
      if (!customer) {
        return;
      }

      if (customerMap.has(customer)) {
        const existing = customerMap.get(customer);
        if (!existing) {
          return;
        }
        existing.lineTotal += txn['Line Total'];
        existing.count += 1;
        // Keep the earliest invoice date
        if (txn['Invoice Date'] < existing.invoiceDate) {
          existing.invoiceDate = txn['Invoice Date'];
        }
      } else {
        customerMap.set(customer, {
          customer: customer,
          lineTotal: txn['Line Total'],
          invoiceDate: txn['Invoice Date'],
          count: 1,
        });
      }
    });

    // Convert to array and sort alphabetically
    const items = Array.from(customerMap.values()).map((data, index) => ({
      id: `customer-${index}`,
      customer: data.customer,
      productCode: '',
      quantity: 0,
      unitPrice: 0,
      lineTotal: data.lineTotal,
      invoiceDate: data.invoiceDate,
      dueDate: '', // Will be calculated later
      dueIn: 0, // Will be calculated later
      contactBuyer: '', // Will be added later
    }));

    // Sort by customer name alphabetically
    return items.sort((a, b) => a.customer.localeCompare(b.customer));
  }

  /**
   * Filter due date items based on search query and status
   */
  static filterDueDateItems(
    items: DueDateItem[],
    searchQuery: string,
    statusFilter: string | null
  ): DueDateItem[] {
    return items.filter((item) => {
      const matchesSearch =
        searchQuery === '' ||
        item.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.productCode.toLowerCase().includes(searchQuery.toLowerCase());

      if (statusFilter === 'all') {
        return matchesSearch;
      }
      if (statusFilter === 'overdue') {
        return matchesSearch && item.dueIn < 0;
      }
      if (statusFilter === 'due-soon') {
        return matchesSearch && item.dueIn >= 0 && item.dueIn <= 7;
      }
      if (statusFilter === 'on-track') {
        return matchesSearch && item.dueIn > 7;
      }

      return matchesSearch;
    });
  }

  /**
   * Get customer orders from transactions
   */
  static getCustomerOrders(
    transactions: Transaction[],
    customerName: string
  ): Transaction[] {
    if (!transactions || !customerName) {
      return [];
    }

    return transactions.filter(
      (t) =>
        t.Customers === customerName &&
        t['Invoice Date'] &&
        t['Invoice Date'].trim() !== '' &&
        t['Line Total'] > 0 &&
        t['Order Status'] === 'Prepared'
    );
  }

  /**
   * Calculate statistics for due dates
   */
  static calculateStats(items: DueDateItem[]): DueDateStats {
    return {
      overdue: items.filter((i) => i.dueIn < 0).length,
      dueSoon: items.filter((i) => i.dueIn >= 0 && i.dueIn <= 7).length,
      onTrack: items.filter((i) => i.dueIn > 7).length,
      total: items.length,
    };
  }
}
