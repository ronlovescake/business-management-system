import { useCallback } from 'react';
import Papa from 'papaparse';
import { showNotification } from '@mantine/notifications';
import type { Backup, BackupData } from '../../backup/types';
import {
  downloadTextFile,
  resolveRowsForClientExport,
} from './backupRestoreTabUtils';

type FetchTableSample = (
  timestamp: string,
  jsonFile: string,
  table: string,
  options?: { limit?: number; offset?: number }
) => Promise<BackupData>;

type UseBackupDownloadHandlersArgs = {
  previewData: BackupData | null;
  selectedBackupTimestamp: string | null;
  previewJsonFile: string | null;
  fetchTableSample: FetchTableSample;
};

const MAX_CLIENT_EXPORT_ROWS = 5000;

const reserveUniqueSheetName = (baseName: string, usedNames?: Set<string>) => {
  const fallback = 'Sheet';
  const normalizedBase = (baseName || fallback).slice(0, 31);
  const nameRegistry = usedNames ?? new Set<string>();

  let candidate = normalizedBase;
  let suffixNumber = 2;

  while (nameRegistry.has(candidate)) {
    const suffix = `_${suffixNumber}`;
    candidate = `${normalizedBase.slice(0, 31 - suffix.length)}${suffix}`;
    suffixNumber++;
  }

  nameRegistry.add(candidate);
  return candidate;
};

