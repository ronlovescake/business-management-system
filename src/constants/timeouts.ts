/**
 * Timeout Constants
 *
 * Centralized timeout settings for API calls, operations, and UI interactions.
 * All values are in milliseconds.
 *
 * @module constants/timeouts
 */

/**
 * Default API request timeout
 * Used for: Standard API calls
 * Reasoning: Most API calls should complete within 30 seconds
 */
export const DEFAULT_API_TIMEOUT = 30000; // 30 seconds

/**
 * Short timeout for quick operations
 * Used for: Health checks, ping requests, simple GET calls
 * Reasoning: Quick operations should complete in 5-10 seconds
 */
export const SHORT_TIMEOUT = 5000; // 5 seconds

/**
 * Medium timeout for moderate operations
 * Used for: Single record creation, updates, simple queries
 * Reasoning: Standard CRUD operations should complete within 10 seconds
 */
export const MEDIUM_TIMEOUT = 10000; // 10 seconds

/**
 * Long timeout for heavy operations
 * Used for: Bulk operations, CSV imports, report generation
 * Reasoning: Heavy operations may take up to 1 minute
 */
export const LONG_TIMEOUT = 60000; // 60 seconds

/**
 * Extra long timeout for very heavy operations
 * Used for: Large CSV imports (10k+ rows), full backups, mass calculations
 * Reasoning: Very heavy operations may take several minutes
 */
export const EXTRA_LONG_TIMEOUT = 180000; // 3 minutes

/**
 * Maximum timeout (5 minutes)
 * Used as: Absolute upper limit for any operation
 * Reasoning: Prevents indefinite hangs, forces operation optimization
 */
export const MAX_TIMEOUT = 300000; // 5 minutes

/**
 * Debounce delay for search input
 * Used for: Search bars, autocomplete fields
 * Reasoning: Wait for user to stop typing before triggering search
 */
export const SEARCH_DEBOUNCE_DELAY = 300; // 300ms

/**
 * Debounce delay for form auto-save
 * Used for: Auto-saving forms, draft preservation
 * Reasoning: Wait for user to pause before auto-saving
 */
export const AUTOSAVE_DEBOUNCE_DELAY = 1000; // 1 second

/**
 * Delay before showing loading spinner
 * Used for: Preventing loading flicker on fast operations
 * Reasoning: Don't show spinner if operation completes in < 500ms
 */
export const LOADING_SPINNER_DELAY = 500; // 500ms

/**
 * Toast notification auto-dismiss duration
 * Used for: Success/info toasts
 * Reasoning: Give user enough time to read the message
 */
export const TOAST_DISMISS_DELAY = 3000; // 3 seconds

/**
 * Error toast notification duration (longer)
 * Used for: Error toasts
 * Reasoning: Errors need more time for user to read and act
 */
export const ERROR_TOAST_DELAY = 5000; // 5 seconds

/**
 * Retry delay for failed requests
 * Used for: Exponential backoff in retry logic
 * Reasoning: Base delay before first retry
 */
export const RETRY_BASE_DELAY = 1000; // 1 second

/**
 * Maximum retry delay
 * Used for: Upper bound in exponential backoff
 * Reasoning: Cap retry delays at 30 seconds
 */
export const MAX_RETRY_DELAY = 30000; // 30 seconds
