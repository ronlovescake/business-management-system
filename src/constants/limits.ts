/**
 * Application Limits and Thresholds
 *
 * Centralized business rules, operational limits, and system thresholds.
 * These values define the boundaries and constraints of the application.
 *
 * @module constants/limits
 */

// ============================================================================
// Rate Limiting (Future Use - P0 Deferred)
// ============================================================================

/**
 * Maximum GET requests per minute per IP
 */
export const MAX_GET_REQUESTS_PER_MINUTE = 200;

/**
 * Maximum POST/PUT requests per minute per IP
 */
export const MAX_WRITE_REQUESTS_PER_MINUTE = 100;

/**
 * Maximum DELETE requests per minute per IP
 */
export const MAX_DELETE_REQUESTS_PER_MINUTE = 50;

/**
 * Maximum bulk operation requests per minute per IP
 */
export const MAX_BULK_REQUESTS_PER_MINUTE = 10;

/**
 * Maximum CSV import requests per minute per IP
 */
export const MAX_IMPORT_REQUESTS_PER_MINUTE = 5;

// ============================================================================
// Concurrent Operations
// ============================================================================

/**
 * Maximum concurrent file uploads
 */
export const MAX_CONCURRENT_UPLOADS = 3;

/**
 * Maximum concurrent downloads
 */
export const MAX_CONCURRENT_DOWNLOADS = 5;

/**
 * Maximum concurrent database connections
 * Reasoning: Based on Prisma connection pool limits
 */
export const MAX_DB_CONNECTIONS = 10;

// ============================================================================
// Data Retention
// ============================================================================

/**
 * Days to keep deleted records (soft delete)
 * Reasoning: 30-day grace period for recovery
 */
export const SOFT_DELETE_RETENTION_DAYS = 30;

/**
 * Days to keep audit logs
 * Reasoning: 90-day compliance requirement
 */
export const AUDIT_LOG_RETENTION_DAYS = 90;

/**
 * Days to retain change_log entries for incident investigation
 * Reasoning: Must match AUDIT_LOG_RETENTION_DAYS so the investigation window
 * and recoverability window expire together.
 */
export const CHANGE_LOG_RETENTION_DAYS = 90;

/**
 * Days to retain PITR base backups before cleanup
 * Reasoning: Default operational window for PITR recovery artifacts.
 */
export const PITR_BASE_BACKUP_RETENTION_DAYS = 7;

/**
 * Days to retain WAL archive segments before cleanup
 * Reasoning: Must match PITR_BASE_BACKUP_RETENTION_DAYS so WAL replay is
 * available for as long as base backups are retained.
 */
export const WAL_ARCHIVE_RETENTION_DAYS = 7;

/**
 * Days to keep session tokens
 * Reasoning: 7-day session validity
 */
export const SESSION_RETENTION_DAYS = 7;

/**
 * Days to keep temporary files
 * Reasoning: Clean up after 24 hours
 */
export const TEMP_FILE_RETENTION_DAYS = 1;

// ============================================================================
// Cache Settings
// ============================================================================

/**
 * Default cache TTL (milliseconds)
 * Used for: General caching
 */
export const DEFAULT_CACHE_TTL = 300000; // 5 minutes

/**
 * Short cache TTL (milliseconds)
 * Used for: Frequently changing data
 */
export const SHORT_CACHE_TTL = 60000; // 1 minute

/**
 * Long cache TTL (milliseconds)
 * Used for: Rarely changing data (settings, reference data)
 */
export const LONG_CACHE_TTL = 3600000; // 1 hour

/**
 * Static asset cache TTL (milliseconds)
 * Used for: Images, CSS, JS
 */
export const STATIC_CACHE_TTL = 86400000; // 24 hours

// ============================================================================
// Business Rules
// ============================================================================

/**
 * Maximum orders per customer per day
 * Reasoning: Prevent data entry errors, possible fraud
 */
export const MAX_ORDERS_PER_CUSTOMER_PER_DAY = 100;

/**
 * Maximum products per order
 * Reasoning: UI and processing limitations
 */
export const MAX_PRODUCTS_PER_ORDER = 500;

/**
 * Maximum discount per transaction (percentage)
 * Reasoning: Business rule from management
 */
export const MAX_TRANSACTION_DISCOUNT = 50; // 50%

/**
 * Minimum order value
 * Reasoning: Cover processing costs
 */
export const MIN_ORDER_VALUE = 1.0;

/**
 * Maximum order value
 * Reasoning: Fraud prevention
 */
export const MAX_ORDER_VALUE = 1000000;

// ============================================================================
// Employee/HR Limits
// ============================================================================

/**
 * Maximum leave days per year
 * Reasoning: Standard annual leave allowance
 */
export const MAX_LEAVE_DAYS_PER_YEAR = 30;

/**
 * Maximum overtime hours per month
 * Reasoning: Labor law compliance
 */
export const MAX_OVERTIME_HOURS_PER_MONTH = 80;

/**
 * Maximum cash advance amount
 * Reasoning: Business policy
 */
export const MAX_CASH_ADVANCE_AMOUNT = 50000;

/**
 * Maximum loan amount
 * Reasoning: Business policy
 */
export const MAX_LOAN_AMOUNT = 100000;

/**
 * Maximum employee loans
 * Reasoning: Risk management
 */
export const MAX_ACTIVE_LOANS_PER_EMPLOYEE = 3;

// ============================================================================
// System Resources
// ============================================================================

/**
 * Maximum memory per request (bytes)
 * Reasoning: Prevent memory exhaustion
 */
export const MAX_MEMORY_PER_REQUEST = 100 * 1024 * 1024; // 100MB

/**
 * Maximum CPU time per request (milliseconds)
 * Reasoning: Prevent CPU starvation
 */
export const MAX_CPU_TIME_PER_REQUEST = 30000; // 30 seconds

/**
 * Maximum database query time (milliseconds)
 * Reasoning: Slow query detection
 */
export const MAX_QUERY_TIME = 5000; // 5 seconds

/**
 * Maximum response size (bytes)
 * Reasoning: Prevent network overload
 */
export const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

// ============================================================================
// UI/UX Limits
// ============================================================================

/**
 * Maximum characters to display before truncation
 */
export const MAX_DISPLAY_TEXT_LENGTH = 100;

/**
 * Maximum items in dropdown before requiring search
 */
export const MAX_DROPDOWN_ITEMS = 50;

/**
 * Maximum breadcrumb items to show
 */
export const MAX_BREADCRUMB_ITEMS = 5;

/**
 * Maximum tabs before showing "More" menu
 */
export const MAX_VISIBLE_TABS = 5;

/**
 * Maximum notifications to show at once
 */
export const MAX_VISIBLE_NOTIFICATIONS = 5;

/**
 * Maximum items in recent history
 */
export const MAX_RECENT_ITEMS = 10;
