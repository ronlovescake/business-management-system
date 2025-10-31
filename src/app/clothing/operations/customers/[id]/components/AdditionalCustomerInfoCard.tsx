import { memo, useState, useEffect } from 'react';
import {
  Card,
  Stack,
  Title,
  Group,
  Text,
  TextInput,
  ActionIcon,
  Button,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconMapPin,
  IconPhone,
  IconBrandShopee,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import Swal from 'sweetalert2';

// ============================================================================
// ADDITIONAL CUSTOMER INFO CARD
// ============================================================================

interface AdditionalInfo {
  id: string;
  value: string;
}

interface AdditionalCustomerInfoCardProps {
  customerId: string;
}

export const AdditionalCustomerInfoCard = memo(
  function AdditionalCustomerInfoCard({
    customerId,
  }: AdditionalCustomerInfoCardProps) {
    const [addresses, setAddresses] = useState<AdditionalInfo[]>([]);
    const [phones, setPhones] = useState<AdditionalInfo[]>([]);
    const [shopeeUsernames, setShopeeUsernames] = useState<AdditionalInfo[]>(
      []
    );
    const [loading, setLoading] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // ============================================================================
    // FETCH DATA
    // ============================================================================

    const fetchAdditionalInfo = async () => {
      try {
        const response = await fetch(
          `/api/customers/${customerId}/additional-info`
        );
        if (response.ok) {
          const data = await response.json();
          setAddresses(data.addresses || []);
          setPhones(data.phones || []);
          setShopeeUsernames(data.shopeeUsernames || []);
          setHasChanges(false);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error fetching additional info:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load additional customer information',
          color: 'red',
        });
      }
    };

    useEffect(() => {
      fetchAdditionalInfo();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId]);

    // ============================================================================
    // SAVE DATA
    // ============================================================================

    const handleSave = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/customers/${customerId}/additional-info`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              addresses,
              phones,
              shopeeUsernames,
            }),
          }
        );

        if (response.ok) {
          notifications.show({
            title: 'Success',
            message: 'Additional customer information saved successfully',
            color: 'green',
          });
          setHasChanges(false);
        } else {
          throw new Error('Failed to save');
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error saving additional info:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to save additional customer information',
          color: 'red',
        });
      } finally {
        setLoading(false);
      }
    };

    // ============================================================================
    // HANDLERS
    // ============================================================================

    const addAddress = () => {
      setAddresses([...addresses, { id: Date.now().toString(), value: '' }]);
      setHasChanges(true);
    };

    const removeAddress = async (id: string) => {
      const result = await Swal.fire({
        title: 'Delete Address?',
        text: 'Are you sure you want to delete this address?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel',
      });

      if (result.isConfirmed) {
        setAddresses(addresses.filter((addr) => addr.id !== id));
        setHasChanges(true);
      }
    };

    const updateAddress = (id: string, value: string) => {
      setAddresses(
        addresses.map((addr) => (addr.id === id ? { ...addr, value } : addr))
      );
      setHasChanges(true);
    };

    const addPhone = () => {
      setPhones([...phones, { id: Date.now().toString(), value: '' }]);
      setHasChanges(true);
    };

    const removePhone = async (id: string) => {
      const result = await Swal.fire({
        title: 'Delete Phone Number?',
        text: 'Are you sure you want to delete this phone number?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel',
      });

      if (result.isConfirmed) {
        setPhones(phones.filter((phone) => phone.id !== id));
        setHasChanges(true);
      }
    };

    const updatePhone = (id: string, value: string) => {
      setPhones(
        phones.map((phone) => (phone.id === id ? { ...phone, value } : phone))
      );
      setHasChanges(true);
    };

    const addShopeeUsername = () => {
      setShopeeUsernames([
        ...shopeeUsernames,
        { id: Date.now().toString(), value: '' },
      ]);
      setHasChanges(true);
    };

    const removeShopeeUsername = async (id: string) => {
      const result = await Swal.fire({
        title: 'Delete Shopee Username?',
        text: 'Are you sure you want to delete this Shopee username?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel',
      });

      if (result.isConfirmed) {
        setShopeeUsernames(
          shopeeUsernames.filter((username) => username.id !== id)
        );
        setHasChanges(true);
      }
    };

    const updateShopeeUsername = (id: string, value: string) => {
      setShopeeUsernames(
        shopeeUsernames.map((username) =>
          username.id === id ? { ...username, value } : username
        )
      );
      setHasChanges(true);
    };

    // ============================================================================
    // RENDER
    // ============================================================================

    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Stack gap="md">
          <Group justify="space-between">
            <Title order={4}>Additional Customer Information</Title>
            {hasChanges && (
              <Button size="xs" onClick={handleSave} loading={loading}>
                Save Changes
              </Button>
            )}
          </Group>

          {/* Additional Addresses */}
          <div>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconMapPin size={16} />
                <Text size="sm" fw={500}>
                  Additional Addresses
                </Text>
              </Group>
              <ActionIcon variant="light" size="sm" onClick={addAddress}>
                <IconPlus size={14} />
              </ActionIcon>
            </Group>
            <Stack gap="xs">
              {addresses.length === 0 && (
                <Text size="xs" c="dimmed" fs="italic">
                  No additional addresses added
                </Text>
              )}
              {addresses.map((addr) => (
                <Group key={addr.id} gap="xs">
                  <TextInput
                    flex={1}
                    placeholder="Enter address"
                    value={addr.value}
                    onChange={(e) => updateAddress(addr.id, e.target.value)}
                  />
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => removeAddress(addr.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </div>

          {/* Additional Phone Numbers */}
          <div>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconPhone size={16} />
                <Text size="sm" fw={500}>
                  Additional Phone Numbers
                </Text>
              </Group>
              <ActionIcon variant="light" size="sm" onClick={addPhone}>
                <IconPlus size={14} />
              </ActionIcon>
            </Group>
            <Stack gap="xs">
              {phones.length === 0 && (
                <Text size="xs" c="dimmed" fs="italic">
                  No additional phone numbers added
                </Text>
              )}
              {phones.map((phone) => (
                <Group key={phone.id} gap="xs">
                  <TextInput
                    flex={1}
                    placeholder="Enter phone number"
                    value={phone.value}
                    onChange={(e) => updatePhone(phone.id, e.target.value)}
                  />
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => removePhone(phone.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </div>

          {/* Shopee Usernames */}
          <div>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconBrandShopee size={16} />
                <Text size="sm" fw={500}>
                  Shopee Usernames
                </Text>
              </Group>
              <ActionIcon variant="light" size="sm" onClick={addShopeeUsername}>
                <IconPlus size={14} />
              </ActionIcon>
            </Group>
            <Stack gap="xs">
              {shopeeUsernames.length === 0 && (
                <Text size="xs" c="dimmed" fs="italic">
                  No Shopee usernames added
                </Text>
              )}
              {shopeeUsernames.map((username) => (
                <Group key={username.id} gap="xs">
                  <TextInput
                    flex={1}
                    placeholder="Enter Shopee username"
                    value={username.value}
                    onChange={(e) =>
                      updateShopeeUsername(username.id, e.target.value)
                    }
                  />
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => removeShopeeUsername(username.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </div>
        </Stack>
      </Card>
    );
  }
);
