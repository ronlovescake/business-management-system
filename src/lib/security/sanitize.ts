/**
 * Input Sanitization & XSS Protection Utilities
 *
 * Provides server-side and client-side sanitization functions
 * to prevent XSS, SQL injection, and other injection attacks.
 *
 * @module lib/security/sanitize
 */

/**
 * Sanitization options
 */
export interface SanitizeOptions {
  /** Allow HTML tags (default: false) */
  allowHtml?: boolean;
  /** Trim whitespace (default: true) */
  trim?: boolean;
  /** Maximum length (default: unlimited) */
  maxLength?: number;
  /** Allow special characters (default: true) */
  allowSpecialChars?: boolean;
}

/**
 * Basic string sanitization for server-side
 * Removes potentially dangerous characters while preserving legitimate input
 */
export function sanitizeString(
  input: unknown,
  options: SanitizeOptions = {}
): string {
  // Handle null/undefined
  if (input === null || input === undefined) {
    return '';
  }

  // Convert to string
  let str = String(input);

  // Trim whitespace by default
  if (options.trim !== false) {
    str = str.trim();
  }

  // Remove null bytes
  str = str.replace(/\0/g, '');

  // If HTML is not allowed, escape HTML entities
  if (!options.allowHtml) {
    str = escapeHtml(str);
  }

  // Apply max length
  if (options.maxLength && str.length > options.maxLength) {
    str = str.substring(0, options.maxLength);
  }

  // Remove dangerous control characters
  // Keep: \n (newline), \r (carriage return), \t (tab)
  str = str.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  return str;
}

/**
 * Escape HTML entities to prevent XSS
 * Note: Forward slash (/) and ampersand (&) are not escaped as they're commonly used in product/brand names
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
  };
  return text.replace(/[<>"']/g, (char) => map[char] || char);
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: unknown): string {
  if (!email) {
    return '';
  }

  const str = String(email).trim().toLowerCase();

  // Basic email validation pattern
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  if (!emailRegex.test(str)) {
    return '';
  }

  return str;
}

/**
 * Sanitize phone number (keep only digits, spaces, hyphens, parentheses, plus)
 */
export function sanitizePhone(phone: unknown): string {
  if (!phone) {
    return '';
  }

  const str = String(phone).trim();

  // Remove all characters except digits, spaces, hyphens, parentheses, plus
  return str.replace(/[^0-9\s\-()+ ]/g, '');
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url: unknown): string {
  if (!url) {
    return '';
  }

  const str = String(url).trim();

  // Only allow http, https, and mailto protocols
  const urlRegex = /^(https?:\/\/|mailto:)/i;

  if (!urlRegex.test(str)) {
    // If no protocol, assume https
    if (!str.includes('://') && !str.startsWith('mailto:')) {
      return `https://${str}`;
    }
    return '';
  }

  try {
    const parsed = new URL(str);
    // Validate protocol
    if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Sanitize numeric input
 */
export function sanitizeNumber(
  input: unknown,
  options: { min?: number; max?: number; decimals?: number } = {}
): number | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }

  // Clean currency symbols and thousands separators (commas)
  let cleaned = String(input);
  // Remove currency symbols (₱, $, €, £, ¥, etc.) and whitespace
  cleaned = cleaned.replace(/[₱$€£¥¢₹₽₩₪₦₴₵₸₺₻₼₾₿\s]/g, '');
  // Remove thousands separators (commas)
  cleaned = cleaned.replace(/,/g, '');

  // Convert to number
  const num = typeof input === 'number' ? input : parseFloat(cleaned);

  // Check if valid number
  if (isNaN(num) || !isFinite(num)) {
    return null;
  }

  // Apply min/max constraints
  let result = num;
  if (options.min !== undefined && result < options.min) {
    result = options.min;
  }
  if (options.max !== undefined && result > options.max) {
    result = options.max;
  }

  // Apply decimal precision
  if (options.decimals !== undefined) {
    result = parseFloat(result.toFixed(options.decimals));
  }

  return result;
}

/**
 * Sanitize date string
 */
export function sanitizeDate(date: unknown): string {
  if (!date) {
    return '';
  }

  const str = String(date).trim();

  // Validate ISO date format or common formats
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;

  if (!isoRegex.test(str) && !dateRegex.test(str)) {
    // Try to parse as Date
    const parsed = new Date(str);
    if (isNaN(parsed.getTime())) {
      return '';
    }
    return parsed.toISOString().split('T')[0];
  }

  return str;
}

