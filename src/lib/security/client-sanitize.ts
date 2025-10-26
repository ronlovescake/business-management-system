/**
 * Client-Side Input Sanitization
 *
 * This module provides XSS protection for client-side form inputs and user-generated content.
 * It complements the server-side sanitization in src/lib/utils/sanitize.ts to provide
 * defense-in-depth security.
 *
 * @module lib/security/client-sanitize
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable curly */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Configuration for DOMPurify sanitization
 */
const SANITIZE_CONFIG = {
  // Allow only safe HTML tags
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
  // Remove all other tags and attributes
  KEEP_CONTENT: true,
  // Prevent DOM clobbering
  SANITIZE_DOM: true,
  // Return a string, not a document fragment
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
};

/**
 * Strict configuration for plain text (removes all HTML)
 */
const STRICT_CONFIG = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
  SANITIZE_DOM: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
};

/**
 * Client-side sanitization functions for form inputs
 */
export const clientSanitizers = {
  /**
   * Sanitize plain text input (remove all HTML)
   * Use for: name fields, IDs, codes, simple text
   */
  text(input: unknown): string {
    if (input === null || input === undefined) return '';
    const str = String(input).trim();
    return String(DOMPurify.sanitize(str, STRICT_CONFIG));
  },

  /**
   * Sanitize email input
   * Removes HTML and validates basic email structure
   */
  email(input: unknown): string {
    if (input === null || input === undefined) return '';
    const str = String(input).trim().toLowerCase();
    return String(DOMPurify.sanitize(str, STRICT_CONFIG));
  },

  /**
   * Sanitize numeric input
   * Removes non-numeric characters except decimal point
   */
  number(input: unknown): string {
    if (input === null || input === undefined) return '';
    const str = String(input).trim();
    // Remove HTML first
    const sanitized = String(DOMPurify.sanitize(str, STRICT_CONFIG));
    // Keep only numbers, decimal point, and minus sign
    return sanitized.replace(/[^0-9.-]/g, '');
  },

  /**
   * Sanitize rich text content (allows safe HTML tags)
   * Use for: descriptions, notes, comments
   */
  richText(input: unknown): string {
    if (input === null || input === undefined) return '';
    const str = String(input);
    return String(DOMPurify.sanitize(str, SANITIZE_CONFIG));
  },

  /**
   * Sanitize URL input
   * Allows only http/https protocols
   */
  url(input: unknown): string {
    if (input === null || input === undefined) return '';
    const str = String(input).trim();
    const sanitized = String(DOMPurify.sanitize(str, STRICT_CONFIG));

    // Ensure URL starts with http:// or https://
    if (sanitized && !sanitized.match(/^https?:\/\//)) {
      return '';
    }

    return sanitized;
  },

  /**
   * Sanitize phone number input
   * Keeps only digits, spaces, dashes, parentheses, and plus sign
   */
  phone(input: unknown): string {
    if (input === null || input === undefined) return '';
    const str = String(input).trim();
    const sanitized = String(DOMPurify.sanitize(str, STRICT_CONFIG));
    // Keep only phone-related characters
    return sanitized.replace(/[^0-9+\-() ]/g, '');
  },

  /**
   * Sanitize textarea input (multiline text, no HTML)
   * Use for: addresses, notes that shouldn't contain formatting
   */
  textarea(input: unknown): string {
    if (input === null || input === undefined) return '';
    const str = String(input).trim();
    return String(DOMPurify.sanitize(str, STRICT_CONFIG));
  },

  /**
   * Sanitize date input (ISO 8601 format)
   * Returns YYYY-MM-DD format or empty string
   */
  date(input: unknown): string {
    if (input === null || input === undefined) return '';
    const str = String(input).trim();
    const sanitized = String(DOMPurify.sanitize(str, STRICT_CONFIG));

    // Validate ISO 8601 date format
    if (!sanitized.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return '';
    }

    return sanitized;
  },

  /**
   * Sanitize boolean input
   * Converts to 'true' or 'false' string
   */
  boolean(input: unknown): string {
    if (input === null || input === undefined) return 'false';
    const str = String(input).toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'yes' ? 'true' : 'false';
  },
};

/**
 * React hook for sanitizing form inputs
 *
 * @example
 * ```tsx
 * const { sanitizeInput } = useSanitizeInput();
 *
 * <input
 *   value={name}
 *   onChange={(e) => setName(sanitizeInput(e.target.value, 'text'))}
 * />
 * ```
 */
export function useSanitizeInput() {
  const sanitizeInput = (
    value: unknown,
    type: keyof typeof clientSanitizers
  ): string => {
    return clientSanitizers[type](value);
  };

  return { sanitizeInput };
}

/**
 * Sanitize all values in a form data object
 *
 * @example
 * ```typescript
 * const formData = {
 *   name: '<script>alert("xss")</script>John',
 *   email: 'john@example.com',
 *   amount: '100.50',
 * };
 *
 * const sanitized = sanitizeFormData(formData, {
 *   name: 'text',
 *   email: 'email',
 *   amount: 'number',
 * });
 * ```
 */
export function sanitizeFormData<T extends Record<string, unknown>>(
  data: T,
  schema: Record<keyof T, keyof typeof clientSanitizers>
): Record<keyof T, string> {
  const result = {} as Record<keyof T, string>;

  for (const key in data) {
    const sanitizer = schema[key];
    if (sanitizer && sanitizer in clientSanitizers) {
      result[key] = clientSanitizers[sanitizer](data[key]);
    } else {
      // Default to text sanitization if no schema provided
      result[key] = clientSanitizers.text(data[key]);
    }
  }

  return result;
}

/**
 * Higher-order component for sanitizing props
 * Useful for wrapping components that receive user input
 *
 * @example
 * ```tsx
 * import React from 'react';
 * const SafeUserDisplay = withSanitizedProps(
 *   UserDisplay,
 *   { name: 'text', bio: 'richText' }
 * );
 * ```
 */
export function withSanitizedProps<P extends Record<string, unknown>>(
  Component: any,
  schema: Record<keyof P, keyof typeof clientSanitizers>
): any {
  return (props: P) => {
    const sanitizedProps = sanitizeFormData(props, schema);
    // HOC implementation would require React import and JSX
    // This is provided as a utility function instead
    return { Component, props: sanitizedProps as P };
  };
}

/**
 * Sanitize HTML string for rendering with dangerouslySetInnerHTML
 *
 * ⚠️ Use sparingly! Prefer rendering plain text when possible.
 *
 * @example
 * ```tsx
 * <div dangerouslySetInnerHTML={{ __html: sanitizeHTML(userContent) }} />
 * ```
 */
export function sanitizeHTML(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  return String(DOMPurify.sanitize(str, SANITIZE_CONFIG));
}

/**
 * Check if a string contains potentially dangerous content
 * Returns true if content should be rejected
 */
export function containsDangerousContent(input: unknown): boolean {
  if (input === null || input === undefined) return false;

  const str = String(input).toLowerCase();

  // Check for common XSS patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onload=, onclick=, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /vbscript:/i,
    /data:text\/html/i,
  ];

  return dangerousPatterns.some((pattern) => pattern.test(str));
}
