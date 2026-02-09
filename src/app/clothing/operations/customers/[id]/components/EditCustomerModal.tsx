import { memo } from 'react';
import {
  Stack,
  Group,
  Text,
  ThemeIcon,
  SimpleGrid,
  TextInput,
  Textarea,
  Select,
  Button,
} from '@mantine/core';
import {
  IconEdit,
  IconUser,
  IconPhone,
  IconMail,
  IconBuildingStore,
  IconCheck,
} from '@tabler/icons-react';
import type { CustomerData } from '../types';
import { CustomerService } from '@/modules/clothing/operations/customers';
import { UniversalModal } from '@/components/modals/UniversalModal';

// ============================================================================
// EDIT CUSTOMER MODAL
// ============================================================================

interface EditCustomerModalProps {
  opened: boolean;
  customer: CustomerData | null;
  editForm: Partial<CustomerData>;
  onClose: () => void;
  onSave: () => Promise<void>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<CustomerData>>>;
}

export const EditCustomerModal = memo(function EditCustomerModal({
  opened,
  customer,
  editForm,
  onClose,
  onSave,
  setEditForm,
}: EditCustomerModalProps) {
  const statusOptions = CustomerService.getStatusOptions();

  return (
    <UniversalModal
      opened={opened}
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
          backgroundColor: 'var(--mantine-color-orange-0)',
          borderRadius: '12px 12px 0 0',
          padding: '24px 32px 16px 32px',
          borderBottom: '1px solid var(--mantine-color-gray-2)',
        },
        title: {
          fontSize: '24px',
          fontWeight: 600,
          color: 'var(--mantine-color-orange-8)',
        },
        body: {
          padding: '32px',
          backgroundColor: 'var(--mantine-color-gray-0)',
        },
        close: {
          color: 'var(--mantine-color-orange-6)',
          '&:hover': {
            backgroundColor: 'var(--mantine-color-orange-1)',
          },
        },
      }}
      title={
        <Group gap="sm">
          <ThemeIcon size="lg" radius="md" variant="light" color="orange">
            <IconEdit size={20} />
          </ThemeIcon>
          <div>
            <Text size="xl" fw={600} c="orange.8">
              Edit Customer
            </Text>
            <Text size="sm" c="dimmed">
              Update {customer?.['Customer Name'] || 'customer'} information
            </Text>
          </div>
        </Group>
      }
    >
      <Stack gap="lg">
        {/* Personal Information Section */}
        <div>
          <Group mb="md">
            <ThemeIcon size="sm" radius="md" variant="light" color="orange">
              <IconUser size={14} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="orange.7">
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
                  '&:focus': {
                    borderColor: 'var(--mantine-color-orange-5)',
                  },
                },
              }}
              value={editForm['Customer Name'] || ''}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  'Customer Name': e.target.value,
                }))
              }
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
                  '&:focus': {
                    borderColor: 'var(--mantine-color-orange-5)',
                  },
                },
              }}
              value={editForm['Phone Number'] || ''}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  'Phone Number': e.target.value,
                }))
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
                  '&:focus': {
                    borderColor: 'var(--mantine-color-orange-5)',
                  },
                },
              }}
              value={editForm['Email Address'] || ''}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  'Email Address': e.target.value,
                }))
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
                  '&:focus': {
                    borderColor: 'var(--mantine-color-orange-5)',
                  },
                },
              }}
              data={statusOptions.map((option) => ({
                label: option.label,
                value: option.value,
              }))}
              allowDeselect
              clearable
              value={editForm['Customer Status'] || ''}
              onChange={(value) =>
                setEditForm((prev) => ({
                  ...prev,
                  'Customer Status': value || '',
                }))
              }
            />
          </SimpleGrid>

          <Textarea
            label="Address"
            placeholder="Street, City, Province"
            size="md"
            radius="md"
            mt="md"
            minRows={2}
            styles={{
              label: { fontWeight: 500, marginBottom: 8 },
              input: {
                borderWidth: 2,
                '&:focus': { borderColor: 'var(--mantine-color-orange-5)' },
              },
            }}
            value={editForm.Address || ''}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, Address: e.target.value }))
            }
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
                '&:focus': { borderColor: 'var(--mantine-color-orange-5)' },
              },
            }}
            value={editForm.Facebook || ''}
            onChange={(e) =>
              setEditForm((prev) => ({ ...prev, Facebook: e.target.value }))
            }
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
              value={editForm['Business Name'] || ''}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  'Business Name': e.target.value,
                }))
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
              value={editForm['Tax Number'] || ''}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  'Tax Number': e.target.value,
                }))
              }
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
            <Textarea
              label="Business Address"
              placeholder="Business location"
              size="md"
              radius="md"
              minRows={2}
              styles={{
                label: { fontWeight: 500, marginBottom: 8 },
                input: {
                  borderWidth: 2,
                  '&:focus': {
                    borderColor: 'var(--mantine-color-green-5)',
                  },
                },
              }}
              value={editForm['Business Address'] || ''}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  'Business Address': e.target.value,
                }))
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
              value={editForm['Business Contact Number'] || ''}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  'Business Contact Number': e.target.value,
                }))
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
            gradient={{ from: 'orange', to: 'orange.6', deg: 45 }}
            disabled={!editForm['Customer Name']?.trim()}
            leftSection={<IconCheck size={18} />}
            styles={{
              root: {
                boxShadow: '0 4px 12px rgba(253, 126, 20, 0.2)',
                '&:hover': {
                  boxShadow: '0 6px 16px rgba(253, 126, 20, 0.3)',
                  transform: 'translateY(-1px)',
                },
                transition: 'all 0.2s ease',
              },
            }}
            onClick={onSave}
          >
            Save Changes
          </Button>
        </Group>
      </Stack>
    </UniversalModal>
  );
});