export const useBackupDownloadHandlers = ({
  previewData,
  selectedBackupTimestamp,
  previewJsonFile,
  fetchTableSample,
}: UseBackupDownloadHandlersArgs) => {
  const handleDownloadJSON = useCallback(async (backup: Backup) => {
    try {
      const jsonFile =
        backup.files.find(
          (f) => f.includes('backup-') && f.endsWith('.json')
        ) || backup.files.find((f) => f.endsWith('.json'));
      if (!jsonFile) {
        return;
      }

      const response = await fetch(
        `/api/backup/${backup.timestamp}/${jsonFile}`
      );
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = jsonFile;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  }, []);

  const handleDownloadDump = useCallback(async (backup: Backup) => {
    try {
      const dumpFile =
        backup.files.find(
          (f) => f.includes('backup-') && f.endsWith('.dump')
        ) ||
        backup.files.find((f) => f.endsWith('.dump')) ||
        backup.files.find(
          (f) => f.includes('backup-') && f.endsWith('.sql')
        ) ||
        backup.files.find((f) => f.endsWith('.sql'));
      if (!dumpFile) {
        showNotification({
          title: 'No Database Dump',
          message: 'This backup does not contain a PostgreSQL dump file',
          color: 'orange',
        });
        return;
      }

      const response = await fetch(
        `/api/backup/${backup.timestamp}/${dumpFile}`
      );
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dumpFile;
      a.click();
      URL.revokeObjectURL(url);

      showNotification({
        title: 'Downloaded',
        message: dumpFile,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  }, []);

  const handleDownloadXLSX = useCallback(
    async (tableName: string) => {
      if (!previewData) {
        return;
      }

      try {
        const XLSX = await import('xlsx');
        const resolved = await resolveRowsForClientExport({
          previewData,
          tableName,
          maxRows: MAX_CLIENT_EXPORT_ROWS,
          selectedBackupTimestamp,
          previewJsonFile,
          fetchTableSample,
        });

        if (resolved.tooLarge) {
          showNotification({
            title: 'Too large for browser export',
            message: `Table has ${previewData.tables[tableName]?.count ?? 0} rows. Use Download JSON or a database dump for large exports.`,
            color: 'yellow',
          });
          return;
        }

        if (resolved.missingContext) {
          throw new Error('Backup file context missing');
        }

        if (!resolved.rows.length) {
          return;
        }

        const ws = XLSX.utils.json_to_sheet(resolved.rows);
        const wb = XLSX.utils.book_new();
        const sheetName = reserveUniqueSheetName(tableName);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);

        XLSX.writeFile(wb, `${tableName}-${selectedBackupTimestamp}.xlsx`);

        showNotification({
          title: 'Downloaded',
          message: `${tableName}.xlsx`,
          color: 'green',
        });
      } catch (error) {
        showNotification({
          title: 'Download Failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          color: 'red',
        });
      }
    },
    [fetchTableSample, previewData, previewJsonFile, selectedBackupTimestamp]
  );

  const handleDownloadAllXLSX = useCallback(async () => {
    if (!previewData) {
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const usedSheetNames = new Set<string>();
      let sheetCount = 0;
      let skipped = 0;

      for (const [tableName, tableData] of Object.entries(previewData.tables)) {
        if (!tableData?.count) {
          continue;
        }

        const resolved = await resolveRowsForClientExport({
          previewData,
          tableName,
          maxRows: MAX_CLIENT_EXPORT_ROWS,
          selectedBackupTimestamp,
          previewJsonFile,
          fetchTableSample,
        });

        if (resolved.tooLarge || resolved.missingContext) {
          skipped++;
          continue;
        }

        if (resolved.rows.length) {
          const ws = XLSX.utils.json_to_sheet(resolved.rows);
          const sheetName = reserveUniqueSheetName(tableName, usedSheetNames);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
          sheetCount++;
        }
      }

      if (sheetCount > 0) {
        XLSX.writeFile(wb, `backup-all-tables-${selectedBackupTimestamp}.xlsx`);
        showNotification({
          title: 'Downloaded',
          message: skipped
            ? `${sheetCount} tables in workbook (${skipped} skipped)`
            : `${sheetCount} tables in workbook`,
          color: 'green',
        });
      }
    } catch (error) {
      showNotification({
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    }
  }, [fetchTableSample, previewData, previewJsonFile, selectedBackupTimestamp]);

  const handleDownloadCSV = useCallback(
    async (tableName: string) => {
      if (!previewData) {
        return;
      }

      try {
        const resolved = await resolveRowsForClientExport({
          previewData,
          tableName,
          maxRows: MAX_CLIENT_EXPORT_ROWS,
          selectedBackupTimestamp,
          previewJsonFile,
          fetchTableSample,
        });

        if (resolved.tooLarge) {
          showNotification({
            title: 'Too large for browser export',
            message: `Table has ${previewData.tables[tableName]?.count ?? 0} rows. Use Download JSON or a database dump for large exports.`,
            color: 'yellow',
          });
          return;
        }

        if (resolved.missingContext) {
          throw new Error('Backup file context missing');
        }

        if (!resolved.rows.length) {
          return;
        }

        const csv = Papa.unparse(resolved.rows);
        downloadTextFile(
          csv,
          'text/csv',
          `${tableName}-${selectedBackupTimestamp}.csv`
        );

        showNotification({
          title: 'Downloaded',
          message: `${tableName}.csv`,
          color: 'green',
        });
      } catch (error) {
        showNotification({
          title: 'Download Failed',
          message: error instanceof Error ? error.message : 'Unknown error',
          color: 'red',
        });
      }
    },
    [fetchTableSample, previewData, previewJsonFile, selectedBackupTimestamp]
  );

  const handleDownloadAllCSV = useCallback(async () => {
    if (!previewData) {
      return;
    }

    let count = 0;
    let skipped = 0;
    for (const [tableName, tableData] of Object.entries(previewData.tables)) {
      if (!tableData?.count) {
        continue;
      }

      const resolved = await resolveRowsForClientExport({
        previewData,
        tableName,
        maxRows: MAX_CLIENT_EXPORT_ROWS,
        selectedBackupTimestamp,
        previewJsonFile,
        fetchTableSample,
      });

      if (resolved.tooLarge || resolved.missingContext) {
        skipped++;
        continue;
      }

      if (!resolved.rows.length) {
        continue;
      }

      const csv = Papa.unparse(resolved.rows);
      downloadTextFile(
        csv,
        'text/csv',
        `${tableName}-${selectedBackupTimestamp}.csv`
      );
      await new Promise((r) => setTimeout(r, 100));
      count++;
    }

    showNotification({
      title: 'Downloaded',
      message: skipped
        ? `${count} CSV files (${skipped} skipped)`
        : `${count} CSV files`,
      color: 'green',
    });
  }, [fetchTableSample, previewData, previewJsonFile, selectedBackupTimestamp]);

  return {
    handleDownloadJSON,
    handleDownloadDump,
    handleDownloadXLSX,
    handleDownloadAllXLSX,
    handleDownloadCSV,
    handleDownloadAllCSV,
  };
};
