import { Select } from '@mantine/core';
import { useMemo } from 'react';
import type { InvoicingTabProps } from './InvoicingTab';
import { InvoicingTab } from './InvoicingTab';

export type LocalInvoicingTabProps = Omit<
  InvoicingTabProps,
  'searchPlaceholder' | 'summaryLabel' | 'emptyStateMessage' | 'addNewLabel'
> & {
  searchPlaceholder?: string;
  summaryLabel?: string;
  emptyStateMessage?: string;
  addNewLabel?: string;
  invoiceDateOptions: string[];
  invoiceDateFilter: string | null;
  onInvoiceDateFilterChange: (value: string | null) => void;
};

export function LocalInvoicingTab({
  searchPlaceholder,
  summaryLabel,
  emptyStateMessage,
  addNewLabel,
  invoiceDateOptions,
  invoiceDateFilter,
  onInvoiceDateFilterChange,
  ...rest
}: LocalInvoicingTabProps) {
  const invoiceDateSelectData = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    });

    const formattedOptions = invoiceDateOptions.map((value) => {
      const timestamp = Date.parse(value);
      const label = Number.isNaN(timestamp)
        ? value
        : formatter.format(new Date(timestamp));
      return {
        value,
        label,
      };
    });
    return [
      { value: '__all', label: 'All invoice dates' },
      ...formattedOptions,
    ];
  }, [invoiceDateOptions]);

  const selectValue = invoiceDateFilter ?? '__all';

  const searchAddon = (
    <Select
      placeholder="Invoice date"
      data={invoiceDateSelectData}
      value={selectValue}
      onChange={(value) => {
        if (!value || value === '__all') {
          onInvoiceDateFilterChange(null);
          return;
        }
        onInvoiceDateFilterChange(value);
      }}
      size="sm"
      styles={{ input: { minWidth: 200 } }}
    />
  );

  return (
    <InvoicingTab
      {...rest}
      searchPlaceholder={searchPlaceholder ?? 'Search invoicing records...'}
      summaryLabel={summaryLabel ?? 'invoicing records'}
      emptyStateMessage={
        emptyStateMessage ??
        'No invoicing records found for the selected invoice date.'
      }
      addNewLabel={addNewLabel ?? 'Retrieve Invoices'}
      searchAddon={searchAddon}
      showAddNewButton={false}
      showDriveFilesColumn={false}
    />
  );
}
