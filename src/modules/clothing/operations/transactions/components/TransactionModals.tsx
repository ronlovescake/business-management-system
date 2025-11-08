/**
 * Transaction Modals Component
 *
 * All confirmation and warning modals for transactions:
 * - Invoice Generation Confirmation Modal
 * - Packing List Generation Confirmation Modal
 * - Distribution Generation Confirmation Modal
 * - Customer Warning Modal
 */

import React from 'react';
import {
  Modal,
  Button,
  Text,
  Group,
  Stack,
  Alert,
  Divider,
} from '@mantine/core';
import {
  IconReceipt,
  IconCurrencyPeso,
  IconPackage,
  IconTruck,
  IconShoppingCart,
  IconCheck,
  IconAlertTriangle,
  IconUsers,
  IconClipboardList,
  IconX,
} from '@tabler/icons-react';
import type {
  InvoiceConfirmationData,
  PackingListConfirmationData,
  DistributionConfirmationData,
  CustomerWarningData,
} from '../types/transaction.types';

// ============================================================================
// INVOICE GENERATION CONFIRMATION MODAL
// ============================================================================

interface InvoiceModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: InvoiceConfirmationData;
  isGenerating: boolean;
}

export const InvoiceGenerationModal = React.memo(
  function InvoiceGenerationModal({
    opened,
    onClose,
    onConfirm,
    data,
    isGenerating,
  }: InvoiceModalProps) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="sm">
            <IconReceipt size={24} color="#228be6" />
            <Text size="lg" fw={600}>
              Invoice Generation Confirmation
            </Text>
          </Group>
        }
        size="lg"
        centered
        overlayProps={{ blur: 10 }}
        styles={{
          content: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          },
          header: {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          },
          body: {
            backgroundColor: 'transparent',
          },
        }}
      >
        <Stack gap="lg">
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Important Changes Will Occur"
            color="orange"
            variant="light"
          >
            <Text size="sm">
              This action will modify your data and cannot be undone. Please
              review the details below.
            </Text>
          </Alert>

          <div>
            <Text size="md" fw={500} mb="md">
              You are about to generate invoices for:
            </Text>

            <Stack gap="xs">
              <Group gap="sm">
                <IconUsers size={18} color="#228be6" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {data.customers}
                  </Text>{' '}
                  customers
                </Text>
              </Group>

              <Group gap="sm">
                <IconPackage size={18} color="#fd7e14" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {data.warehouseOrders}
                  </Text>{' '}
                  Warehouse orders
                </Text>
              </Group>

              <Group gap="sm">
                <IconCheck size={18} color="#51cf66" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {data.preparedOrders}
                  </Text>{' '}
                  Prepared orders
                </Text>
              </Group>

              <Group gap="sm">
                <IconClipboardList size={18} color="#7950f2" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {data.totalTransactions}
                  </Text>{' '}
                  total transactions
                </Text>
              </Group>
            </Stack>
          </div>

          <Divider />

          <div>
            <Text size="md" fw={500} mb="md">
              Important Changes That Will Occur:
            </Text>

            <Stack gap="xs">
              <Text size="sm">
                • All{' '}
                <Text component="span" fw={600}>
                  {data.warehouseOrders}
                </Text>{' '}
                Warehouse orders will be updated to &ldquo;Prepared&rdquo;
                status
              </Text>
              <Text size="sm">
                • Invoice dates will be set for all processed transactions
              </Text>
              <Text size="sm">
                • A PDF invoice will be generated and downloaded
              </Text>
              <Text size="sm">• All changes will be saved to the database</Text>
            </Stack>
          </div>

          <Divider />

          <Text size="sm" c="dimmed" ta="center">
            Do you want to proceed with invoice generation?
          </Text>

          <Group justify="center" gap="md" mt="md">
            <Button
              variant="outline"
              leftSection={<IconX size={16} />}
              onClick={onClose}
              color="gray"
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={onConfirm}
              color="blue"
              loading={isGenerating}
            >
              Generate Invoices
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }
);

// ============================================================================
// PACKING LIST GENERATION CONFIRMATION MODAL
// ============================================================================

interface PackingListModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: PackingListConfirmationData;
  isGenerating: boolean;
}