/**
 * Sanitize product code (alphanumeric, hyphens, underscores, spaces, parentheses, forward slash, periods, and ampersand)
 */
export function sanitizeProductCode(code: unknown): string {
  if (!code) {
    return '';
  }

  const str = String(code).trim();

  // Keep alphanumeric, hyphens, underscores, spaces, parentheses, forward slash, periods, and ampersand
  // Preserve original casing
  return str.replace(/[^a-zA-Z0-9\-_() /.&]/g, '');
}

/**
 * Sanitize object - recursively sanitize all string properties
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  options: SanitizeOptions = {}
): T {
  const sanitized = { ...obj };

  for (const key in sanitized) {
    const value = sanitized[key];

    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, options) as T[Extract<
        keyof T,
        string
      >];
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string'
          ? sanitizeString(item, options)
          : typeof item === 'object' && item !== null
            ? sanitizeObject(item as Record<string, unknown>, options)
            : item
      ) as T[Extract<keyof T, string>];
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(
        value as Record<string, unknown>,
        options
      ) as T[Extract<keyof T, string>];
    }
  }

  return sanitized;
}

/**
 * Validate and sanitize SQL-like input (for raw queries)
 * WARNING: Prefer using Prisma's parameterized queries
 */
export function sanitizeSqlInput(input: unknown): string {
  if (!input) {
    return '';
  }

  const str = String(input).trim();

  // Block common SQL injection patterns
  const dangerousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
    /(--|\/\*|\*\/|;|'|")/g,
    /(\bOR\b|\bAND\b).*=/gi,
    /(\bUNION\b|\bJOIN\b)/gi,
  ];

  const sanitized = str;
  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      // If dangerous pattern found, return empty or throw error
      throw new Error('Invalid input: potential SQL injection detected');
    }
  }

  return sanitized;
}

/**
 * Remove script tags and dangerous attributes from HTML
 * For use cases where some HTML is allowed but needs to be safe
 */
export function sanitizeHtml(html: string): string {
  if (!html) {
    return '';
  }

  let sanitized = html;

  // Remove script tags and content
  sanitized = sanitized.replace(
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    ''
  );

  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');

  // Remove data: protocol (can be used for XSS)
  sanitized = sanitized.replace(/data:text\/html/gi, '');

  // Remove iframe, object, embed tags
  sanitized = sanitized.replace(
    /<(iframe|object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi,
    ''
  );

  return sanitized;
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(fileName: unknown): string {
  if (!fileName) {
    return '';
  }

  const str = String(fileName).trim();

  // Remove path traversal attempts
  let sanitized = str.replace(/\.\./g, '');

  // Remove special characters except dot, hyphen, underscore
  sanitized = sanitized.replace(/[^a-zA-Z0-9.\-_]/g, '_');

  // Prevent hidden files
  if (sanitized.startsWith('.')) {
    sanitized = sanitized.substring(1);
  }

  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.split('.').pop() || '';
    const name = sanitized.substring(0, 255 - ext.length - 1);
    sanitized = `${name}.${ext}`;
  }

  return sanitized;
}

/**
 * Type-specific sanitizers for common fields
 */
export const sanitizers = {
  /** Customer/Employee name */
  name: (input: unknown) => sanitizeString(input, { maxLength: 255 }),

  /** Email address */
  email: sanitizeEmail,

  /** Phone number */
  phone: sanitizePhone,

  /** URL/Website */
  url: sanitizeUrl,

  /** Product code */
  productCode: sanitizeProductCode,

  /** Date */
  date: sanitizeDate,

  /** Address */
  address: (input: unknown) =>
    sanitizeString(input, { maxLength: 500, allowSpecialChars: true }),

  /** Notes/Comments */
  notes: (input: unknown) =>
    sanitizeString(input, { maxLength: 2000, allowSpecialChars: true }),

  /** Description */
  description: (input: unknown) =>
    sanitizeString(input, { maxLength: 5000, allowSpecialChars: true }),

  /** Numeric fields */
  number: sanitizeNumber,

  /** File name */
  fileName: sanitizeFileName,
};

/**
 * Middleware helper to sanitize request body
 */
export function sanitizeRequestBody<T extends Record<string, unknown>>(
  body: T,
  options: SanitizeOptions = {}
): T {
  return sanitizeObject(body, options);
}
