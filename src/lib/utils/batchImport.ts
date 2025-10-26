/**
 * Batch Import Utility with Error Handling and Retry Logic
 *
 * Features:
 * - Splits large datasets into batches of 1000 records
 * - Continues importing even if some batches fail
 * - Automatic retry with exponential backoff (up to 3 attempts)
 * - Progress tracking with status updates
 * - Detailed error reporting for failed batches
 * - Returns summary with successful and failed batches
 */

import { logger } from '@/lib/logger';

export interface BatchImportOptions {
  /** Callback for progress updates (0-100) */
  onProgress?: (percent: number, status: string) => void;
  /** Maximum number of retry attempts for failed batches (default: 3) */
  maxRetries?: number;
  /** Batch size (default: 1000) */
  batchSize?: number;
  /** API endpoint to send batches to */
  endpoint: string;
  /** HTTP method (default: 'POST') */
  method?: 'POST' | 'PUT';
}

export interface BatchResult {
  batchNumber: number;
  count: number;
  retriesNeeded: number;
}

export interface BatchError<T = unknown> {
  batchNumber: number;
  error: unknown;
  retriesAttempted: number;
  records?: T[]; // Failed records for retry/export
}

export interface BatchImportResult<T = unknown> {
  successful: BatchResult[];
  failed: BatchError<T>[];
  totalRecords: number;
  summary: {
    totalBatches: number;
    successfulBatches: number;
    failedBatches: number;
    recordsImported: number;
    recordsFailed: number;
  };
}

/**
 * Helper function to split array into chunks
 */
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Helper function for exponential backoff delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Import large datasets in batches with error handling and retry logic
 *
 * @param records - Array of records to import
 * @param options - Configuration options
 * @returns Promise with detailed results including successful and failed batches
 *
 * @example
 * ```typescript
 * const result = await importInBatches(transactions, {
 *   endpoint: '/api/transactions',
 *   onProgress: (percent, status) => {
 *     console.log(`${percent}%: ${status}`);
 *   },
 *   maxRetries: 3
 * });
 *
 * if (result.failed.length > 0) {
 *   console.error(`Failed batches:`, result.failed);
 * }
 * ```
 */
