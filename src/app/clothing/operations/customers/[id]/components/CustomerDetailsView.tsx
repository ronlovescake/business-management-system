'use client';

import { memo } from 'react';
import {
  Stack,
  Group,
  ActionIcon,
  Title,
  Text,
  Badge,
  Button,
  SimpleGrid,
  LoadingOverlay,
  Alert,
} from '@mantine/core';
import { IconArrowLeft, IconEdit, IconAlertCircle } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCustomerDetails } from '../hooks/useCustomerDetails';
import { CustomerStatsCards } from './CustomerStatsCards';
import { CustomerAnalytics } from './CustomerAnalytics';
import { CustomerInfoCard } from './CustomerInfoCard';
import { AdditionalCustomerInfoCard } from './AdditionalCustomerInfoCard';
import { OrdersAndTransactions } from './OrdersAndTransactions';
import { EditCustomerModal } from './EditCustomerModal';
import { getIconButtonLabel } from '@/lib/accessibility';

// ============================================================================
// CUSTOMER DETAILS VIEW
// ============================================================================

interface CustomerDetailsViewProps {
  customerId: string;
  apiBasePath?: string;
}

export const CustomerDetailsView = memo(function CustomerDetailsView({
  customerId,
  apiBasePath,
}: CustomerDetailsViewProps) {
  const router = useRouter();
  const {
    customer,
    orders,
    transactions,
    stats,
    loading,
    editModalOpen,
    editForm,
    setEditModalOpen,
    setEditForm,
    handleUpdateCustomer,
  } = useCustomerDetails(customerId, apiBasePath);

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return <LoadingOverlay visible />;
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================

  if (!customer) {
    return (
      <Stack gap="md">
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Customer Not Found"
          color="red"
        >
          The customer you&apos;re looking for doesn&apos;t exist or has been
          deleted.
        </Alert>
        <Button
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.back()}
        >
          Go Back
        </Button>
      </Stack>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between">
        <Group>
          <ActionIcon
            variant="light"
            onClick={() => router.back()}
            size="lg"
            {...getIconButtonLabel('Go back to customers list')}
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <div>
            <Group gap="sm">
              <Title order={2}>{customer['Customer Name']}</Title>
              {customer['Customer Status'] && (
                <Badge
                  color={
                    customer['Customer Status'] === 'Active' ? 'green' : 'gray'
                  }
                  size="lg"
                >
                  {customer['Customer Status']}
                </Badge>
              )}
            </Group>
            <Text size="sm" c="dimmed">
              Customer since {customer.Date}
            </Text>
          </div>
        </Group>
        <Group>
          <Button
            leftSection={<IconEdit size={16} />}
            variant="light"
            onClick={() => setEditModalOpen(true)}
          >
            Edit Customer
          </Button>
        </Group>
      </Group>

      {/* Stats Cards */}
      <CustomerStatsCards stats={stats} />

      {/* Customer Analytics */}
      <CustomerAnalytics stats={stats} />

      {/* Customer Details and Orders/Transactions */}
      <SimpleGrid cols={{ base: 1, lg: 3 }} spacing="lg">
        {/* Customer Info */}
        <Stack gap="lg">
          <CustomerInfoCard customer={customer} />
          <AdditionalCustomerInfoCard
            customerId={customerId}
            apiBasePath={apiBasePath}
          />
        </Stack>

        {/* Orders and Transactions */}
        <OrdersAndTransactions
          customerId={customerId}
          orders={orders}
          transactions={transactions}
          stats={stats}
          apiBasePath={apiBasePath}
        />
      </SimpleGrid>

      {/* Edit Customer Modal */}
      <EditCustomerModal
        opened={editModalOpen}
        customer={customer}
        editForm={editForm}
        onClose={() => setEditModalOpen(false)}
        onSave={handleUpdateCustomer}
        setEditForm={setEditForm}
      />
    </Stack>
  );
});
