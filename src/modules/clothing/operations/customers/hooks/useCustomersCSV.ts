import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { showNotification, hideNotification } from '@mantine/notifications';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
import { CustomerService } from '../services/CustomerService';
import type { CustomerData } from '../types/customer.types';

interface UseCustomersCSVProps {
  customers: CustomerData[];
  filteredCustomers: CustomerData[];
  apiBasePath?: string;
}

export function useCustomersCSV({
  customers,
  filteredCustomers,
  apiBasePath,
}: UseCustomersCSVProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);

  // CSV import functionality
  const handleImportCSV = async (file: File | null) => {
    if (!file) {
      return;
    }

    try {
      showNotification({
        id: 'import-progress',
        title: 'Importing...',
        message: 'Processing CSV file, please wait...',
        color: 'blue',
        loading: true,
        autoClose: false,
      });

      const result = await CustomerService.importFromCSV(file, apiBasePath);

      hideNotification('import-progress');

      if (result.success && result.stats) {
        const {
          customersCreated,
          customersUpdated,
          additionalInfoCreated,
          errors,
          totalRows,
        } = result.stats;

        showNotification({
          title: 'Import Successful',
          message: `Processed ${totalRows} rows. Created ${customersCreated} new customers, updated ${customersUpdated} customers, added ${additionalInfoCreated} additional info records${errors.length > 0 ? `. ${errors.length} errors occurred.` : ''}`,
          color: errors.length > 0 ? 'yellow' : 'green',
          autoClose: 10000,
        });

        if (errors.length > 0) {
          logger.warn('Import errors:', errors);
        }

        // Refresh customers list
        void queryClient.invalidateQueries({
          queryKey: queryKeys.customers.lists(),
        });
      } else {
        showNotification({
          title: 'Import Failed',
          message: result.error || 'Error importing CSV file.',
          color: 'red',
        });
      }

      setFile(null);
    } catch (error) {
      hideNotification('import-progress');
      logger.error('Error importing CSV:', error);
      showNotification({
        title: 'Import Failed',
        message: 'Error importing CSV file. Please check the file format.',
        color: 'red',
      });
    }
  };

  // CSV export functionality
  const handleExportCSV = () => {
    try {
      const dataToExport =
        filteredCustomers.length > 0 ? filteredCustomers : customers;
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `customers-export-${timestamp}.csv`;

      CustomerService.exportToCSV(dataToExport, filename);

      showNotification({
        title: 'Export Successful',
        message: `Exported ${dataToExport.length} customers to ${filename}`,
        color: 'green',
      });
    } catch (error) {
      logger.error('Error exporting CSV:', error);
      showNotification({
        title: 'Export Failed',
        message: 'Error exporting CSV file.',
        color: 'red',
      });
    }
  };

  // CSV export with additional info (numbered columns format)
  const handleExportDetailedCSV = async () => {
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `customers-detailed-${timestamp}.csv`;

      const result = await CustomerService.exportToCSVDetailed(
        filename,
        5,
        apiBasePath
      );

      if (result.warning) {
        showNotification({
          title: '⚠️ Export Successful (with warnings)',
          message: result.warning,
          color: 'yellow',
          autoClose: 10000,
        });
      } else {
        showNotification({
          title: 'Export Successful',
          message:
            'Exported customers with all additional info (Shopee usernames, addresses, phones, alternate names, Facebook)',
          color: 'green',
        });
      }
    } catch (error) {
      logger.error('Error exporting detailed CSV:', error);
      showNotification({
        title: 'Export Failed',
        message: 'Error exporting detailed CSV file.',
        color: 'red',
      });
    }
  };

  // CSV export with duplicate rows format (for analysis)
  const handleExportAnalysisCSV = async () => {
    try {
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `customers-analysis-${timestamp}.csv`;

      await CustomerService.exportToCSVDuplicateRows(filename, apiBasePath);

      showNotification({
        title: 'Export Successful',
        message: 'Exported customers in duplicate rows format for analysis',
        color: 'green',
      });
    } catch (error) {
      logger.error('Error exporting analysis CSV:', error);
      showNotification({
        title: 'Export Failed',
        message: 'Error exporting analysis CSV file.',
        color: 'red',
      });
    }
  };

  return {
    file,
    setFile,
    handleImportCSV,
    handleExportCSV,
    handleExportDetailedCSV,
    handleExportAnalysisCSV,
  };
}
