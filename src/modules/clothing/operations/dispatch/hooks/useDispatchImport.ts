'use client';

import { useState, useCallback } from 'react';
import { showNotification } from '@mantine/notifications';
import * as XLSX from 'xlsx';
import { logger } from '@/lib/logger';
import { showInfo } from '@/lib/alerts';
import type { RawOrderData } from '../types';

interface UseDispatchImportParams {
  setRawData: (data: RawOrderData[]) => void;
  saveOrdersMutation: {
    mutateAsync: (data: RawOrderData[]) => Promise<unknown>;
  };
}

interface UseDispatchImportResult {
  isImportingRawData: boolean;
  handleXlsxImport: (file: File | null) => Promise<void>;
  handleExportCSV: () => void;
}

export function useDispatchImport({
  setRawData,
  saveOrdersMutation,
}: UseDispatchImportParams): UseDispatchImportResult {
  const [isImportingRawData, setIsImportingRawData] = useState(false);

  // XLSX import handler for Raw Data tab
  const handleXlsxImport = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }

      setIsImportingRawData(true);
      try {
        // Validate file extension
        const fileName = file.name.toLowerCase();
        if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
          throw new Error(
            'Invalid file format. Please upload an Excel file (.xlsx or .xls)'
          );
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB in bytes
        if (file.size > maxSize) {
          throw new Error(
            'File size exceeds 10MB limit. Please upload a smaller file.'
          );
        }

        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });

        // Validate workbook has sheets
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error(
            'The Excel file appears to be empty or corrupted. No sheets found.'
          );
        }

        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Validate worksheet exists
        if (!worksheet) {
          throw new Error('Unable to read worksheet data from the Excel file.');
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet) as RawOrderData[];

        // Validate data is not empty
        if (!jsonData || jsonData.length === 0) {
          throw new Error(
            'The Excel file contains no data rows. Please check the file and try again.'
          );
        }

        // Log imported data structure for debugging
        logger.info('XLSX import successful', {
          fileName: file.name,
          rowCount: jsonData.length,
          sheetName,
          sampleRow: jsonData[0],
        });

        // Update local state first for immediate UI feedback
        setRawData(jsonData);

        // Save to database (replaces previous data)
        await saveOrdersMutation.mutateAsync(jsonData);

        showNotification({
          title: 'Success',
          message: `Successfully imported and saved ${jsonData.length} rows from ${file.name}`,
          color: 'green',
        });
      } catch (error) {
        // Enhanced error logging
        logger.error('Failed to import XLSX file', {
          error,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        });

        // Provide more specific error message
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Failed to import XLSX file. Please ensure the file is a valid Excel file with data.';

        showNotification({
          title: 'Import Failed',
          message: errorMessage,
          color: 'red',
          autoClose: 7000,
        });
      } finally {
        setIsImportingRawData(false);
      }
    },
    [setRawData, saveOrdersMutation]
  );

  // CSV export handler (simulation for now)
  const handleExportCSV = useCallback(() => {
    showInfo('Would export CSV file', 'Export Simulation');
  }, []);

  return {
    isImportingRawData,
    handleXlsxImport,
    handleExportCSV,
  };
}
