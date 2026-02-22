import React from 'react';
import { showNotification } from '@mantine/notifications';
import { Group, Button, Pill, Loader, Popover } from '@mantine/core';
import { IconFileSpreadsheet } from '@tabler/icons-react';

interface UseTransactionsLayoutProps<T> {
  filteredData: T[];
  statusOptions?: string[];
  selectedStatuses?: Set<string>;
  onStatusFilter?: (status: string) => void;
  extraActionButtons?: React.ReactNode;
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
  extraActionButtons,
  showActionButtons = true,
  onGenerateInvoice,
  onGeneratePackingList,
  onGenerateDistribution,
  isGeneratingInvoice = false,
  isGeneratingPackingList = false,
  isGeneratingDistribution = false,
}: UseTransactionsLayoutProps<T>) {
  const [showMoreOpened, setShowMoreOpened] = React.useState(false);
  const [toolsOpened, setToolsOpened] = React.useState(false);

  const secondaryStatuses = React.useMemo(
    () => new Set(['Shipped', 'Cancelled', 'Forfeited', 'Voided']),
    []
  );

  const { primaryStatusOptions, extraStatusOptions } = React.useMemo(() => {
    const primary: string[] = [];
    const extra: string[] = [];

    statusOptions.forEach((status) => {
      if (secondaryStatuses.has(status)) {
        extra.push(status);
        return;
      }
      primary.push(status);
    });

    return {
      primaryStatusOptions: primary,
      extraStatusOptions: extra,
    };
  }, [secondaryStatuses, statusOptions]);

  const hasActiveExtraStatus = React.useMemo(
    () => extraStatusOptions.some((status) => selectedStatuses.has(status)),
    [extraStatusOptions, selectedStatuses]
  );

  const getPillStyles = React.useCallback(
    (isSelected: boolean) => ({
      backgroundColor: isSelected ? '#228be6' : '#e9ecef',
      color: isSelected ? '#ffffff' : '#495057',
      cursor: 'pointer',
      fontWeight: isSelected ? 600 : 400,
      transition: 'all 0.2s ease',
    }),
    []
  );

  // Export to XLSX function
  const handleExportToXLSX = React.useCallback(async () => {
    try {
      const XLSX = await import('xlsx');
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
  const statusFilterPills =
    statusOptions.length > 0 && onStatusFilter ? (
      <Group gap="xs" wrap="nowrap">
        {primaryStatusOptions.map((status) => (
          <Pill
            key={status}
            size="md"
            withRemoveButton={false}
            onClick={() => onStatusFilter(status)}
            style={getPillStyles(selectedStatuses.has(status))}
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

        {extraStatusOptions.length > 0 && (
          <Popover
            opened={showMoreOpened}
            onChange={setShowMoreOpened}
            position="bottom-start"
            withArrow
            shadow="md"
          >
            <Popover.Target>
              <Pill
                size="md"
                withRemoveButton={false}
                onClick={() => setShowMoreOpened((prev) => !prev)}
                style={getPillStyles(hasActiveExtraStatus || showMoreOpened)}
                onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                  if (!hasActiveExtraStatus && !showMoreOpened) {
                    e.currentTarget.style.backgroundColor = '#dee2e6';
                  }
                }}
                onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                  if (!hasActiveExtraStatus && !showMoreOpened) {
                    e.currentTarget.style.backgroundColor = '#e9ecef';
                  }
                }}
              >
                Show More
              </Pill>
            </Popover.Target>
            <Popover.Dropdown>
              <Group gap="xs" wrap="wrap">
                {extraStatusOptions.map((status) => (
                  <Pill
                    key={status}
                    size="md"
                    withRemoveButton={false}
                    onClick={() => onStatusFilter(status)}
                    style={getPillStyles(selectedStatuses.has(status))}
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
            </Popover.Dropdown>
          </Popover>
        )}
      </Group>
    ) : undefined;

  // Action buttons for document generation
  const toolsButtons = (
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
      {extraActionButtons}
    </Group>
  );

  const toolsButton = showActionButtons ? (
    <Popover
      opened={toolsOpened}
      onChange={setToolsOpened}
      position="bottom-end"
      withArrow
      shadow="md"
    >
      <Popover.Target>
        <Button
          variant="outline"
          radius="sm"
          onClick={() => setToolsOpened((prev) => !prev)}
          style={{
            backgroundColor: toolsOpened ? '#228be6' : '#e9ecef',
            borderColor: toolsOpened ? '#1c7ed6' : '#dee2e6',
            borderWidth: '1.5px',
            color: toolsOpened ? '#ffffff' : '#495057',
            minWidth: '120px',
            fontWeight: 600,
          }}
        >
          TOOLS
        </Button>
      </Popover.Target>
      <Popover.Dropdown>{toolsButtons}</Popover.Dropdown>
    </Popover>
  ) : null;

  const searchRightButtons =
    statusFilterPills || toolsButton ? (
      <Group gap="xs" wrap="nowrap">
        {statusFilterPills}
        {toolsButton}
      </Group>
    ) : undefined;

  return {
    handleExportToXLSX,
    searchRightButtons,
    statusFilterPills,
    actionButtons: null,
  };
}