export const PackingListGenerationModal = React.memo(
  function PackingListGenerationModal({
    opened,
    onClose,
    onConfirm,
    data,
    isGenerating,
  }: PackingListModalProps) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="sm">
            <IconClipboardList size={24} color="#7950f2" />
            <Text size="lg" fw={600}>
              Packing List Generation Confirmation
            </Text>
          </Group>
        }
        size="lg"
        centered
        overlayProps={{ blur: 10 }}
        styles={{
          content: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          },
          header: {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          },
          body: {
            backgroundColor: 'transparent',
          },
        }}
      >
        <Stack gap="lg">
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Packing List Generation"
            color="violet"
            variant="light"
          >
            <Text size="sm">
              This will generate packing lists for all eligible
              &ldquo;Prepared&rdquo; orders with line total ≤ ₱50.00.
            </Text>
          </Alert>

          <div>
            <Text size="md" fw={500} mb="md">
              You are about to generate packing lists for:
            </Text>

            <Stack gap="xs">
              <Group gap="sm">
                <IconClipboardList size={18} color="#7950f2" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {data.eligibleTransactions}
                  </Text>{' '}
                  eligible transactions
                </Text>
              </Group>

              <Group gap="sm">
                <IconUsers size={18} color="#228be6" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {data.customers}
                  </Text>{' '}
                  customers
                </Text>
              </Group>

              <Group gap="sm">
                <IconCurrencyPeso size={18} color="#51cf66" />
                <Text size="sm">
                  Total value:{' '}
                  <Text component="span" fw={600}>
                    ₱{data.totalValue.toLocaleString()}
                  </Text>
                </Text>
              </Group>
            </Stack>
          </div>

          <Divider />

          <div>
            <Text size="md" fw={500} mb="md">
              Eligibility Criteria:
            </Text>

            <Stack gap="xs">
              <Text size="sm">
                • Only transactions with &ldquo;Prepared&rdquo; status
              </Text>
              <Text size="sm">• Line total must be ≤ ₱50.00</Text>
              <Text size="sm">
                • PDF packing lists will be generated and downloaded
              </Text>
            </Stack>
          </div>

          <Divider />

          <Text size="sm" c="dimmed" ta="center">
            Do you want to proceed with packing list generation?
          </Text>

          <Group justify="center" gap="md" mt="md">
            <Button
              variant="outline"
              leftSection={<IconX size={16} />}
              onClick={onClose}
              color="gray"
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconClipboardList size={16} />}
              onClick={onConfirm}
              color="violet"
              loading={isGenerating}
            >
              Generate Packing Lists
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }
);

// ============================================================================
// DISTRIBUTION GENERATION CONFIRMATION MODAL
// ============================================================================

interface DistributionModalProps {
  opened: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: DistributionConfirmationData;
  isGenerating: boolean;
}

export const DistributionGenerationModal = React.memo(
  function DistributionGenerationModal({
    opened,
    onClose,
    onConfirm,
    data,
    isGenerating,
  }: DistributionModalProps) {
    return (
      <Modal
        opened={opened}
        onClose={onClose}
        title={
          <Group gap="sm">
            <IconTruck size={24} color="#fd7e14" />
            <Text size="lg" fw={600}>
              Distribution Slip Generation Confirmation
            </Text>
          </Group>
        }
        size="lg"
        centered
        overlayProps={{ blur: 10 }}
        styles={{
          content: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          },
          header: {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          },
          body: {
            backgroundColor: 'transparent',
          },
        }}
      >
        <Stack gap="lg">
          <Alert
            icon={<IconAlertTriangle size={16} />}
            title="Distribution Slip Generation"
            color="orange"
            variant="light"
          >
            <Text size="sm">
              This will generate distribution slips for all
              &ldquo;Warehouse&rdquo; and &ldquo;Prepared&rdquo; status orders,
              sorted by quantity ascending.
            </Text>
          </Alert>

          <div>
            <Text size="md" fw={500} mb="md">
              You are about to generate distribution slips for:
            </Text>

            <Stack gap="xs">
              <Group gap="sm">
                <IconPackage size={18} color="#fd7e14" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {data.warehouseTransactions}
                  </Text>{' '}
                  Warehouse/Prepared transactions
                </Text>
              </Group>

              <Group gap="sm">
                <IconUsers size={18} color="#228be6" />
                <Text size="sm">
                  <Text component="span" fw={600}>
                    {data.customers}
                  </Text>{' '}
                  customers
                </Text>
              </Group>

              <Group gap="sm">
                <IconShoppingCart size={18} color="#7950f2" />
                <Text size="sm">
                  Total quantity:{' '}
                  <Text component="span" fw={600}>
                    {data.totalQuantity.toLocaleString()}
                  </Text>{' '}
                  items
                </Text>
              </Group>

              <Group gap="sm">
                <IconCurrencyPeso size={18} color="#51cf66" />
                <Text size="sm">
                  Total value:{' '}
                  <Text component="span" fw={600}>
                    ₱{data.totalValue.toLocaleString()}
                  </Text>
                </Text>
              </Group>
            </Stack>
          </div>

          <Divider />

          <div>
            <Text size="md" fw={500} mb="md">
              Distribution Features:
            </Text>

            <Stack gap="xs">
              <Text size="sm">
                • Only transactions with &ldquo;Warehouse&rdquo; or
                &ldquo;Prepared&rdquo; status
              </Text>
              <Text size="sm">
                • Distribution slips sorted by quantity (ascending)
              </Text>
              <Text size="sm">
                • PDF distribution slips will be generated and downloaded
              </Text>
              <Text size="sm">
                • Optimized for warehouse picking operations
              </Text>
            </Stack>
          </div>

          <Divider />

          <Text size="sm" c="dimmed" ta="center">
            Do you want to proceed with distribution slip generation?
          </Text>

          <Group justify="center" gap="md" mt="md">
            <Button
              variant="outline"
              leftSection={<IconX size={16} />}
              onClick={onClose}
              color="gray"
            >
              Cancel
            </Button>
            <Button
              leftSection={<IconTruck size={16} />}
              onClick={onConfirm}
              color="orange"
              loading={isGenerating}
            >
              Generate Distribution Slips
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }
);

