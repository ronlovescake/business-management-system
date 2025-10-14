/**
 * Validation Service - Centralized Validation Logic
 *
 * This service provides reusable validation functions across the entire application.
 * Use these validators in your modules to ensure consistent validation rules.
 */

export interface ValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  customerData?: Record<string, unknown>;
}

export class ValidationService {
  /**
   * Validate a customer before allowing transactions
   * Checks for:
   * - Banned customer status
   * - High cancellation rate (≥50%)
   * - Customer exists in database
   */
  static async validateCustomer(
    customerName: string
  ): Promise<ValidationResult> {
    try {
      if (!customerName || customerName.trim() === '') {
        return { isValid: true, warnings: [], errors: [] };
      }

      // Fetch all customers to find the selected customer
      const response = await fetch('/api/customers');
      if (!response.ok) {
        logger.warn('Could not fetch customer data for validation');
        return { isValid: true, warnings: [], errors: [] };
      }

      const customersData = await response.json();
      const customer = customersData.find(
        (c: Record<string, unknown>) =>
          (c['Customer Name'] || c.customerName || c.name) ===
          customerName.trim()
      );

      if (!customer) {
        // Customer not found in database, allow but warn
        return {
          isValid: true,
          warnings: [`Customer "${customerName}" not found in database`],
          errors: [],
        };
      }

      const warnings: string[] = [];
      const errors: string[] = [];
      let isValid = true;
      const customerStatus =
        customer['Customer Status'] || customer.customerStatus || '';

      // Check if customer is banned
      if (customerStatus.toLowerCase().includes('banned')) {
        errors.push(
          `🚫 BANNED CUSTOMER: "${customerName}" is marked as BANNED`
        );
        isValid = false; // This is a critical error
      }

      // Calculate cancellation rate from transactions
      try {
        const customerId = customer.id;
        if (customerId) {
          const transactionsResponse = await fetch(
            `/api/customers/${customerId}/transactions`
          );
          if (transactionsResponse.ok) {
            const customerTransactions = await transactionsResponse.json();

            if (customerTransactions.length > 0) {
              const cancelledTransactions = customerTransactions.filter(
                (t: Record<string, unknown>) =>
                  String(t.orderStatus || '')
                    .toLowerCase()
                    .includes('cancel')
              ).length;

              const cancellationRate = Math.round(
                (cancelledTransactions / customerTransactions.length) * 100
              );

              if (cancellationRate >= 50) {
                // 50% or higher cancellation rate
                warnings.push(
                  `⚠️ HIGH CANCELLATION RATE: "${customerName}" has a ${cancellationRate}% cancellation rate (${cancelledTransactions}/${customerTransactions.length} orders cancelled)`
                );
              }
            }
          }
        }
      } catch (error) {
        logger.warn(
          'Could not calculate cancellation rate for customer:',
          error
        );
      }

      return {
        isValid,
        warnings,
        errors,
        customerData: customer,
      };
    } catch (error) {
      logger.error('Error validating customer:', error);
      return { isValid: true, warnings: [], errors: [] };
    }
  }

  /**
   * Validate email address format
   */
  static validateEmail(email: string | null | undefined): ValidationResult {
    if (!email || email.trim() === '') {
      return { isValid: true, warnings: [], errors: [] };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(email.trim());

    return {
      isValid,
      warnings: [],
      errors: isValid ? [] : ['Invalid email address format'],
    };
  }

  /**
   * Validate Philippine phone number
   * Accepts: 09XX-XXX-XXXX or XXX-XXXX format
   */
  static validatePhoneNumber(
    phone: string | null | undefined
  ): ValidationResult {
    if (!phone || phone.trim() === '') {
      return { isValid: true, warnings: [], errors: [] };
    }

    const cleaned = phone.replace(/\D/g, '');

    // Philippine mobile: 11 digits starting with 0
    const isMobile = cleaned.length === 11 && cleaned.startsWith('0');

    // Landline: 7 digits
    const isLandline = cleaned.length === 7;

    const isValid = isMobile || isLandline;

    return {
      isValid,
      warnings: [],
      errors: isValid
        ? []
        : ['Invalid phone number. Expected: 09XX-XXX-XXXX or XXX-XXXX'],
    };
  }

  /**
   * Validate required field is not empty
   */
  static validateRequired(
    value: string | number | null | undefined,
    fieldName: string = 'Field'
  ): ValidationResult {
    const isEmpty =
      value === null ||
      value === undefined ||
      (typeof value === 'string' && value.trim() === '');

    return {
      isValid: !isEmpty,
      warnings: [],
      errors: isEmpty ? [`${fieldName} is required`] : [],
    };
  }

  /**
   * Validate number is within range
   */
  static validateNumberRange(
    value: number | null | undefined,
    min: number,
    max: number,
    fieldName: string = 'Value'
  ): ValidationResult {
    if (value === null || value === undefined || isNaN(value)) {
      return {
        isValid: false,
        warnings: [],
        errors: [`${fieldName} must be a valid number`],
      };
    }

    const isValid = value >= min && value <= max;

    return {
      isValid,
      warnings: [],
      errors: isValid ? [] : [`${fieldName} must be between ${min} and ${max}`],
    };
  }

  /**
   * Validate positive number (greater than zero)
   */
  static validatePositiveNumber(
    value: number | null | undefined,
    fieldName: string = 'Value'
  ): ValidationResult {
    if (value === null || value === undefined || isNaN(value)) {
      return {
        isValid: false,
        warnings: [],
        errors: [`${fieldName} must be a valid number`],
      };
    }

    const isValid = value > 0;

    return {
      isValid,
      warnings: [],
      errors: isValid ? [] : [`${fieldName} must be greater than zero`],
    };
  }

  /**
   * Validate date is not in the past
   */
  static validateFutureDate(
    date: string | Date | null | undefined,
    fieldName: string = 'Date'
  ): ValidationResult {
    if (!date) {
      return {
        isValid: false,
        warnings: [],
        errors: [`${fieldName} is required`],
      };
    }

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Compare dates only, ignore time

      const isValid = dateObj >= now;

      return {
        isValid,
        warnings: [],
        errors: isValid ? [] : [`${fieldName} cannot be in the past`],
      };
    } catch {
      return {
        isValid: false,
        warnings: [],
        errors: [`${fieldName} is not a valid date`],
      };
    }
  }

  /**
   * Validate date range (start <= end)
   */
  static validateDateRange(
    startDate: string | Date | null | undefined,
    endDate: string | Date | null | undefined
  ): ValidationResult {
    if (!startDate || !endDate) {
      return {
        isValid: false,
        warnings: [],
        errors: ['Both start date and end date are required'],
      };
    }

    try {
      const start =
        typeof startDate === 'string' ? new Date(startDate) : startDate;
      const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

      const isValid = start <= end;

      return {
        isValid,
        warnings: [],
        errors: isValid ? [] : ['End date must be after start date'],
      };
    } catch {
      return {
        isValid: false,
        warnings: [],
        errors: ['Invalid date range'],
      };
    }
  }

  /**
   * Combine multiple validation results
   * Useful when validating multiple fields at once
   */
  static combineValidations(...results: ValidationResult[]): ValidationResult {
    const combined: ValidationResult = {
      isValid: true,
      warnings: [],
      errors: [],
    };

    for (const result of results) {
      if (!result.isValid) {
        combined.isValid = false;
      }
      combined.warnings.push(...result.warnings);
      combined.errors.push(...result.errors);
    }

    return combined;
  }
}
