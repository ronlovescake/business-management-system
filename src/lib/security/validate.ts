/**
 * Input Validation Utilities
 *
 * Additional validation helpers that work alongside sanitization
 *
 * @module lib/security/validate
 */

import { sanitizers } from './sanitize';

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: unknown;
}

/**
 * Field validation rules
 */
export interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean | string;
}

/**
 * Validate a single field
 */
export function validateField(
  value: unknown,
  fieldName: string,
  rules: ValidationRules = {}
): ValidationResult {
  const errors: string[] = [];

  // Required check
  if (
    rules.required &&
    (value === null || value === undefined || value === '')
  ) {
    errors.push(`${fieldName} is required`);
    return { isValid: false, errors };
  }

  // If not required and empty, skip other validations
  if (!value && !rules.required) {
    return { isValid: true, errors: [], sanitized: value };
  }

  const strValue = String(value);

  // Length validations
  if (rules.minLength && strValue.length < rules.minLength) {
    errors.push(`${fieldName} must be at least ${rules.minLength} characters`);
  }

  if (rules.maxLength && strValue.length > rules.maxLength) {
    errors.push(`${fieldName} must be at most ${rules.maxLength} characters`);
  }

  // Numeric validations
  const numValue = Number(value);
  if (typeof value === 'number' || !isNaN(numValue)) {
    if (rules.min !== undefined && numValue < rules.min) {
      errors.push(`${fieldName} must be at least ${rules.min}`);
    }
    if (rules.max !== undefined && numValue > rules.max) {
      errors.push(`${fieldName} must be at most ${rules.max}`);
    }
  }

  // Pattern matching
  if (rules.pattern && !rules.pattern.test(strValue)) {
    errors.push(`${fieldName} has invalid format`);
  }

  // Custom validation
  if (rules.custom) {
    const result = rules.custom(value);
    if (typeof result === 'string') {
      errors.push(result);
    } else if (!result) {
      errors.push(`${fieldName} is invalid`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: value,
  };
}

/**
 * Validate multiple fields
 */
export function validateFields(
  data: Record<string, unknown>,
  rules: Record<string, ValidationRules>
): ValidationResult {
  const allErrors: string[] = [];
  const sanitized: Record<string, unknown> = {};

  for (const fieldName in rules) {
    const result = validateField(data[fieldName], fieldName, rules[fieldName]);
    if (!result.isValid) {
      allErrors.push(...result.errors);
    }
    sanitized[fieldName] = result.sanitized;
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    sanitized,
  };
}

/**
 * Common field validators
 */
export const validators = {
  email: {
    required: true,
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    maxLength: 255,
  },

  phone: {
    required: false,
    pattern: /^[\d\s\-()+ ]{7,20}$/,
  },

  url: {
    required: false,
    pattern: /^https?:\/\/.+/,
    maxLength: 2000,
  },

  name: {
    required: true,
    minLength: 1,
    maxLength: 255,
  },

  productCode: {
    required: true,
    pattern: /^[A-Z0-9\-_]{1,50}$/,
    maxLength: 50,
  },

  date: {
    required: true,
    pattern: /^\d{4}-\d{2}-\d{2}$/,
  },

  positiveNumber: {
    required: true,
    min: 0,
  },

  percentage: {
    required: true,
    min: 0,
    max: 100,
  },
};

/**
 * Sanitize and validate customer data
 */
export function validateCustomer(
  data: Record<string, unknown>
): ValidationResult {
  // Sanitize first
  const sanitized = {
    'Customer Name': sanitizers.name(data['Customer Name']),
    'Phone Number': sanitizers.phone(data['Phone Number']),
    'Email Address': sanitizers.email(data['Email Address']),
    Address: sanitizers.address(data.Address),
    Facebook: sanitizers.url(data.Facebook),
    'Business Name': sanitizers.name(data['Business Name']),
    'Tax Number': sanitizers.name(data['Tax Number']),
    'Business Address': sanitizers.address(data['Business Address']),
    'Business Contact Number': sanitizers.phone(
      data['Business Contact Number']
    ),
  };

  // Validate required fields
  const errors: string[] = [];

  if (!sanitized['Customer Name']) {
    errors.push('Customer Name is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Sanitize and validate employee data
 */
export function validateEmployee(
  data: Record<string, unknown>
): ValidationResult {
  const sanitized = {
    employeeId: sanitizers.productCode(data.employeeId),
    firstName: sanitizers.name(data.firstName),
    lastName: sanitizers.name(data.lastName),
    email: sanitizers.email(data.email),
    phone: sanitizers.phone(data.phone),
    department: sanitizers.name(data.department),
    position: sanitizers.name(data.position),
    hireDate: sanitizers.date(data.hireDate),
  };

  const errors: string[] = [];

  if (!sanitized.employeeId) {
    errors.push('Employee ID is required');
  }
  if (!sanitized.firstName) {
    errors.push('First Name is required');
  }
  if (!sanitized.lastName) {
    errors.push('Last Name is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Sanitize and validate product data
 */
export function validateProduct(
  data: Record<string, unknown>
): ValidationResult {
  const sanitized = {
    'Product Code': sanitizers.productCode(data['Product Code']),
    Product: sanitizers.name(data.Product),
    'Age Range': sanitizers.name(data['Age Range']),
    Quantity: sanitizers.number(data.Quantity, { min: 0 }),
    'Unit Price': sanitizers.number(data['Unit Price'], {
      min: 0,
      decimals: 2,
    }),
    'Actual Price': sanitizers.number(data['Actual Price'], {
      min: 0,
      decimals: 2,
    }),
  };

  const errors: string[] = [];

  if (!sanitized['Product Code']) {
    errors.push('Product Code is required');
  }
  if (!sanitized.Product) {
    errors.push('Product name is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Sanitize and validate transaction data
 */
export function validateTransaction(
  data: Record<string, unknown>
): ValidationResult {
  const sanitized = {
    'Order Date': sanitizers.date(data['Order Date']),
    Customers: sanitizers.name(data.Customers),
    'Product Code': sanitizers.productCode(data['Product Code']),
    Quantity: sanitizers.number(data.Quantity, { min: 0 }),
    'Unit Price': sanitizers.number(data['Unit Price'], {
      min: 0,
      decimals: 2,
    }),
    Discount: sanitizers.number(data.Discount, { min: 0, decimals: 2 }),
    Adjustment: sanitizers.number(data.Adjustment, { decimals: 2 }),
    Notes: sanitizers.notes(data.Notes),
  };

  const errors: string[] = [];

  if (!sanitized['Order Date']) {
    errors.push('Order Date is required');
  }
  if (!sanitized.Customers) {
    errors.push('Customer name is required');
  }
  if (!sanitized['Product Code']) {
    errors.push('Product Code is required');
  }
  if (sanitized.Quantity === null || sanitized.Quantity === 0) {
    errors.push('Quantity must be greater than 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized,
  };
}
