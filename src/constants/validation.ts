/**
 * Validation Constants
 *
 * Centralized validation rules and thresholds.
 * Used for form validation, data integrity checks, and API validation.
 *
 * @module constants/validation
 */

// ============================================================================
// String Length Limits
// ============================================================================

/**
 * Maximum length for short text fields
 * Used for: Names, titles, short codes
 */
export const MAX_SHORT_TEXT_LENGTH = 100;

/**
 * Maximum length for standard text fields
 * Used for: Email, phone, addresses, descriptions
 */
export const MAX_TEXT_LENGTH = 255;

/**
 * Maximum length for medium text fields
 * Used for: Comments, notes, messages
 */
export const MAX_MEDIUM_TEXT_LENGTH = 500;

/**
 * Maximum length for long text fields
 * Used for: Descriptions, articles, detailed notes
 */
export const MAX_LONG_TEXT_LENGTH = 2000;

/**
 * Maximum length for very long text fields
 * Used for: Full articles, documentation, rich text content
 */
export const MAX_VERY_LONG_TEXT_LENGTH = 10000;

// ============================================================================
// Numeric Limits
// ============================================================================

/**
 * Minimum age for employees
 * Reasoning: Legal working age
 */
export const MIN_EMPLOYEE_AGE = 18;

/**
 * Maximum age for employees
 * Reasoning: Standard retirement age
 */
export const MAX_EMPLOYEE_AGE = 70;

/**
 * Minimum salary/wage (in currency)
 * Reasoning: Minimum wage threshold
 */
export const MIN_SALARY = 0.01;

/**
 * Maximum salary/wage (in currency)
 * Reasoning: Reasonable upper bound for validation
 */
export const MAX_SALARY = 1000000;

/**
 * Minimum product price
 * Reasoning: Products must have positive price
 */
export const MIN_PRODUCT_PRICE = 0.01;

/**
 * Maximum product price
 * Reasoning: Reasonable upper bound
 */
export const MAX_PRODUCT_PRICE = 100000;

/**
 * Minimum quantity for transactions
 * Reasoning: Must order at least 1 item
 */
export const MIN_QUANTITY = 1;

/**
 * Maximum quantity for single transaction
 * Reasoning: Prevent data entry errors
 */
export const MAX_QUANTITY = 100000;

/**
 * Maximum discount percentage
 * Reasoning: Cannot discount more than 100%
 */
export const MAX_DISCOUNT_PERCENT = 100;

/**
 * Decimal precision for currency
 * Reasoning: Most currencies use 2 decimal places
 */
export const CURRENCY_DECIMAL_PLACES = 2;

/**
 * Decimal precision for percentages
 * Reasoning: Allow fine-grained percentages
 */
export const PERCENTAGE_DECIMAL_PLACES = 2;

// ============================================================================
// File Upload Limits
// ============================================================================

/**
 * Maximum file size for images (in bytes)
 * Current: 5MB
 * Reasoning: Balance between quality and performance
 */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Maximum file size for CSV imports (in bytes)
 * Current: 10MB
 * Reasoning: Large datasets but manageable
 */
export const MAX_CSV_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Maximum file size for documents (in bytes)
 * Current: 20MB
 * Reasoning: PDFs and documents can be large
 */
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * Maximum file size for any upload (in bytes)
 * Current: 50MB
 * Reasoning: Absolute upper limit
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// ============================================================================
// Pattern Validation
// ============================================================================

/**
 * Email validation pattern
 */
export const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Phone number pattern (flexible, allows various formats)
 */
export const PHONE_PATTERN = /^[\d\s\-()+ ]{7,20}$/;

/**
 * URL pattern
 */
export const URL_PATTERN = /^https?:\/\/.+/;

/**
 * Product code pattern
 * Format: Alphanumeric, hyphens, underscores
 */
export const PRODUCT_CODE_PATTERN = /^[A-Z0-9\-_]{1,50}$/;

/**
 * Employee ID pattern
 * Format: EMP-XXXX where X is a digit
 */
export const EMPLOYEE_ID_PATTERN = /^EMP-\d{4,}$/;

/**
 * Date pattern (ISO 8601)
 * Format: YYYY-MM-DD
 */
export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Positive number pattern (allows decimals)
 */
export const POSITIVE_NUMBER_PATTERN = /^\d+(\.\d+)?$/;

/**
 * Integer pattern
 */
export const INTEGER_PATTERN = /^\d+$/;

// ============================================================================
// Password Requirements (future use)
// ============================================================================

/**
 * Minimum password length
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Maximum password length
 */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Require uppercase in password
 */
export const PASSWORD_REQUIRE_UPPERCASE = true;

/**
 * Require lowercase in password
 */
export const PASSWORD_REQUIRE_LOWERCASE = true;

/**
 * Require number in password
 */
export const PASSWORD_REQUIRE_NUMBER = true;

/**
 * Require special character in password
 */
export const PASSWORD_REQUIRE_SPECIAL = true;
