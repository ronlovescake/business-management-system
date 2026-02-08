'use client';

import React from 'react';
import {
  Stack,
  Group,
  Text,
  Button,
  TextInput,
  Select,
  SimpleGrid,
  ThemeIcon,
} from '@mantine/core';
import { UniversalModal } from '@/components/modals/UniversalModal';
import {
  IconPlus,
  IconUser,
  IconPhone,
  IconMail,
  IconMapPin,
  IconBuildingStore,
} from '@tabler/icons-react';
import type { CustomerFormData } from '../types/customer.types';
import { CustomerService } from '../services/CustomerService';

interface AddCustomerModalProps {
  isOpen: boolean;
  formData: CustomerFormData;
  onClose: () => void;
  onCustomerNameChange: (value: string) => void;
  onFieldChange: (field: keyof CustomerFormData, value: string) => void;
  onSubmit: () => void;
}

/**
 * Add Customer Modal Component
 * Enhanced modern design with personal and business info sections
 */
export const AddCustomerModal = React.memo(function AddCustomerModal({
  isOpen,
  formData,
  onClose,
  onCustomerNameChange,
  onFieldChange,
  onSubmit,
}: AddCustomerModalProps) {
  const statusOptions = CustomerService.getStatusOptions();

  return (
    <UniversalModal
      opened={isOpen}
      onClose={onClose}
      size="xl"
      title="Add New Customer"
    >
      <Stack gap="lg">
        {/* Personal Information Section */}
        <div>
          <Group mb="md">
            <ThemeIcon size="sm" radius="md" variant="light" color="blue">
              <IconUser size={14} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="blue.7">
              Personal Information
            </Text>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Customer Name"
              placeholder="e.g. Jane Doe"
              withAsterisk
              value={formData.customerName}
              onChange={(e) => onCustomerNameChange(e.currentTarget.value)}
            />

            <TextInput
              label="Phone Number"
              placeholder="e.g. 09171234567"
              leftSection={<IconPhone size={16} />}
              value={formData.phoneNumber}
              onChange={(e) =>
                onFieldChange('phoneNumber', e.currentTarget.value)
              }
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
            <TextInput
              label="Email Address"
              placeholder="name@email.com"
              leftSection={<IconMail size={16} />}
              value={formData.emailAddress}
              onChange={(e) =>
                onFieldChange('emailAddress', e.currentTarget.value)
              }
            />

            <Select
              label="Customer Status"
              placeholder="Select status"
              data={statusOptions.map((opt) => ({
                label: opt.label,
                value: opt.value,
              }))}
              allowDeselect
              clearable
              value={formData.customerStatus || null}
              onChange={(value) => onFieldChange('customerStatus', value ?? '')}
            />
          </SimpleGrid>

          <TextInput
            label="Address"
            placeholder="Street, City, Province"
            mt="md"
            leftSection={<IconMapPin size={16} />}
            value={formData.address}
            onChange={(e) => onFieldChange('address', e.currentTarget.value)}
          />

          <TextInput
            label="Facebook Profile"
            placeholder="https://facebook.com/username"
            mt="md"
            value={formData.facebook}
            onChange={(e) => onFieldChange('facebook', e.currentTarget.value)}
          />
        </div>

        {/* Business Information Section */}
        <div>
          <Group mb="md">
            <ThemeIcon size="sm" radius="md" variant="light" color="green">
              <IconBuildingStore size={14} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="green.7">
              Business Information
            </Text>
            <Text size="xs" c="dimmed">
              (Optional - Auto-filled if customer exists)
            </Text>
          </Group>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Business Name"
              placeholder="e.g. ABC Company Inc."
              value={formData.businessName}
              onChange={(e) =>
                onFieldChange('businessName', e.currentTarget.value)
              }
            />

            <TextInput
              label="Tax Number"
              placeholder="e.g. 123-456-789"
              value={formData.taxNumber}
              onChange={(e) =>
                onFieldChange('taxNumber', e.currentTarget.value)
              }
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
            <TextInput
              label="Business Address"
              placeholder="Business location"
              leftSection={<IconMapPin size={16} />}
              value={formData.businessAddress}
              onChange={(e) =>
                onFieldChange('businessAddress', e.currentTarget.value)
              }
            />

            <TextInput
              label="Business Contact Number"
              placeholder="e.g. 02-123-4567"
              leftSection={<IconPhone size={16} />}
              value={formData.businessContactNumber}
              onChange={(e) =>
                onFieldChange('businessContactNumber', e.currentTarget.value)
              }
            />
          </SimpleGrid>
        </div>

        {/* Action Buttons */}
        <Group justify="flex-end" gap="sm" mt="sm">
          <Button onClick={onClose} variant="default">
            Cancel
          </Button>
          <Button
            disabled={!formData.customerName.trim()}
            leftSection={<IconPlus size={18} />}
            onClick={onSubmit}
          >
            Add Customer
          </Button>
        </Group>
      </Stack>
    </UniversalModal>
  );
});
