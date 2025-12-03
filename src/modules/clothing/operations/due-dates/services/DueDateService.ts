/**
 * Due Dates Service - Business Logic
 *
 * This service handles all due dates calculations and data processing.
 * It reuses FormatterService for consistent formatting across the app.
 */

import { FormatterService } from '@/services/FormatterService';
import type {
  DueDateItem,
  DueDateStats,
  DueDateTransaction,
} from '../types/dueDate.types';

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
   * Calculate due date (Invoice Date + 3 days)
   * Returns the exact timestamp 72 hours after invoice
   *
   * Handles both old format ("November 7, 2025") and new ISO timestamps
   */
  static calculateDueDate(invoiceDate: string): string {
    if (!invoiceDate || invoiceDate.trim() === '') {
      return '';
    }

    try {
      const invoiceTime = new Date(invoiceDate);

      // Add exactly 72 hours (3 days × 24 hours)
      const dueTime = new Date(invoiceTime.getTime() + 72 * 60 * 60 * 1000);
      return dueTime.toISOString();
    } catch (error) {
      return '';
    }
  }

  /**
   * Calculate hours until due date from current time
   */
  static calculateHoursUntilDue(dueDate: string): number {
    if (!dueDate || dueDate.trim() === '') {
      return 0;
    }

    try {
      const due = new Date(dueDate);
      const now = new Date();

      const diffTime = due.getTime() - now.getTime();
      const diffHours = Math.round(diffTime / (1000 * 60 * 60));
      return diffHours;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate total hours from invoice date to due date (always 72 hours for 3 days)
   */
  static calculateTotalHoursToDue(invoiceDate: string): number {
    if (!invoiceDate || invoiceDate.trim() === '') {
      return 0;
    }

    try {
      // Since due date is always Invoice Date + 3 days, this is always 72 hours
      return 72;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Process transactions into due date items
   * Groups by customer and sums line totals
   */
  static processDueDateItems(
    transactions: DueDateTransaction[]
  ): DueDateItem[] {
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
    const items = Array.from(customerMap.values()).map((data, index) => {
      const dueDate = this.calculateDueDate(data.invoiceDate);
      const dueIn = this.calculateHoursUntilDue(dueDate);

      return {
        id: `customer-${index}`,
        customer: data.customer,
        productCode: '',
        quantity: 0,
        unitPrice: 0,
        lineTotal: data.lineTotal,
        invoiceDate: data.invoiceDate,
        dueDate: dueDate,
        dueIn: dueIn,
        contactBuyer: '', // Will be added later
      };
    });

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
        return matchesSearch && item.dueIn >= 0 && item.dueIn <= 168; // 7 days = 168 hours
      }
      if (statusFilter === 'on-track') {
        return matchesSearch && item.dueIn > 168;
      }

      return matchesSearch;
    });
  }

  /**
   * Get customer orders from transactions
   */
  static getCustomerOrders(
    transactions: DueDateTransaction[],
    customerName: string
  ): DueDateTransaction[] {
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
      dueSoon: items.filter((i) => i.dueIn >= 0 && i.dueIn <= 168).length, // 7 days = 168 hours
      onTrack: items.filter((i) => i.dueIn > 168).length,
      total: items.length,
    };
  }
}
