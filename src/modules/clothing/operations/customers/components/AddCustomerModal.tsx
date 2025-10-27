'use client';

import React from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  Button,
  TextInput,
  Select,
  SimpleGrid,
  ThemeIcon,
} from '@mantine/core';
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
    <Modal
      opened={isOpen}
      onClose={onClose}
      closeOnClickOutside={false}
      closeOnEscape={false}
      withCloseButton={true}
      size="xl"
      radius="lg"
      shadow="xl"
      centered
      padding="xl"
      styles={{
        header: {
          backgroundColor: 'var(--mantine-color-blue-0)',
          borderRadius: '12px 12px 0 0',
          padding: '24px 32px 16px 32px',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        },
        title: {
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--mantine-color-blue-8)',
        },
        body: {
          padding: '32px',
          backgroundColor: 'var(--mantine-color-gray-0)',
        },
        close: {
          color: 'var(--mantine-color-blue-6)',
          '&:hover': {
            backgroundColor: 'var(--mantine-color-blue-1)',
          },
        },
      }}
      title={
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="light" color="blue">
            <IconPlus size={20} />
          </ThemeIcon>
          <div>
            <Text size="xl" fw={600} c="blue.8">
              Add New Customer
            </Text>
            <Text size="sm" c="dimmed">
              Fill in the customer information below
            </Text>
          </div>
        </Group>
      }
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
              size="md"
              radius="md"
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
                },
              }}
              value={formData.customerName}
              onChange={(e) => onCustomerNameChange(e.currentTarget.value)}
            />

            <TextInput
              label="Phone Number"
              placeholder="e.g. 09171234567"
              size="md"
              radius="md"
              leftSection={<IconPhone size={16} />}
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
                },
              }}
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
              size="md"
              radius="md"
              leftSection={<IconMail size={16} />}
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
                },
              }}
              value={formData.emailAddress}
              onChange={(e) =>
                onFieldChange('emailAddress', e.currentTarget.value)
              }
            />

            <Select
              label="Customer Status"
              placeholder="Select status"
              size="md"
              radius="md"
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
                },
              }}
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
            size="md"
            radius="md"
            mt="md"
            leftSection={<IconMapPin size={16} />}
            styles={{
              label: { fontWeight: 500, marginBottom: 8 },
              input: {
                borderWidth: 2,
                '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
              },
            }}
            value={formData.address}
            onChange={(e) => onFieldChange('address', e.currentTarget.value)}
          />

          <TextInput
            label="Facebook Profile"
            placeholder="https://facebook.com/username"
            size="md"
            radius="md"
            mt="md"
            styles={{
              label: { fontWeight: 500, marginBottom: 8 },
              input: {
                borderWidth: 2,
                '&:focus': { borderColor: 'var(--mantine-color-blue-5)' },
              },
            }}
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
              size="md"
              radius="md"
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-green-5)',
                  },
                },
              }}
              value={formData.businessName}
              onChange={(e) =>
                onFieldChange('businessName', e.currentTarget.value)
              }
            />

            <TextInput
              label="Tax Number"
              placeholder="e.g. 123-456-789"
              size="md"
              radius="md"
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-green-5)',
                  },
                },
              }}
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
              size="md"
              radius="md"
              leftSection={<IconMapPin size={16} />}
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-green-5)',
                  },
                },
              }}
              value={formData.businessAddress}
              onChange={(e) =>
                onFieldChange('businessAddress', e.currentTarget.value)
              }
            />

            <TextInput
              label="Business Contact Number"
              placeholder="e.g. 02-123-4567"
              size="md"
              radius="md"
              leftSection={<IconPhone size={16} />}
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-green-5)',
                  },
                },
              }}
              value={formData.businessContactNumber}
              onChange={(e) =>
                onFieldChange('businessContactNumber', e.currentTarget.value)
              }
            />
          </SimpleGrid>
        </div>

        {/* Action Buttons */}
        <Group
          justify="flex-end"
          mt="xl"
          pt="md"
          style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}
        >
          <Button
            variant="subtle"
            size="md"
            radius="md"
            onClick={onClose}
            styles={{
              root: {
                '&:hover': {
                  backgroundColor: 'var(--mantine-color-gray-1)',
                },
              },
            }}
          >
            Cancel
          </Button>
          <Button
            size="md"
            radius="md"
            gradient={{ from: 'blue', to: 'blue.6', deg: 45 }}
            disabled={!formData.customerName.trim()}
            leftSection={<IconPlus size={18} />}
            styles={{
              root: {
                boxShadow: '0 4px 12px rgba(34, 139, 230, 0.2)',
                '&:hover': {
                  boxShadow: '0 6px 16px rgba(34, 139, 230, 0.3)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.2s ease',
              },
            }}
            onClick={onSubmit}
          >
            Add Customer
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
});
