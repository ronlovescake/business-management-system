/**
 * Batch Processing Constants
 *
 * Centralized settings for batch operations, bulk imports, and mass processing.
 * These values optimize performance while preventing timeouts and memory issues.
 *
 * @module constants/batch-sizes
 */

// ============================================================================
// Import/Export Batch Sizes
// ============================================================================

/**
 * Default batch size for CSV imports
 * Used for: Standard CSV processing
 * Reasoning: Balance between speed and memory usage
 */
export const DEFAULT_BATCH_SIZE = 1000;

/**
 * Small batch size for complex records
 * Used for: Records with many relations, heavy validation
 * Reasoning: Prevents timeout on complex operations
 */
export const SMALL_BATCH_SIZE = 100;

/**
 * Medium batch size for standard records
 * Used for: Simple records with minimal relations
 * Reasoning: Good balance for most use cases
 */
export const MEDIUM_BATCH_SIZE = 500;

/**
 * Large batch size for simple records
 * Used for: Bulk inserts of simple data
 * Reasoning: Maximize throughput for simple operations
 */
export const LARGE_BATCH_SIZE = 2000;

/**
 * Maximum batch size allowed
 * Used as: Upper limit for any batch operation
 * Reasoning: Prevent memory exhaustion
 */
export const MAX_BATCH_SIZE = 5000;

// ============================================================================
// CSV Import Limits
// ============================================================================

/**
 * Maximum rows in a single CSV import
 * Reasoning: Prevent extremely large imports that could crash the server
 */
export const MAX_CSV_ROWS = 50000;

/**
 * Warning threshold for large CSV imports
 * Reasoning: Warn user before processing very large files
 */
export const LARGE_CSV_WARNING_THRESHOLD = 10000;

/**
 * Rows to preview from CSV before import
 * Reasoning: Show user sample of data for validation
 */
export const CSV_PREVIEW_ROWS = 10;

// ============================================================================
// Database Query Limits
// ============================================================================

/**
 * Maximum number of records to fetch in a single query
 * Reasoning: Prevent overwhelming database and client
 */
export const MAX_QUERY_LIMIT = 10000;

/**
 * Batch size for bulk database operations
 * Used for: Mass updates, bulk deletes
 * Reasoning: Prisma performs well with this batch size
 */
export const DB_BATCH_SIZE = 1000;

/**
 * Chunk size for streaming large results
 * Used for: Pagination, infinite scroll
 * Reasoning: Optimal size for progressive loading
 */
export const STREAM_CHUNK_SIZE = 100;

// ============================================================================
// API Request Batching
// ============================================================================

/**
 * Maximum concurrent API requests
 * Reasoning: Prevent overwhelming the server
 */
export const MAX_CONCURRENT_REQUESTS = 5;

/**
 * Batch size for parallel processing
 * Used for: Processing multiple items simultaneously
 * Reasoning: Balance between concurrency and resource usage
 */
export const PARALLEL_BATCH_SIZE = 10;

/**
 * Delay between batches (milliseconds)
 * Used for: Rate limiting batch operations
 * Reasoning: Give server time to recover between batches
 */
export const BATCH_DELAY = 100; // 100ms

// ============================================================================
// Background Job Limits
// ============================================================================

/**
 * Records to process per background job iteration
 * Used for: Scheduled tasks, cron jobs
 * Reasoning: Complete in reasonable time without blocking
 */
export const JOB_BATCH_SIZE = 500;

/**
 * Maximum execution time for background job (milliseconds)
 * Reasoning: Prevent runaway jobs
 */
export const MAX_JOB_DURATION = 300000; // 5 minutes

// ============================================================================
// Search and Filter Limits
// ============================================================================

/**
 * Maximum search results to return
 * Reasoning: Balance relevance and performance
 */
export const MAX_SEARCH_RESULTS = 100;

/**
 * Autocomplete suggestion limit
 * Reasoning: Show enough options without overwhelming user
 */
export const AUTOCOMPLETE_LIMIT = 10;

/**
 * Related records to fetch
 * Used for: "Also viewed", recommendations
 * Reasoning: Enough for context, not too many
 */
export const RELATED_RECORDS_LIMIT = 5;
