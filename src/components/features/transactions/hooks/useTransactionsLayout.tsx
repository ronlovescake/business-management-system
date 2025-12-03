import React from 'react';
import * as XLSX from 'xlsx';
import { showNotification } from '@mantine/notifications';
import { Group, Button, Pill, Loader } from '@mantine/core';
import { IconFileSpreadsheet } from '@tabler/icons-react';

interface UseTransactionsLayoutProps<T> {
  filteredData: T[];
  statusOptions?: string[];
  selectedStatuses?: Set<string>;
  onStatusFilter?: (status: string) => void;
  showActionButtons?: boolean;
  onGenerateInvoice?: (data: T[]) => void | Promise<void>;
  onGeneratePackingList?: (data: T[]) => void | Promise<void>;
  onGenerateDistribution?: (data: T[]) => void | Promise<void>;
  isGeneratingInvoice?: boolean;
  isGeneratingPackingList?: boolean;
  isGeneratingDistribution?: boolean;
}

export function useTransactionsLayout<T extends object>({
  filteredData,
  statusOptions = [],
  selectedStatuses = new Set(),
  onStatusFilter,
  showActionButtons = true,
  onGenerateInvoice,
  onGeneratePackingList,
  onGenerateDistribution,
  isGeneratingInvoice = false,
  isGeneratingPackingList = false,
  isGeneratingDistribution = false,
}: UseTransactionsLayoutProps<T>) {
  // Export to XLSX function
  const handleExportToXLSX = React.useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(filteredData);
      XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[:-]/g, '');
      const filename = `transactions-${timestamp}.xlsx`;

      XLSX.writeFile(wb, filename);

      showNotification({
        title: '✅ Export Successful',
        message: `Downloaded ${filteredData.length} transactions to ${filename}`,
        color: 'green',
        autoClose: 5000,
      });
    } catch (error) {
      showNotification({
        title: '❌ Export Failed',
        message:
          error instanceof Error ? error.message : 'Failed to export data',
        color: 'red',
        autoClose: 5000,
      });
    }
  }, [filteredData]);

  // Status filter pills
  const searchRightButtons =
    statusOptions.length > 0 && onStatusFilter ? (
      <Group gap="xs" wrap="wrap">
        {statusOptions.map((status) => (
          <Pill
            key={status}
            size="md"
            withRemoveButton={false}
            onClick={() => onStatusFilter(status)}
            style={{
              backgroundColor: selectedStatuses.has(status)
                ? '#228be6'
                : '#e9ecef',
              color: selectedStatuses.has(status) ? '#ffffff' : '#495057',
              cursor: 'pointer',
              fontWeight: selectedStatuses.has(status) ? 600 : 400,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
              if (!selectedStatuses.has(status)) {
                e.currentTarget.style.backgroundColor = '#dee2e6';
              }
            }}
            onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
              if (!selectedStatuses.has(status)) {
                e.currentTarget.style.backgroundColor = '#e9ecef';
              }
            }}
          >
            {status}
          </Pill>
        ))}
      </Group>
    ) : undefined;

  // Action buttons for document generation
  const actionButtons = showActionButtons ? (
    <Group>
      {onGenerateDistribution && (
        <Button
          leftSection={
            isGeneratingDistribution ? (
              <Loader size={16} color="white" />
            ) : undefined
          }
          variant="outline"
          onClick={() => onGenerateDistribution(filteredData)}
          disabled={isGeneratingDistribution}
          radius="sm"
          style={{
            backgroundColor: isGeneratingDistribution ? '#ef4444' : '#c8e6fd',
            borderColor: isGeneratingDistribution ? '#dc2626' : '#7dd3fc',
            borderWidth: '1.5px',
            color: isGeneratingDistribution ? '#ffffff' : '#374151',
            width: '175px',
          }}
        >
          {isGeneratingDistribution ? 'GENERATING...' : 'Create Distribution'}
        </Button>
      )}
      {onGenerateInvoice && (
        <Button
          leftSection={
            isGeneratingInvoice ? <Loader size={16} color="white" /> : undefined
          }
          variant="outline"
          onClick={() => onGenerateInvoice(filteredData)}
          disabled={isGeneratingInvoice}
          radius="sm"
          style={{
            backgroundColor: isGeneratingInvoice ? '#ef4444' : '#c8e6fd',
            borderColor: isGeneratingInvoice ? '#dc2626' : '#7dd3fc',
            borderWidth: '1.5px',
            color: isGeneratingInvoice ? '#ffffff' : '#374151',
            width: '175px',
          }}
        >
          {isGeneratingInvoice ? 'GENERATING...' : 'Create Invoice'}
        </Button>
      )}
      {onGeneratePackingList && (
        <Button
          leftSection={
            isGeneratingPackingList ? (
              <Loader size={16} color="white" />
            ) : undefined
          }
          variant="outline"
          onClick={() => onGeneratePackingList(filteredData)}
          disabled={isGeneratingPackingList}
          radius="sm"
          style={{
            backgroundColor: isGeneratingPackingList ? '#ef4444' : '#c8e6fd',
            borderColor: isGeneratingPackingList ? '#dc2626' : '#7dd3fc',
            borderWidth: '1.5px',
            color: isGeneratingPackingList ? '#ffffff' : '#374151',
            width: '175px',
          }}
        >
          {isGeneratingPackingList ? 'GENERATING...' : 'Create Packing List'}
        </Button>
      )}
      <Button
        leftSection={<IconFileSpreadsheet size={16} />}
        variant="outline"
        onClick={handleExportToXLSX}
        radius="sm"
        style={{
          backgroundColor: '#10b981',
          borderColor: '#059669',
          borderWidth: '1.5px',
          color: '#ffffff',
          width: '175px',
        }}
      >
        Export to XLSX
      </Button>
    </Group>
  ) : null;

  return {
    handleExportToXLSX,
    searchRightButtons,
    actionButtons,
  };
}