export async function importInBatches<T>(
  records: T[],
  options: BatchImportOptions
): Promise<BatchImportResult<T>> {
  const {
    onProgress,
    maxRetries = 3,
    batchSize = 1000,
    endpoint,
    method = 'POST',
  } = options;

  const batches = chunk(records, batchSize);
  const results: BatchImportResult<T> = {
    successful: [],
    failed: [],
    totalRecords: records.length,
    summary: {
      totalBatches: batches.length,
      successfulBatches: 0,
      failedBatches: 0,
      recordsImported: 0,
      recordsFailed: 0,
    },
  };

  onProgress?.(
    0,
    `Starting import of ${records.length} records in ${batches.length} batches`
  );

  for (let i = 0; i < batches.length; i++) {
    let success = false;
    let lastError: unknown = null;
    let retriesNeeded = 0;
    const batchNumber = i + 1;

    // Retry logic with exponential backoff
    for (let retry = 0; retry < maxRetries && !success; retry++) {
      try {
        if (retry > 0) {
          const waitTime = 1000 * retry; // 1s, 2s, 3s
          onProgress?.(
            (i / batches.length) * 100,
            `⏳ Retrying batch ${batchNumber}/${batches.length} (attempt ${retry + 1}/${maxRetries})...`
          );
          await sleep(waitTime);
        } else {
          onProgress?.(
            (i / batches.length) * 100,
            `📤 Importing batch ${batchNumber}/${batches.length}...`
          );
        }

        const response = await fetch(`${endpoint}?source=csv`, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batches[i]),
        });

        if (response.ok) {
          const data = await response.json();
          results.successful.push({
            batchNumber,
            count: data.count || batches[i].length,
            retriesNeeded: retry,
          });
          success = true;

          if (retry > 0) {
            onProgress?.(
              ((i + 1) / batches.length) * 100,
              `✅ Batch ${batchNumber} succeeded after ${retry + 1} attempts`
            );
          } else {
            onProgress?.(
              ((i + 1) / batches.length) * 100,
              `✅ Batch ${batchNumber} imported successfully`
            );
          }
        } else {
          const errorData = await response.json();
          lastError = {
            status: response.status,
            ...errorData,
          };

          // Log detailed error for debugging
          logger.error(`Batch ${batchNumber} failed:`, {
            status: response.status,
            error: errorData,
            batchSize: batches[i].length,
            firstRecord: batches[i][0],
          });

          // Don't retry validation errors (400) or conflict errors (409)
          // These need manual intervention
          if (response.status === 400 || response.status === 409) {
            onProgress?.(
              ((i + 1) / batches.length) * 100,
              `❌ Batch ${batchNumber} failed: ${errorData.error || 'Validation error'} (skipping retries)`
            );
            break; // Exit retry loop
          }
        }
      } catch (error) {
        lastError = {
          message: error instanceof Error ? error.message : String(error),
          type: 'network_error',
        };
      }

      retriesNeeded = retry + 1;
    }

    // If all retries failed, add to failed list
    if (!success) {
      results.failed.push({
        batchNumber,
        error: lastError,
        retriesAttempted: retriesNeeded,
        records: batches[i], // Store failed records for potential retry
      });

      onProgress?.(
        ((i + 1) / batches.length) * 100,
        `❌ Batch ${batchNumber} failed after ${retriesNeeded} attempts`
      );
    }
  }

  // Calculate summary
  results.summary.successfulBatches = results.successful.length;
  results.summary.failedBatches = results.failed.length;
  results.summary.recordsImported = results.successful.reduce(
    (sum, b) => sum + b.count,
    0
  );
  results.summary.recordsFailed = results.failed.length * batchSize;

  onProgress?.(100, 'Import complete');

  return results;
}

/**
 * Export failed batches to CSV for manual review/fixing
 *
 * @param failedBatches - Array of failed batch errors
 * @param filename - Output filename (default: 'failed-records.csv')
 */
export function exportFailedRecordsToCSV<T extends Record<string, unknown>>(
  failedBatches: BatchError<T>[],
  filename: string = 'failed-records.csv'
): void {
  if (failedBatches.length === 0) {
    return;
  }

  // Flatten all failed records
  const allFailedRecords = failedBatches.flatMap(
    (batch) => batch.records || []
  );

  if (allFailedRecords.length === 0) {
    return;
  }

  // Convert to CSV
  const headers = Object.keys(allFailedRecords[0]);
  const csvContent = [
    headers.join(','), // Header row
    ...allFailedRecords.map((record) =>
      headers
        .map((header) => {
          const value = record[header];
          // Escape quotes and wrap in quotes if contains comma
          const escaped = String(value).replace(/"/g, '""');
          return escaped.includes(',') ? `"${escaped}"` : escaped;
        })
        .join(',')
    ),
  ].join('\n');

  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Retry only the failed batches from a previous import
 *
 * @param failedBatches - Array of failed batch errors from previous import
 * @param options - Configuration options (same as importInBatches)
 * @returns Promise with results of retry attempt
 *
 * @example
 * ```typescript
 * // After initial import fails
 * const initialResult = await importInBatches(records, options);
 *
 * // Retry failed batches
 * const retryResult = await retryFailedBatches(initialResult.failed, options);
 * ```
 */
export async function retryFailedBatches<T>(
  failedBatches: BatchError<T>[],
  options: BatchImportOptions
): Promise<BatchImportResult<T>> {
  const allFailedRecords = failedBatches.flatMap(
    (batch) => batch.records || []
  );

  if (allFailedRecords.length === 0) {
    throw new Error('No records to retry');
  }

  return importInBatches(allFailedRecords, options);
}
