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
  IconUser,
  IconBrandFacebook,
} from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import Swal from 'sweetalert2';
import { logger } from '@/lib/logger';

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
    const [alternateNames, setAlternateNames] = useState<AdditionalInfo[]>([]);
    const [facebookAccounts, setFacebookAccounts] = useState<AdditionalInfo[]>(
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
          setAlternateNames(data.alternateNames || []);
          setFacebookAccounts(data.facebookAccounts || []);
          setHasChanges(false);
        }
      } catch (error) {
        logger.error('Error fetching additional info:', error);
        showNotification({
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
              alternateNames,
              facebookAccounts,
            }),
          }
        );

        if (response.ok) {
          showNotification({
            title: 'Success',
            message: 'Additional customer information saved successfully',
            color: 'green',
          });
          setHasChanges(false);
        } else {
          throw new Error('Failed to save');
        }
      } catch (error) {
        logger.error('Error saving additional info:', error);
        showNotification({
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
      if (addresses.length >= 5) {
        showNotification({
          title: 'Limit Reached',
          message: 'Maximum of 5 additional addresses allowed',
          color: 'orange',
        });
        return;
      }
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
        allowOutsideClick: false,
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
      if (phones.length >= 5) {
        showNotification({
          title: 'Limit Reached',
          message: 'Maximum of 5 additional phone numbers allowed',
          color: 'orange',
        });
        return;
      }
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
        allowOutsideClick: false,
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
      if (shopeeUsernames.length >= 5) {
        showNotification({
          title: 'Limit Reached',
          message: 'Maximum of 5 Shopee usernames allowed',
          color: 'orange',
        });
        return;
      }
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
        allowOutsideClick: false,
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

    const addAlternateName = () => {
      if (alternateNames.length >= 5) {
        showNotification({
          title: 'Limit Reached',
          message: 'Maximum of 5 alternate customer names allowed',
          color: 'orange',
        });
        return;
      }
      setAlternateNames([
        ...alternateNames,
        { id: Date.now().toString(), value: '' },
      ]);
      setHasChanges(true);
    };

    const removeAlternateName = async (id: string) => {
      const result = await Swal.fire({
        title: 'Delete Alternate Name?',
        text: 'Are you sure you want to delete this alternate name?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel',
        allowOutsideClick: false,
      });

      if (result.isConfirmed) {
        setAlternateNames(alternateNames.filter((name) => name.id !== id));
        setHasChanges(true);
      }
    };

    const updateAlternateName = (id: string, value: string) => {
      setAlternateNames(
        alternateNames.map((name) =>
          name.id === id ? { ...name, value } : name
        )
      );
      setHasChanges(true);
    };

    const addFacebookAccount = () => {
      if (facebookAccounts.length >= 5) {
        showNotification({
          title: 'Limit Reached',
          message: 'Maximum of 5 Facebook accounts allowed',
          color: 'orange',
        });
        return;
      }
      setFacebookAccounts([
        ...facebookAccounts,
        { id: Date.now().toString(), value: '' },
      ]);
      setHasChanges(true);
    };

    const removeFacebookAccount = async (id: string) => {
      const result = await Swal.fire({
        title: 'Delete Facebook Account?',
        text: 'Are you sure you want to delete this Facebook account?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel',
        allowOutsideClick: false,
      });

      if (result.isConfirmed) {
        setFacebookAccounts(
          facebookAccounts.filter((account) => account.id !== id)
        );
        setHasChanges(true);
      }
    };

    const updateFacebookAccount = (id: string, value: string) => {
      setFacebookAccounts(
        facebookAccounts.map((account) =>
          account.id === id ? { ...account, value } : account
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

          {/* Alternate Customer Names */}
          <div>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconUser size={16} />
                <Text size="sm" fw={500}>
                  Alternate Customer Names
                </Text>
              </Group>
              <ActionIcon variant="light" size="sm" onClick={addAlternateName}>
                <IconPlus size={14} />
              </ActionIcon>
            </Group>
            <Stack gap="xs">
              {alternateNames.length === 0 && (
                <Text size="xs" c="dimmed" fs="italic">
                  No alternate names added
                </Text>
              )}
              {alternateNames.map((name) => (
                <Group key={name.id} gap="xs">
                  <TextInput
                    flex={1}
                    placeholder="Enter alternate customer name"
                    value={name.value}
                    onChange={(e) =>
                      updateAlternateName(name.id, e.target.value)
                    }
                  />
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => removeAlternateName(name.id)}
                  >
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              ))}
            </Stack>
          </div>

          {/* Facebook Accounts */}
          <div>
            <Group justify="space-between" mb="xs">
              <Group gap="xs">
                <IconBrandFacebook size={16} />
                <Text size="sm" fw={500}>
                  Facebook
                </Text>
              </Group>
              <ActionIcon
                variant="light"
                size="sm"
                onClick={addFacebookAccount}
              >
                <IconPlus size={14} />
              </ActionIcon>
            </Group>
            <Stack gap="xs">
              {facebookAccounts.length === 0 && (
                <Text size="xs" c="dimmed" fs="italic">
                  No Facebook accounts added
                </Text>
              )}
              {facebookAccounts.map((account) => (
                <Group key={account.id} gap="xs">
                  <TextInput
                    flex={1}
                    placeholder="Enter Facebook profile or page"
                    value={account.value}
                    onChange={(e) =>
                      updateFacebookAccount(account.id, e.target.value)
                    }
                  />
                  <ActionIcon
                    variant="light"
                    color="red"
                    onClick={() => removeFacebookAccount(account.id)}
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