// ============================================================================
// CUSTOMER WARNING MODAL
// ============================================================================

interface CustomerWarningModalProps {
  opened: boolean;
  onClose: () => void;
  data: CustomerWarningData | null;
}

export const CustomerWarningModal = React.memo(function CustomerWarningModal({
  opened,
  onClose,
  data,
}: CustomerWarningModalProps) {
  if (!data) {
    return null;
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <IconAlertTriangle size={24} color="#fa5252" />
          <Text size="lg" fw={600} c="red">
            Customer Warning
          </Text>
        </Group>
      }
      centered
      size="md"
      radius="md"
      withCloseButton={false}
      overlayProps={{ blur: 10 }}
      styles={{
        content: {
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.3)',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        },
        header: {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
        },
        body: {
          backgroundColor: 'transparent',
        },
      }}
    >
      <Stack gap="lg">
        <Alert
          icon={<IconAlertTriangle size={16} />}
          title="Important Notice"
          color="red"
          variant="light"
        >
          <Text size="sm">
            This customer has been flagged with critical issues. Please review
            the details below before proceeding.
          </Text>
        </Alert>

        <div>
          <Text size="md" fw={500} mb="md">
            Customer:{' '}
            <Text component="span" fw={700} c="dark">
              {data.customerName}
            </Text>
          </Text>

          <Stack gap="sm">
            {data.warnings.map((warning) => {
              const isBanned = warning.includes('BANNED CUSTOMER');
              const isCancellation = warning.includes('HIGH CANCELLATION RATE');

              return (
                <Group key={warning} gap="sm" align="flex-start">
                  {isBanned ? (
                    <IconX size={18} color="#fa5252" style={{ marginTop: 2 }} />
                  ) : isCancellation ? (
                    <IconAlertTriangle
                      size={18}
                      color="#fd7e14"
                      style={{ marginTop: 2 }}
                    />
                  ) : (
                    <IconAlertTriangle
                      size={18}
                      color="#228be6"
                      style={{ marginTop: 2 }}
                    />
                  )}
                  <Text
                    size="sm"
                    style={{ flex: 1 }}
                    c={isBanned ? 'red' : isCancellation ? 'orange' : 'dark'}
                  >
                    {warning.replace(/^🚫|^⚠️/, '').trim()}
                  </Text>
                </Group>
              );
            })}
          </Stack>
        </div>

        <Divider />

        <Text size="sm" c="dimmed" ta="center">
          Would you like to proceed with this customer despite the warnings?
        </Text>

        <Group justify="center" gap="md" mt="md">
          <Button
            variant="outline"
            leftSection={<IconX size={16} />}
            onClick={data.onCancel}
            color="gray"
          >
            Cancel Selection
          </Button>
          <Button
            leftSection={<IconCheck size={16} />}
            onClick={data.onProceed}
            color="red"
          >
            Proceed Anyway
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
});
