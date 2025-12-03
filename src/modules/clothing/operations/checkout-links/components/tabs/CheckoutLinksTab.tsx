import {
  Stack,
  Group,
  Text,
  Table,
  Anchor,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import {
  StandardDataTable,
  StandardTableContainer,
  StandardTableControls,
} from '@/components/tables/StandardDataTable';
import { getActionLabel } from '@/lib/accessibility';
import type { CheckoutLinkData } from '../../types';

interface CheckoutLinksTabProps {
  checkoutLinks: CheckoutLinkData[];
  filteredCheckoutLinks: CheckoutLinkData[];
  isLoading: boolean;
  isImporting: boolean;
  pendingDeleteId: string | null;
  onSearch: (query: string) => void;
  onImport: (file: File | null) => void;
  onExport: () => void;
  onAddNew?: () => void;
  onEdit: (row: CheckoutLinkData) => void;
  onDelete: (row: CheckoutLinkData) => Promise<boolean>;
  hasSearch: boolean;
}

export function CheckoutLinksTab({
  checkoutLinks,
  filteredCheckoutLinks,
  isLoading,
  isImporting,
  pendingDeleteId,
  onSearch,
  onImport,
  onExport,
  onAddNew,
  onEdit,
  onDelete,
  hasSearch,
}: CheckoutLinksTabProps) {
  const emptyState = isLoading
    ? 'Loading checkout links...'
    : filteredCheckoutLinks.length === 0 && hasSearch
      ? 'No checkout links match your search.'
      : undefined;

  return (
    <Stack gap="md">
      <StandardTableControls
        searchPlaceholder="Search checkout links..."
        onSearch={onSearch}
        onImport={onImport}
        onExport={onExport}
        onAddNew={onAddNew}
        isImporting={isImporting}
      />

      <StandardTableContainer
        summary={
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Showing {filteredCheckoutLinks.length} of {checkoutLinks.length}{' '}
              checkout links
            </Text>
          </Group>
        }
      >
        <StandardDataTable
          headers={[
            'WEIGHT',
            'WIDTH',
            'LENGTH',
            'HEIGHT',
            'CHECKOUT LINKS',
            'PRODUCT PORTALS',
            'PRODUCT NAMES',
            'ACTION',
          ]}
          emptyState={
            emptyState ||
            "No checkout links found. Click 'Import' to upload a CSV file or 'Add New' to get started."
          }
          colSpan={8}
        >
          {filteredCheckoutLinks.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm" c="#495057">
                  {row.weight}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm" c="#495057">
                  {row.width}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm" c="#495057">
                  {row.length}
                </Text>
              </Table.Td>
              <Table.Td style={{ textAlign: 'center' }}>
                <Text size="sm" c="#495057">
                  {row.height}
                </Text>
              </Table.Td>
              <Table.Td>
                {row.checkoutLinks ? (
                  <Anchor
                    href={
                      row.checkoutLinks.startsWith('http')
                        ? row.checkoutLinks
                        : `https://${row.checkoutLinks}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    lineClamp={2}
                  >
                    {row.checkoutLinks}
                  </Anchor>
                ) : (
                  <Text size="sm" c="dimmed">
                    -
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {row.productPortals ? (
                  <Anchor
                    href={
                      row.productPortals.startsWith('http')
                        ? row.productPortals
                        : `https://${row.productPortals}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    lineClamp={2}
                  >
                    {row.productPortals}
                  </Anchor>
                ) : (
                  <Text size="sm" c="dimmed">
                    -
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="#495057" lineClamp={2}>
                  {row.productNames || '-'}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap="xs" justify="center">
                  <Tooltip label="Edit">
                    <ActionIcon
                      color="blue"
                      variant="light"
                      size="sm"
                      onClick={() => onEdit(row)}
                      {...getActionLabel(
                        'Edit',
                        'checkout link',
                        row.productNames || 'Unknown'
                      )}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Delete">
                    <ActionIcon
                      color="red"
                      variant="light"
                      size="sm"
                      onClick={() => {
                        void onDelete(row);
                      }}
                      disabled={pendingDeleteId === row.id}
                      {...getActionLabel(
                        'Delete',
                        'checkout link',
                        row.productNames || 'Unknown'
                      )}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </StandardDataTable>
      </StandardTableContainer>
    </Stack>
  );
}
