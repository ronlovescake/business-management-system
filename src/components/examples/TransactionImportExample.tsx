/**
 * Example: Transaction CSV Import with Batch Processing
 *
 * This component demonstrates how to use the useBatchImport hook
 * to import large CSV files with progress tracking, error handling,
 * and retry logic.
 */

'use client';

import { useState } from 'react';
import { useBatchImport } from '@/hooks/useBatchImport';

interface TransactionImport extends Record<string, unknown> {
  'Order Date': string;
  Customers: string;
  'Product Code': string;
  Quantity: number | string;
  'Unit Price': number | string;
  Discount: number | string;
  Adjustment: number | string;
  'Line Total': number | string;
  'Order Status': string;
  Notes?: string;
  'Invoice Date'?: string;
  'Packed Date'?: string;
  'Shipment Code'?: string;
}

export function TransactionImportExample() {
  const [records, setRecords] = useState<TransactionImport[]>([]);

  const {
    startImport,
    retryFailed,
    exportFailed,
    progress,
    status,
    isImporting,
    result,
    error,
    reset,
  } = useBatchImport<TransactionImport>({
    maxRetries: 3,
    batchSize: 1000,
    onSuccess: () => {
      alert('Import completed successfully!');
    },
    onError: (errorMsg) => {
      alert(`Import error: ${errorMsg}`);
    },
  });

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    // Parse CSV file (you can use a library like papaparse)
    // For demo, assuming you have parsed CSV data
    const parsedRecords: TransactionImport[] = [];
    // ... parse CSV logic here ...

    setRecords(parsedRecords);
  };

  const handleImport = async () => {
    if (records.length === 0) {
      alert('Please upload a CSV file first');
      return;
    }

    await startImport(records, '/api/transactions');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Transaction CSV Import</h1>

      {/* File Upload */}
      <div className="mb-6">
        <label htmlFor="csv-upload" className="block mb-2 font-medium">
          Upload CSV File
        </label>
        <input
          id="csv-upload"
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={isImporting}
          className="block w-full text-sm border rounded-lg cursor-pointer p-2"
        />
        {records.length > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            Loaded {records.length.toLocaleString()} records
          </p>
        )}
      </div>

      {/* Import Button */}
      <div className="mb-6">
        <button
          onClick={handleImport}
          disabled={isImporting || records.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isImporting ? 'Importing...' : 'Start Import'}
        </button>

        {result && (
          <button
            onClick={reset}
            disabled={isImporting}
            className="ml-4 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Reset
          </button>
        )}
      </div>

      {/* Progress Bar */}
      {isImporting && (
        <div className="mb-6">
          <div className="mb-2 flex justify-between text-sm">
            <span>{status}</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 font-medium">Error:</p>
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Results Summary */}
      {result && !isImporting && (
        <div className="mb-6 p-4 bg-gray-50 border rounded-lg">
          <h2 className="text-lg font-bold mb-3">Import Summary</h2>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-3 bg-white rounded border">
              <p className="text-sm text-gray-600">Total Records</p>
              <p className="text-2xl font-bold">
                {result.totalRecords.toLocaleString()}
              </p>
            </div>

            <div className="p-3 bg-white rounded border">
              <p className="text-sm text-gray-600">Total Batches</p>
              <p className="text-2xl font-bold">
                {result.summary.totalBatches}
              </p>
            </div>

            <div className="p-3 bg-green-50 rounded border border-green-200">
              <p className="text-sm text-green-700">✅ Successful</p>
              <p className="text-2xl font-bold text-green-800">
                {result.summary.recordsImported.toLocaleString()}
              </p>
              <p className="text-xs text-green-600">
                {result.summary.successfulBatches} batches
              </p>
            </div>

            <div className="p-3 bg-red-50 rounded border border-red-200">
              <p className="text-sm text-red-700">❌ Failed</p>
              <p className="text-2xl font-bold text-red-800">
                {result.summary.recordsFailed.toLocaleString()}
              </p>
              <p className="text-xs text-red-600">
                {result.summary.failedBatches} batches
              </p>
            </div>
          </div>

          {/* Status Message */}
          <div className="p-3 bg-white rounded border">
            <p className="text-sm font-medium">{status}</p>
          </div>

          {/* Failed Batches Actions */}
          {result.failed.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="font-medium text-yellow-800 mb-3">
                ⚠️ {result.failed.length} batches failed
              </p>

              {/* Show first few errors */}
              <div className="mb-3 space-y-2 max-h-40 overflow-y-auto">
                {result.failed.slice(0, 3).map((batch) => (
                  <div
                    key={batch.batchNumber}
                    className="text-sm p-2 bg-white rounded border"
                  >
                    <p className="font-medium">Batch {batch.batchNumber}:</p>
                    <p className="text-red-600">
                      {typeof batch.error === 'object' && batch.error !== null
                        ? (batch.error as { error?: string }).error ||
                          'Unknown error'
                        : String(batch.error)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Retries attempted: {batch.retriesAttempted}
                    </p>
                  </div>
                ))}
                {result.failed.length > 3 && (
                  <p className="text-xs text-gray-600">
                    ... and {result.failed.length - 3} more failed batches
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={retryFailed}
                  disabled={isImporting}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:bg-gray-400"
                >
                  🔄 Retry Failed Batches
                </button>

                <button
                  onClick={exportFailed}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  📥 Export Failed Records
                </button>
              </div>
            </div>
          )}

          {/* Success Message */}
          {result.failed.length === 0 && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800 font-medium">
                🎉 All records imported successfully!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-bold text-blue-900 mb-2">How it works:</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Upload a CSV file with up to 20,000+ records</li>
          <li>Records are automatically split into batches of 1,000</li>
          <li>
            Each batch is imported with automatic retry (up to 3 attempts)
          </li>
          <li>
            If a batch fails validation, it continues with remaining batches
          </li>
          <li>View detailed results and retry failed batches</li>
          <li>Export failed records to CSV for manual review/fixing</li>
        </ul>
      </div>
    </div>
  );
}
