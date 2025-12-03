import { Stack, Group, Text, Table, Anchor, Checkbox } from '@mantine/core';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import type { CheckoutLinkData, InvoiceData } from '../../types';

interface InvoicingTabProps {
  invoiceData: InvoiceData[];
  filteredInvoiceData: InvoiceData[];
  checkoutLinks: CheckoutLinkData[];
  onSearch: (query: string) => void;
  onSyncGoogleDrive: () => void;
  isSyncing: boolean;
  onCustomerNameClick: (invoice: InvoiceData) => void;
  hasFacebookLink: (customerName: string) => boolean;
  onTickboxChange: (invoiceId: string, nextValue: boolean) => void;
  calculateFinalWeight: (weight: string) => string;
  findCheckoutLinkByWeight: (
    weight: string,
    data: CheckoutLinkData[]
  ) => string | undefined;
}

export function InvoicingTab({
  invoiceData,
  filteredInvoiceData,
  checkoutLinks,
  onSearch,
  onSyncGoogleDrive,
  isSyncing,
  onCustomerNameClick,
  hasFacebookLink,
  onTickboxChange,
  calculateFinalWeight,
  findCheckoutLinkByWeight,
}: InvoicingTabProps) {
  return (
    <Stack gap="md">
      <StandardTableControls
        searchPlaceholder="Search invoicing records..."
        onSearch={onSearch}
        onImport={() => {
          // TODO: Implement import functionality
        }}
        onExport={() => {
          // TODO: Implement export functionality
        }}
        onAddNew={onSyncGoogleDrive}
        addNewLabel="Retrieve Google Drive Invoices"
        isImporting={isSyncing}
      />

      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {filteredInvoiceData.length} of {invoiceData.length}{' '}
              invoicing records
            </Text>
          </Group>
        }
      >
        <StandardDataTable
          headers={[
            'CUSTOMER NAME',
            'ACTUAL WEIGHT',
            'FINAL WEIGHT',
            'SHOPEE CHECKOUT LINKS',
            'DRIVE FILES',
            'TICKBOX',
          ]}
          emptyState="No invoicing records found. Click 'Add New' to get started."
          colSpan={6}
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
                {hasFacebookLink(row.customerName) && !row.tickbox ? (
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
                  {calculateFinalWeight(row.actualWeight)}
                </Text>
              </Table.Td>
              <Table.Td>
                {(() => {
                  const finalWeight = calculateFinalWeight(row.actualWeight);
                  const checkoutLink = findCheckoutLinkByWeight(
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
              <Table.Td style={{ textAlign: 'center' }}>
                <Checkbox
                  checked={row.tickbox}
                  onChange={(event) => {
                    const newValue = event.currentTarget.checked;
                    onTickboxChange(row.id, newValue);
                  }}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </StandardDataTable>
      </StandardTableContainer>
    </Stack>
  );
}
