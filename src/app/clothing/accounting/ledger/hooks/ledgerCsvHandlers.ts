import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';
import { parseManualEntryCsv } from '@/lib/accounting/manual-entry-import';
import {
  buildCsvContent,
  downloadCsvFile,
  downloadCsvTemplateFile,
  escapeCsvValue,
} from '@/lib/accounting/csv';
import { getCurrentDateISO } from '@/utils/date';
import type { LedgerEntry } from './useLedger';

interface ImportLedgerCsvParams {
  file: File;
  apiPath: (path: string) => string;
  refreshLedger: () => Promise<void>;
  maxFileSizeBytes: number;
  maxRows: number;
}

interface ExportLedgerCsvParams {
  entries: LedgerEntry[];
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      resolve((event.target?.result as string) ?? '');
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file'));
    };
    reader.readAsText(file);
  });
}

export async function importLedgerCsv({
  file,
  apiPath,
  refreshLedger,
  maxFileSizeBytes,
  maxRows,
}: ImportLedgerCsvParams): Promise<void> {
  if (file.size > maxFileSizeBytes) {
    showNotification({
      color: 'red',
      title: 'Import failed',
      message: 'CSV file is too large (max 5 MB).',
    });
    return;
  }

  try {
    const text = await readFileAsText(file);
    const { rows, errors } = parseManualEntryCsv(text);

    if (errors.length > 0) {
      showNotification({
        color: 'red',
        title: 'Import failed',
        message: errors.slice(0, 5).join('\n'),
      });
      return;
    }

    const cappedRows = rows.slice(0, maxRows);
    const skippedCount = rows.length - cappedRows.length;

    let successCount = 0;
    let errorCount = 0;

    for (const entry of cappedRows) {
      try {
        const response = await fetch(apiPath('/accounting/manual-journal'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entry),
        });

        if (!response.ok) {
          errorCount++;
          continue;
        }
        successCount++;
      } catch (error) {
        logger.error('Ledger CSV import row failed', { error, entry });
        errorCount++;
      }
    }

    await refreshLedger();
    showNotification({
      color: errorCount > 0 ? 'yellow' : 'green',
      title: 'Ledger import complete',
      message:
        `Imported ${successCount} entries` +
        (errorCount > 0 ? `, ${errorCount} failed.` : '.') +
        (skippedCount > 0
          ? ` ${skippedCount} rows skipped (limit ${maxRows}).`
          : ''),
    });
  } catch (error) {
    logger.error('Ledger CSV import failed', { error });
    showNotification({
      color: 'red',
      title: 'Import failed',
      message: 'Unable to import ledger CSV file.',
    });
  }
}

export function exportLedgerCsv({ entries }: ExportLedgerCsvParams): void {
  if (entries.length === 0) {
    showNotification({
      color: 'red',
      title: 'Export failed',
      message: 'No ledger entries to export.',
    });
    return;
  }

  const headers = [
    'Date',
    'Ref',
    'Account',
    'Debit',
    'Credit',
    'Description',
    'Source Type',
    'Source Id',
    'Source Line',
    'System Generated',
  ];

  const rows = entries.map((entry) => [
    escapeCsvValue(entry.date),
    escapeCsvValue(entry.ref),
    escapeCsvValue(entry.account),
    escapeCsvValue(entry.debit.toFixed(2)),
    escapeCsvValue(entry.credit.toFixed(2)),
    escapeCsvValue(entry.description),
    escapeCsvValue(entry.sourceType || ''),
    escapeCsvValue(entry.sourceId || ''),
    escapeCsvValue(entry.sourceLineKey || ''),
    escapeCsvValue(entry.systemGenerated ? 'yes' : 'no'),
  ]);

  const csvContent = buildCsvContent(headers, rows);
  const date = getCurrentDateISO();
  const filename = `ledger_${date}.csv`;
  downloadCsvFile(filename, csvContent);
}

export function downloadLedgerCsvTemplate(): void {
  const date = getCurrentDateISO();
  downloadCsvTemplateFile(`ledger_template_${date}.csv`, [
    'date',
    'amount',
    'ref',
    'debitAccount',
    'creditAccount',
    'description',
  ]);
}
