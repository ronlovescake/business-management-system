import { showNotification } from '@mantine/notifications';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import { TransactionService } from '../services/TransactionService';
import type { TransactionData } from '../types/transaction.types';

interface ImportTransactionsFromCsvParams {
  file: File;
  apiBasePath?: string;
  bulkUpdate: (data: TransactionData[]) => void;
  logNotification: (
    message: string,
    metadata?: Record<string, unknown>
  ) => void;
}

export async function importTransactionsFromCsv({
  file,
  apiBasePath,
  bulkUpdate,
  logNotification,
}: ImportTransactionsFromCsvParams): Promise<void> {
  try {
    const text = await file.text();
    const importedTransactions =
      TransactionService.transformCSVToTransactions(text);

    if (importedTransactions.length === 0) {
      showNotification({
        title: '⚠️ Import Warning',
        message: 'No valid transaction data found in the CSV file',
        color: 'yellow',
        autoClose: 4000,
      });
      return;
    }

    const result = await api.post<{ count: number }>(
      buildApiPath(apiBasePath, '/transactions'),
      importedTransactions
    );

    const reloadedData = await api.get<TransactionData[]>(
      buildApiPath(apiBasePath, '/transactions')
    );
    bulkUpdate(reloadedData);

    showNotification({
      title: '✅ Import Successful',
      message: `${result.count} transactions imported with auto-calculated Unit Price and Line Total`,
      color: 'green',
      autoClose: 5000,
    });

    logNotification(
      `${result.count} transactions imported from ${file.name}.`,
      {
        type: 'csv-import',
        rowsImported: result.count,
        fileName: file.name,
      }
    );
  } catch (error) {
    logger.error('Import error:', error);
    showNotification({
      title: '❌ Import Failed',
      message: 'Failed to parse CSV file. Please check the file format.',
      color: 'red',
      autoClose: 4000,
    });
  }
}
