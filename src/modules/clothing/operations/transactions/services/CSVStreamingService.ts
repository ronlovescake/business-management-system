/**
 * CSV Streaming Service
 *
 * Handles large CSV imports (100k+ rows) with streaming and chunking
 * to prevent memory exhaustion and browser freezing.
 *
 * Features:
 * - Stream processing (never load entire file into memory)
 * - Chunked API calls (1000 rows per batch)
 * - Progress tracking
 * - Error recovery
 * - Validation during streaming
 */

import { api } from '@/lib/api/client';
import { logger } from '@/lib/logger';
import { TransactionService } from './TransactionService';
import type { TransactionData } from '../types/transaction.types';

interface StreamImportOptions {
  file: File;
  chunkSize?: number; // Number of rows per API call
  onProgress?: (processed: number, total: number) => void;
  onChunkComplete?: (chunk: number, totalChunks: number) => void;
  onError?: (error: Error, rowIndex: number) => void;
}

interface StreamImportResult {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ row: number; error: string }>;
}

export class CSVStreamingService {
  private static readonly DEFAULT_CHUNK_SIZE = 1000;
  private static readonly READ_BUFFER_SIZE = 64 * 1024; // 64KB

  /**
   * Import large CSV file with streaming
   *
   * Reads CSV in chunks, parses incrementally, and sends batches to API
   */
  static async streamImport(
    options: StreamImportOptions
  ): Promise<StreamImportResult> {
    const {
      file,
      chunkSize = this.DEFAULT_CHUNK_SIZE,
      onProgress,
      onChunkComplete,
      onError,
    } = options;

    logger.debug(`Starting CSV stream import for file: ${file.name}`);

    const result: StreamImportResult = {
      total: 0,
      successful: 0,
      failed: 0,
      errors: [],
    };

    try {
      // Use FileReader to read in chunks
      const reader = file.stream().getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      let headers: string[] = [];
      let rowIndex = 0;
      let chunkNumber = 0;
      let currentChunk: TransactionData[] = [];

      // Process each chunk of bytes
      while (true) {
        const { done, value } = await reader.read();

        if (value) {
          // Decode bytes and add to buffer
          buffer += decoder.decode(value, { stream: !done });

          // Extract complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim() === '') {
              continue;
            }

            // First line is headers
            if (rowIndex === 0) {
              headers = this.parseCSVLine(line);
              rowIndex++;
              continue;
            }

            // Parse row
            try {
              const values = this.parseCSVLine(line);
              const transaction =
                this.csvRowToTransaction(headers, values);

              if (transaction) {
                currentChunk.push(transaction);
                result.total++;
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : 'Parse error';
              result.errors.push({
                row: rowIndex,
                error: errorMessage,
              });
              result.failed++;

              if (onError) {
                onError(
                  error instanceof Error ? error : new Error(errorMessage),
                  rowIndex
                );
              }
            }

            rowIndex++;

            // Report progress
            if (onProgress) {
              onProgress(rowIndex, result.total);
            }

            // Send chunk to API when full
            if (currentChunk.length >= chunkSize) {
              try {
                await this.saveChunk(currentChunk);
                result.successful += currentChunk.length;
                chunkNumber++;

                if (onChunkComplete) {
                  onChunkComplete(
                    chunkNumber,
                    Math.ceil(result.total / chunkSize)
                  );
                }

                logger.debug(
                  `Chunk ${chunkNumber} saved (${currentChunk.length} rows)`
                );
                currentChunk = [];
              } catch (error) {
                logger.error('Error saving chunk:', error);
                result.failed += currentChunk.length;
                currentChunk = [];
              }
            }
          }
        }

        if (done) {
          // Process remaining buffer
          if (buffer.trim()) {
            try {
              const values = this.parseCSVLine(buffer);
              const transaction =
                this.csvRowToTransaction(headers, values);

              if (transaction) {
                currentChunk.push(transaction);
                result.total++;
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : 'Parse error';
              result.errors.push({
                row: rowIndex,
                error: errorMessage,
              });
              result.failed++;
            }
          }

          // Save final chunk
          if (currentChunk.length > 0) {
            try {
              await this.saveChunk(currentChunk);
              result.successful += currentChunk.length;
              chunkNumber++;

              if (onChunkComplete) {
                onChunkComplete(chunkNumber, chunkNumber);
              }

              logger.debug(
                `Final chunk ${chunkNumber} saved (${currentChunk.length} rows)`
              );
            } catch (error) {
              logger.error('Error saving final chunk:', error);
              result.failed += currentChunk.length;
            }
          }

          break;
        }
      }

      logger.debug('CSV stream import completed:', result);
      return result;
    } catch (error) {
      logger.error('Fatal error during CSV stream import:', error);
      throw error;
    }
  }

  /**
   * Parse CSV line handling quotes and commas
   */
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // Handle escaped quotes
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Convert CSV row to transaction object
   */
  private static csvRowToTransaction(
    headers: string[],
    values: string[]
  ): TransactionData | null {
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    // Use TransactionService to parse and calculate
    try {
      // Build a TransactionData object from CSV row
      const transaction: Partial<TransactionData> = {
        'Order Date': row['Order Date'] || '',
        Customers: row['Customers'] || '',
        'Product Code': row['Product Code'] || '',
        Quantity: parseFloat(
          TransactionService.sanitizeNumericValue(row['Quantity'])
        ),
        'Unit Price': parseFloat(
          TransactionService.sanitizeNumericValue(row['Unit Price'])
        ),
        Discount: parseFloat(
          TransactionService.sanitizeNumericValue(row['Discount'])
        ),
        Adjustment: parseFloat(
          TransactionService.sanitizeNumericValue(row['Adjustment'])
        ),
        'Order Status': row['Order Status'] || '',
        Notes: row['Notes'] || '',
        'Invoice Date': row['Invoice Date'] || '',
        'Packed Date': row['Packed Date'] || '',
        'Shipment Code': row['Shipment Code'] || '',
      };

      // Calculate line total
      const quantity = transaction.Quantity || 0;
      const unitPrice = transaction['Unit Price'] || 0;
      const adjustment = transaction.Adjustment || 0;

      transaction['Line Total'] = TransactionService.calculateLineTotal(
        quantity,
        unitPrice,
        adjustment
      );

      return transaction as TransactionData;
    } catch (error) {
      logger.warn('Error parsing CSV row:', error);
      return null;
    }
  }

  /**
   * Save chunk of transactions to API
   */
  private static async saveChunk(
    transactions: TransactionData[]
  ): Promise<void> {
    try {
      await api.post<{ count: number }>('/api/transactions', transactions);
    } catch (error) {
      logger.error('Error saving transaction chunk:', error);
      throw error;
    }
  }

  /**
   * Estimate number of rows in CSV file
   *
   * Samples the file to estimate without reading the entire content
   */
  static async estimateRowCount(file: File): Promise<number> {
    const sampleSize = Math.min(100 * 1024, file.size); // Sample first 100KB
    const blob = file.slice(0, sampleSize);
    const text = await blob.text();

    const lines = text.split('\n').filter((l) => l.trim() !== '');
    const avgLineLength = text.length / lines.length;
    const estimatedRows = Math.floor(file.size / avgLineLength);

    logger.debug(
      `Estimated ${estimatedRows} rows in ${file.size} byte file (${avgLineLength.toFixed(1)} bytes/row average)`
    );

    return estimatedRows;
  }
}
