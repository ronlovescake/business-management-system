'use client';

import { memo, useMemo } from 'react';
import {
  Stack,
  Text,
  Group,
  Table,
  ActionIcon,
  Tooltip,
  Badge,
  Checkbox,
  Radio,
} from '@mantine/core';
import { IconMessageCircle } from '@tabler/icons-react';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import type { DispatchItem, RawOrderData } from '../types';

interface MatchingTabProps {
  filteredData: DispatchItem[];
  effectiveRawData: RawOrderData[];
  mockData: unknown[];
  savedOrders: RawOrderData[] | undefined;
  rawData: RawOrderData[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleXlsxImport: (file: File | null) => Promise<void>;
  handleExportCSV: () => void;
  handleAddNew: () => void;
  isImportingRawData: boolean;
  lookupCustomerName: (username: string) => string;
  lookupFacebookLink: (username: string) => string | undefined;
  loadingCustomers: boolean;
  loadingSavedOrders: boolean;
  completedOrders: Record<string, boolean>;
  updateOrderCompletion: (orderId: string, completed: boolean) => void;
  actionLinksEnabled: boolean;
  toggleActionLinks: () => void;
  hoveredCustomerId: string | null;
  setHoveredCustomerId: (id: string | null) => void;
  navigateToPossibleMatchTab: () => void;
  handleCustomerNameClick: (
    item: DispatchItem,
    facebookLink: string | undefined
  ) => Promise<void>;
  copyToClipboard: (text: string, label: string) => Promise<void>;
  getMatchesForOrder: (orderId: string) => Array<{
    customer: {
      id: number;
      customerName: string;
      businessName: string;
    };
    similarityScore: number;
  }>;
}

function MatchingTabComponent({
  filteredData,
  effectiveRawData,
  mockData,
  savedOrders,
  rawData,
  searchQuery,
  setSearchQuery,
  handleXlsxImport,
  handleExportCSV,
  handleAddNew,
  isImportingRawData,
  lookupCustomerName,
  lookupFacebookLink,
  loadingCustomers,
  loadingSavedOrders,
  completedOrders,
  updateOrderCompletion,
  actionLinksEnabled,
  toggleActionLinks,
  hoveredCustomerId,
  setHoveredCustomerId,
  navigateToPossibleMatchTab,
  handleCustomerNameClick,
  copyToClipboard,
  getMatchesForOrder,
}: MatchingTabProps) {
  const headers = useMemo(
    () => [
      'ORDER STATUS',
      'SHIPPING OPTIONS',
      'USERNAME (BUYER)',
      'CUSTOMER NAMES',
      'CUSTOMER MESSAGE',
      {
        key: 'action-toggle',
        content: (
          <Tooltip
            label={
              actionLinksEnabled
                ? 'Click to disable Facebook links'
                : 'Click to enable Facebook links'
            }
          >
            <Radio
              checked={actionLinksEnabled}
              onChange={() => {
                /* Controlled via onClick */
              }}
              onClick={(event) => {
                event.preventDefault();
                toggleActionLinks();
              }}
              aria-label={
                actionLinksEnabled
                  ? 'Disable Facebook links'
                  : 'Enable Facebook links'
              }
            />
          </Tooltip>
        ),
      },
      'DONE',
    ],
    [actionLinksEnabled, toggleActionLinks]
  );

  return (
    <Stack gap="md">
      {/* Table Controls */}
      <StandardTableControls
        searchPlaceholder="Search dispatch orders..."
        onSearch={setSearchQuery}
        onImport={handleXlsxImport}
        onExport={handleExportCSV}
        onAddNew={handleAddNew}
        isImporting={isImportingRawData}
        acceptFileTypes=".xlsx,.xls"
      />

      {/* Table Container */}
      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {filteredData.length} of{' '}
              {effectiveRawData.length > 0
                ? effectiveRawData.length
                : mockData.length}{' '}
              dispatch orders
              {savedOrders && savedOrders.length > 0 && (
                <Text component="span" c="blue" fw={500} ml="xs">
                  (From Database)
                </Text>
              )}
              {rawData.length > 0 &&
                (!savedOrders || savedOrders.length === 0) && (
                  <Text component="span" c="orange" fw={500} ml="xs">
                    (Imported - Not Saved Yet)
                  </Text>
                )}
              {loadingCustomers && (
                <Text component="span" c="grape" fw={500} ml="xs">
                  (Loading customer data...)
                </Text>
              )}
              {loadingSavedOrders && (
                <Text component="span" c="teal" fw={500} ml="xs">
                  (Loading saved orders...)
                </Text>
              )}
            </Text>
          </Group>
        }
      >
        <StandardDataTable
          headers={headers}
          emptyState={
            searchQuery
              ? `No orders found matching "${searchQuery}"`
              : rawData.length > 0
                ? 'No imported orders to display.'
                : 'No dispatch orders available. Import XLSX file from Raw Data tab or click "Add New" to create one.'
          }
          colSpan={headers.length}
        >
          {filteredData.map((item) => {
            const isNotJT = item.shippingOptions !== 'J&T';
            const facebookLink = lookupFacebookLink(item.username);
            const isCompleted = !!completedOrders[item.id];
            const possibleMatches = getMatchesForOrder(item.id) || [];
            const suggestedMatch = possibleMatches[0];
            const suggestedDisplayName = suggestedMatch
              ? suggestedMatch.customer.businessName
                ? `${suggestedMatch.customer.customerName} | ${suggestedMatch.customer.businessName}`
                : suggestedMatch.customer.customerName
              : null;
            const normalizedFacebookLink = facebookLink
              ? facebookLink.startsWith('http')
                ? facebookLink
                : `https://${facebookLink}`
              : undefined;
            const canOpenFacebook =
              !!facebookLink && actionLinksEnabled && !isCompleted;
            const nameCursor = facebookLink
              ? canOpenFacebook
                ? 'pointer'
                : 'default'
              : 'copy';
            const isHovered = hoveredCustomerId === item.id;
            const actionTooltipLabel = !actionLinksEnabled
              ? 'Facebook links disabled'
              : isCompleted
                ? 'Already contacted'
                : facebookLink
                  ? 'Message customer'
                  : 'No Facebook link available';

            return (
              <Table.Tr
                key={item.id}
                style={{
                  backgroundColor: isNotJT
                    ? 'rgba(255, 107, 107, 0.1)'
                    : undefined,
                  opacity: isCompleted ? 0.5 : 1,
                }}
              >
                <Table.Td style={{ textAlign: 'center' }}>
                  <Text
                    c={
                      item.orderStatus === 'Shipped'
                        ? 'green'
                        : item.orderStatus === 'Processing'
                          ? 'blue'
                          : 'orange'
                    }
                    fw={500}
                  >
                    {item.orderStatus}
                  </Text>
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  {item.shippingOptions}
                </Table.Td>
                <Table.Td style={{ textAlign: 'left' }}>
                  {item.username}
                </Table.Td>
                <Table.Td style={{ textAlign: 'left' }}>
                  {item.customerNames ? (
                    <Group gap="xs">
                      {facebookLink ? (
                        <Tooltip
                          label="Click to copy customer name and open Facebook Messenger"
                          disabled={!canOpenFacebook}
                        >
                          <Text
                            onClick={() => {
                              void copyToClipboard(
                                item.customerNames,
                                'Customer name'
                              );

                              if (canOpenFacebook) {
                                void handleCustomerNameClick(
                                  item,
                                  facebookLink
                                );
                              }
                            }}
                            onMouseEnter={() => setHoveredCustomerId(item.id)}
                            onMouseLeave={() => setHoveredCustomerId(null)}
                            style={{
                              cursor: nameCursor,
                              textDecoration:
                                canOpenFacebook && isHovered
                                  ? 'underline'
                                  : 'none',
                              color: '#1c7ed6',
                            }}
                          >
                            {item.customerNames}
                          </Text>
                        </Tooltip>
                      ) : (
                        <Text
                          onClick={() =>
                            copyToClipboard(item.customerNames, 'Customer name')
                          }
                          style={{ cursor: 'copy' }}
                        >
                          {item.customerNames}
                        </Text>
                      )}
                      {lookupCustomerName(item.username) ? (
                        <Badge size="xs" color="green" variant="light">
                          Matched
                        </Badge>
                      ) : (
                        <Badge
                          size="xs"
                          color="orange"
                          variant="light"
                          onClick={navigateToPossibleMatchTab}
                          style={{ cursor: 'pointer' }}
                          aria-label="View possible matches"
                        >
                          Possible Match
                        </Badge>
                      )}
                    </Group>
                  ) : (
                    <Stack gap={4}>
                      {suggestedDisplayName ? (
                        <>
                          <Text size="sm" c="blue" fw={600}>
                            Suggested: {suggestedDisplayName}
                          </Text>
                          <Group gap="xs">
                            <Badge size="xs" color="blue" variant="light">
                              {suggestedMatch?.similarityScore ?? 0}% match
                            </Badge>
                            <Badge
                              size="xs"
                              color="orange"
                              variant="light"
                              onClick={navigateToPossibleMatchTab}
                              style={{ cursor: 'pointer' }}
                              aria-label="View suggested matches"
                            >
                              View {possibleMatches.length} matches
                            </Badge>
                          </Group>
                        </>
                      ) : (
                        <Group gap="xs">
                          <Text c="dimmed" fs="italic">
                            No customer found
                          </Text>
                          <Badge size="xs" color="yellow" variant="light">
                            No Match
                          </Badge>
                        </Group>
                      )}
                    </Stack>
                  )}
                </Table.Td>
                <Table.Td style={{ textAlign: 'left' }}>
                  {item.messageCustomer}
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  <Group gap="xs" justify="center">
                    <Tooltip label={actionTooltipLabel}>
                      <ActionIcon
                        variant="light"
                        color="blue"
                        component="button"
                        type="button"
                        aria-label="Message customer"
                        disabled={!canOpenFacebook}
                        onClick={() => {
                          if (!canOpenFacebook || !normalizedFacebookLink) {
                            return;
                          }
                          window.open(
                            normalizedFacebookLink,
                            '_blank',
                            'noopener,noreferrer'
                          );
                        }}
                        style={{
                          cursor: !canOpenFacebook ? 'not-allowed' : 'pointer',
                          opacity: !canOpenFacebook ? 0.5 : 1,
                        }}
                      >
                        <IconMessageCircle size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>
                  <Checkbox
                    checked={isCompleted}
                    onChange={(event) =>
                      updateOrderCompletion(
                        item.id,
                        event.currentTarget.checked
                      )
                    }
                    aria-label="Mark order handled"
                  />
                </Table.Td>
              </Table.Tr>
            );
          })}
        </StandardDataTable>
      </StandardTableContainer>
    </Stack>
  );
}

export const MatchingTab = memo(MatchingTabComponent);
MatchingTab.displayName = 'MatchingTab';
