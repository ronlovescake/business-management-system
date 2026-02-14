import { Stack, Group, Text, Table, Anchor, Checkbox } from '@mantine/core';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import type { CheckoutLinkData, InvoiceData } from '../../types';
import type { ReactNode } from 'react';

export interface InvoicingTabProps {
  invoiceData: InvoiceData[];
  filteredInvoiceData: InvoiceData[];
  checkoutLinks: CheckoutLinkData[];
  onSearch: (query: string) => void;
  onImport?: (file: File | null) => void;
  onExport?: () => void;
  searchValue?: string;
  onSyncGoogleDrive?: () => void;
  isSyncing?: boolean;
  onCustomerNameClick?: (invoice: InvoiceData) => void;
  hasFacebookLink?: (customerName: string) => boolean;
  onTickboxChange?: (invoiceId: string, nextValue: boolean) => void;
  calculateFinalWeight?: (weight: string) => string;
  findCheckoutLinkByWeight?: (
    weight: string,
    data: CheckoutLinkData[]
  ) => string | undefined;
  searchPlaceholder?: string;
  summaryLabel?: string;
  emptyStateMessage?: string;
  addNewLabel?: string;
  showAddNewButton?: boolean;
  searchAddon?: ReactNode;
  showDriveFilesColumn?: boolean;
}

export function InvoicingTab({
  invoiceData,
  filteredInvoiceData,
  checkoutLinks,
  onSearch,
  onImport,
  onExport,
  onSyncGoogleDrive,
  isSyncing,
  onCustomerNameClick,
  hasFacebookLink,
  onTickboxChange,
  calculateFinalWeight,
  findCheckoutLinkByWeight,
  searchPlaceholder = 'Search invoicing records...',
  summaryLabel = 'invoicing records',
  emptyStateMessage = "No invoicing records found. Click 'Add New' to get started.",
  addNewLabel = 'Retrieve Google Drive Invoices',
  showAddNewButton = true,
  searchAddon,
  showDriveFilesColumn = true,
  searchValue,
}: InvoicingTabProps) {
  const safeIsSyncing = Boolean(isSyncing);
  const safeCalculateFinalWeight =
    calculateFinalWeight ?? ((weight: string) => weight);
  const safeFindCheckoutLinkByWeight =
    findCheckoutLinkByWeight ?? (() => undefined);

  return (
    <Stack gap="md">
      <StandardTableControls
        searchPlaceholder={searchPlaceholder}
        onSearch={onSearch}
        searchValue={searchValue}
        onImport={onImport}
        onExport={onExport}
        hideImport={!onImport}
        hideExport={!onExport}
        onAddNew={showAddNewButton ? onSyncGoogleDrive : undefined}
        addNewLabel={addNewLabel}
        isImporting={safeIsSyncing}
        hideAddNew={!showAddNewButton}
        searchAddon={searchAddon}
      />

      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {filteredInvoiceData.length} of {invoiceData.length}{' '}
              {summaryLabel}
            </Text>
          </Group>
        }
      >
        {(() => {
          const baseHeaders = [
            'CUSTOMER NAME',
            'ACTUAL WEIGHT',
            'FINAL WEIGHT',
            'SHOPEE CHECKOUT LINKS',
          ];
          const headers = showDriveFilesColumn
            ? [...baseHeaders, 'DRIVE FILES', 'TICKBOX']
            : [...baseHeaders, 'TICKBOX'];
          const colSpan = headers.length;

          return (
            <StandardDataTable
              headers={headers}
              emptyState={emptyStateMessage}
              colSpan={colSpan}
            >
              {filteredInvoiceData.map((row) => (
                <Table.Tr
                  key={row.id}
                  style={{
                    opacity: row.tickbox ? 0.5 : 1,
                    transition: 'opacity 0.2s ease',
                  }}
                >
                  <Table.Td>
                    {hasFacebookLink?.(row.customerName) &&
                    !row.tickbox &&
                    onCustomerNameClick ? (
                      <Anchor
                        size="sm"
                        c="blue"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          onCustomerNameClick(row);
                        }}
                        title="Click to copy message and open Facebook Messenger"
                      >
                        {row.customerName}
                      </Anchor>
                    ) : (
                      <Text size="sm" c="#495057">
                        {row.customerName}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Text size="sm" c="#495057">
                      {row.actualWeight}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Text size="sm" c="#495057">
                      {safeCalculateFinalWeight(row.actualWeight)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {(() => {
                      const finalWeight = safeCalculateFinalWeight(
                        row.actualWeight
                      );
                      const checkoutLink = safeFindCheckoutLinkByWeight(
                        finalWeight,
                        checkoutLinks
                      );

                      return checkoutLink ? (
                        <Anchor
                          href={
                            checkoutLink.startsWith('http')
                              ? checkoutLink
                              : `https://${checkoutLink}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          lineClamp={2}
                        >
                          {checkoutLink}
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      );
                    })()}
                  </Table.Td>
                  {showDriveFilesColumn ? (
                    <Table.Td>
                      {row.driveFiles ? (
                        <Anchor
                          href={
                            row.driveFiles.startsWith('http')
                              ? row.driveFiles
                              : `https://${row.driveFiles}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          size="sm"
                          lineClamp={2}
                        >
                          {row.driveFiles}
                        </Anchor>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                  ) : null}
                  <Table.Td style={{ textAlign: 'center' }}>
                    <Checkbox
                      checked={row.tickbox}
                      onChange={(event) => {
                        if (!onTickboxChange) {
                          return;
                        }
                        const newValue = event.currentTarget.checked;
                        onTickboxChange(row.id, newValue);
                      }}
                      disabled={!onTickboxChange}
                    />
                  </Table.Td>
                </Table.Tr>
              ))}
            </StandardDataTable>
          );
        })()}
      </StandardTableContainer>
    </Stack>
  );
}
