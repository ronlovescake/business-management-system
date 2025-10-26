/**
 * Pagination Constants
 *
 * Centralized pagination settings used across the application.
 * Adjusting these values affects all data tables and list views.
 *
 * @module constants/pagination
 */

/**
 * Default number of items per page for data tables
 * Used in: Transactions, Products, Customers, Employees, etc.
 */
export const DEFAULT_PAGE_SIZE = 100;

/**
 * Small page size for compact views
 * Used in: Dropdowns, quick selects, dashboard widgets
 */
export const SMALL_PAGE_SIZE = 25;

/**
 * Medium page size for standard lists
 * Used in: Modal lists, sub-tables
 */
export const MEDIUM_PAGE_SIZE = 50;

/**
 * Large page size for bulk operations
 * Used in: Export views, admin panels
 */
export const LARGE_PAGE_SIZE = 200;

/**
 * Maximum page size allowed
 * Prevents memory issues from loading too many records
 */
export const MAX_PAGE_SIZE = 1000;

/**
 * Page size options for user selection
 * Displayed in page size dropdowns
 */
export const PAGE_SIZE_OPTIONS = [25, 50, 100, 200] as const;

/**
 * Initial page number (1-indexed)
 */
export const INITIAL_PAGE = 1;

/**
 * Initial page number (0-indexed) for zero-based pagination
 */
export const INITIAL_PAGE_ZERO_INDEXED = 0;
