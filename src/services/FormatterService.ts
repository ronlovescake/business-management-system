/**
 * Formatter Service - Centralized Data Formatting
 *
 * This service provides consistent formatting functions across the entire application.
 * Use these formatters in your modules instead of writing custom formatting logic.
 */

export const CURRENCY_SYMBOL = '₱';

export class FormatterService {
  /** Global currency symbol used across the application */
  static readonly currencySymbol = CURRENCY_SYMBOL;
  /**
   * Format a number as Philippine Peso currency
   * @example formatCurrency(1500.50) → "₱1,500.50"
   */
  static formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined || isNaN(value)) {
      return `${this.currencySymbol}0.00`;
    }

    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  /**
   * Format a number with thousands separator
   * @example formatNumber(1500.75) → "1,500.75"
   */
  static formatNumber(
    value: number | null | undefined,
    decimals: number = 2
  ): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0.00';
    }

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }

  /**
   * Format a date as "April 01, 2026" (standard format)
   * @param date - Date string, Date object, or ISO string
   */
  static formatDate(date: string | Date | null | undefined): string {
    if (!date) {
      return '';
    }

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;

      if (isNaN(dateObj.getTime())) {
        return '';
      }

      return dateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Manila',
      });
    } catch {
      return '';
    }
  }

  /**
   * Format a date as "April 01, 2026" (standard format)
   * @param date - Date string, Date object, or ISO string
   */
  static formatDateShort(date: string | Date | null | undefined): string {
    if (!date) {
      return '';
    }

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;

      if (isNaN(dateObj.getTime())) {
        return '';
      }

      return dateObj.toLocaleDateString('en-US', {
        month: 'long',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Manila',
      });
    } catch {
      return '';
    }
  }

  /**
   * Format a date as ISO string (YYYY-MM-DD)
   * @param date - Date string or Date object
   */
  static formatDateISO(date: string | Date | null | undefined): string {
    if (!date) {
      return '';
    }

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;

      if (isNaN(dateObj.getTime())) {
        return '';
      }

      return dateObj.toISOString().split('T')[0];
    } catch {
      return '';
    }
  }

  /**
   * Format time as "12:00 AM" (standard format)
   * @param time - Time string or Date object
   */
  static formatTime(time: string | Date | null | undefined): string {
    if (!time) {
      return '';
    }

    try {
      const dateObj = typeof time === 'string' ? new Date(time) : time;

      if (isNaN(dateObj.getTime())) {
        return '';
      }

      return dateObj.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila',
      });
    } catch {
      return '';
    }
  }

  /**
   * Format datetime as "April 01, 2026 · 12:00 AM" (standard format)
   */
  static formatDateTime(datetime: string | Date | null | undefined): string {
    if (!datetime) {
      return '';
    }

    try {
      const dateObj =
        typeof datetime === 'string' ? new Date(datetime) : datetime;

      if (isNaN(dateObj.getTime())) {
        return '';
      }

      const datePart = this.formatDateShort(dateObj);
      const timePart = this.formatTime(dateObj);

      return `${datePart} \u00B7 ${timePart}`;
    } catch {
      return '';
    }
  }

  /**
   * Format a phone number (Philippine format)
   * @example formatPhone("09171234567") → "(0917) 123-4567"
   */
  static formatPhone(phone: string | null | undefined): string {
    if (!phone) {
      return '';
    }

    // Remove all non-digits
    const cleaned = phone.replace(/\D/g, '');

    // Philippine mobile format: 09XX-XXX-XXXX
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      return `(${cleaned.slice(0, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }

    // Landline format: XXX-XXXX
    if (cleaned.length === 7) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    }

    // Return as-is if doesn't match expected format
    return phone;
  }

  /**
   * Format a percentage
   * @example formatPercent(0.85) → "85%"
   * @example formatPercent(0.5, 2) → "50.00%"
   */
  static formatPercent(
    value: number | null | undefined,
    decimals: number = 0
  ): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0%';
    }

    return `${(value * 100).toFixed(decimals)}%`;
  }

  /**
   * Format file size in human-readable format
   * @example formatFileSize(1536) → "1.50 KB"
   */
  static formatFileSize(bytes: number | null | undefined): string {
    if (!bytes || bytes === 0) {
      return '0 Bytes';
    }

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Truncate string with ellipsis
   * @example truncate("Long text here", 10) → "Long text..."
   */
  static truncate(text: string | null | undefined, length: number): string {
    if (!text) {
      return '';
    }
    if (text.length <= length) {
      return text;
    }
    return text.substring(0, length) + '...';
  }

  /**
   * Capitalize first letter of each word
   * @example titleCase("hello world") → "Hello World"
   */
  static titleCase(text: string | null | undefined): string {
    if (!text) {
      return '';
    }

    return text
      .toLowerCase()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format order status with consistent capitalization
   * @example formatOrderStatus("in transit") → "In Transit"
   */
  static formatOrderStatus(status: string | null | undefined): string {
    if (!status) {
      return '';
    }

    // Specific cases
    const statusMap: Record<string, string> = {
      'in transit': 'In Transit',
      'for pickup': 'For Pickup',
      prepared: 'Prepared',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      'manila port': 'Manila Port',
      'with pier gatepass': 'With Pier Gatepass',
      'ph warehouse': 'PH Warehouse',
      sorting: 'Sorting',
    };

    const normalized = status.toLowerCase().trim();
    return statusMap[normalized] || this.titleCase(status);
  }
}
