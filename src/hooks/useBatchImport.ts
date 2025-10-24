/**
 * React Hook for Batch Import with Progress Tracking
 *
 * Provides easy-to-use batch import functionality with:
 * - Progress tracking
 * - Error handling
 * - Retry logic
 * - Export failed records
 */

import { useState, useCallback } from 'react';
import {
  importInBatches,
  retryFailedBatches,
  exportFailedRecordsToCSV,
  type BatchImportResult,
  type BatchImportOptions,
} from '@/lib/utils/batchImport';

export interface UseBatchImportResult<T> {
  /** Start the batch import process */
  startImport: (records: T[], endpoint: string) => Promise<void>;
  /** Retry failed batches from last import */
  retryFailed: () => Promise<void>;
  /** Export failed records to CSV */
  exportFailed: () => void;
  /** Current progress percentage (0-100) */
  progress: number;
  /** Current status message */
  status: string;
  /** Whether import is currently running */
  isImporting: boolean;
  /** Results from last import */
  result: BatchImportResult<T> | null;
  /** Error message if any */
  error: string | null;
  /** Reset the state */
  reset: () => void;
}

export interface UseBatchImportOptions {
  /** Maximum retry attempts per batch (default: 3) */
  maxRetries?: number;
  /** Batch size (default: 1000) */
  batchSize?: number;
  /** Callback when import completes successfully */
  onSuccess?: () => void;
  /** Callback when import fails */
  onError?: (error: string) => void;
}

/**
 * Hook for batch importing records with progress tracking
 *
 * @param options - Configuration options
 * @returns Import state and control functions
 *
 * @example
 * ```typescript
 * const {
 *   startImport,
 *   progress,
 *   status,
 *   isImporting,
 *   result,
 *   retryFailed,
 *   exportFailed
 * } = useBatchImport<Transaction>({
 *   maxRetries: 3,
 *   onSuccess: () => toast.success('Import complete!'),
 *   onError: (error) => toast.error(error)
 * });
 *
 * // Start import
 * await startImport(transactions, '/api/transactions');
 *
 * // If some batches failed, retry them
 * if (result && result.failed.length > 0) {
 *   await retryFailed();
 * }
 *
 * // Export failed records to CSV
 * if (result && result.failed.length > 0) {
 *   exportFailed();
 * }
 * ```
 */
export function useBatchImport<T extends Record<string, unknown>>(
  options: UseBatchImportOptions = {}
): UseBatchImportResult<T> {
  const { maxRetries = 3, batchSize = 1000, onSuccess, onError } = options;

  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<BatchImportResult<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastEndpoint, setLastEndpoint] = useState<string>('');

  const startImport = useCallback(
    async (records: T[], endpoint: string) => {
      setIsImporting(true);
      setError(null);
      setProgress(0);
      setStatus('Preparing import...');
      setLastEndpoint(endpoint);

      try {
        const importOptions: BatchImportOptions = {
          endpoint,
          maxRetries,
          batchSize,
          onProgress: (percent, statusMsg) => {
            setProgress(Math.round(percent));
            setStatus(statusMsg);
          },
        };

        const importResult = await importInBatches<T>(records, importOptions);
        setResult(importResult);

        if (importResult.failed.length === 0) {
          setStatus(
            `✅ All ${importResult.summary.recordsImported} records imported successfully!`
          );
          onSuccess?.();
        } else {
          const successMsg = `✅ ${importResult.summary.recordsImported} records imported`;
          const failMsg = `❌ ${importResult.summary.recordsFailed} records failed`;
          setStatus(`${successMsg}, ${failMsg}`);
          onError?.(`${importResult.failed.length} batches failed`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        setStatus(`❌ Import failed: ${errorMsg}`);
        onError?.(errorMsg);
      } finally {
        setIsImporting(false);
      }
    },
    [maxRetries, batchSize, onSuccess, onError]
  );

  const retryFailed = useCallback(async () => {
    if (!result || result.failed.length === 0) {
      setError('No failed batches to retry');
      return;
    }

    if (!lastEndpoint) {
      setError('No endpoint found for retry');
      return;
    }

    setIsImporting(true);
    setError(null);
    setProgress(0);
    setStatus('Retrying failed batches...');

    try {
      const importOptions: BatchImportOptions = {
        endpoint: lastEndpoint,
        maxRetries,
        batchSize,
        onProgress: (percent, statusMsg) => {
          setProgress(Math.round(percent));
          setStatus(statusMsg);
        },
      };

      const retryResult = await retryFailedBatches<T>(
        result.failed,
        importOptions
      );

      // Merge results
      const mergedResult: BatchImportResult<T> = {
        successful: [...result.successful, ...retryResult.successful],
        failed: retryResult.failed,
        totalRecords: result.totalRecords,
        summary: {
          totalBatches: result.summary.totalBatches,
          successfulBatches:
            result.summary.successfulBatches +
            retryResult.summary.successfulBatches,
          failedBatches: retryResult.summary.failedBatches,
          recordsImported:
            result.summary.recordsImported +
            retryResult.summary.recordsImported,
          recordsFailed: retryResult.summary.recordsFailed,
        },
      };

      setResult(mergedResult);

      if (retryResult.failed.length === 0) {
        setStatus(
          `✅ All failed batches recovered! Total: ${mergedResult.summary.recordsImported} records`
        );
        onSuccess?.();
      } else {
        setStatus(
          `⚠️ Retry complete: ${retryResult.summary.recordsImported} recovered, ${retryResult.summary.recordsFailed} still failed`
        );
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      setStatus(`❌ Retry failed: ${errorMsg}`);
      onError?.(errorMsg);
    } finally {
      setIsImporting(false);
    }
  }, [result, lastEndpoint, maxRetries, batchSize, onSuccess, onError]);

  const exportFailed = useCallback(() => {
    if (!result || result.failed.length === 0) {
      setError('No failed records to export');
      return;
    }

    try {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5);
      exportFailedRecordsToCSV(
        result.failed,
        `failed-records-${timestamp}.csv`
      );
      setStatus(
        `📥 Exported ${result.summary.recordsFailed} failed records to CSV`
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
    }
  }, [result]);

  const reset = useCallback(() => {
    setProgress(0);
    setStatus('');
    setIsImporting(false);
    setResult(null);
    setError(null);
    setLastEndpoint('');
  }, []);

  return {
    startImport,
    retryFailed,
    exportFailed,
    progress,
    status,
    isImporting,
    result,
    error,
    reset,
  };
}
