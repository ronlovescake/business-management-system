'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCreditCard,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { queryKeys } from '@/lib/queryKeys';
import {
  paymentCardService,
  type PaymentCardInput,
} from '@/modules/settings/global/services/paymentCards.service';

const buildMasked = (last4: string | null | undefined) =>
  last4 && last4.trim().length ? `•••• ${last4.trim()}` : '••••';

const validateFields = (fields: {
  bank: string;
  label: string;
  nameOnCard: string;
  last4: string;
}) => {
  const trimmedBank = fields.bank.trim();
  const trimmedLabel = fields.label.trim();
  const trimmedName = fields.nameOnCard.trim();
  const trimmedLast4 = fields.last4.trim();

  if (!trimmedBank || !trimmedLabel || !trimmedName) {
    return 'Bank, label, and name on card are required.';
  }

  if (trimmedLast4 && !/^\d{4}$/.test(trimmedLast4)) {
    return 'Last 4 must be exactly 4 digits.';
  }

  return null;
};

export function PaymentCardsTab() {
  const queryClient = useQueryClient();
  const [bank, setBank] = useState('');
  const [label, setLabel] = useState('');
  const [nameOnCard, setNameOnCard] = useState('');
  const [last4, setLast4] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const {
    data: cards = [],
    isLoading,
    error: fetchError,
  } = useQuery({
    queryKey: queryKeys.paymentCards.lists(),
    queryFn: () => paymentCardService.list(),
    staleTime: 5 * 60 * 1000,
  });

  const createCard = useMutation({
    mutationFn: (payload: PaymentCardInput) =>
      paymentCardService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.paymentCards.lists(),
      });
      setBank('');
      setLabel('');
      setNameOnCard('');
      setLast4('');
    },
  });

  const deleteCard = useMutation({
    mutationFn: (id: string) => paymentCardService.remove(id),
    onMutate: (id: string) => {
      setDeletingId(id);
    },
    onSettled: () => {
      setDeletingId(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.paymentCards.lists(),
      });
    },
  });

  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => a.bank.localeCompare(b.bank)),
    [cards]
  );

  const handleAdd = async () => {
    setError(null);
    const validationError = validateFields({ bank, label, nameOnCard, last4 });

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await createCard.mutateAsync({
        bank: bank.trim(),
        label: label.trim(),
        nameOnCard: nameOnCard.trim(),
        last4: last4.trim() || undefined,
      });
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : 'Failed to save card.';
      setError(message);
    }
  };

  return (
    <Stack gap="lg">
      <Group align="center" justify="space-between" wrap="wrap">
        <Group gap="sm" align="center">
          <IconCreditCard size={18} />
          <Title order={3}>Payments &amp; Cards</Title>
        </Group>
        <Badge color="gray" variant="light">
          Metadata only — no PAN/CVV stored
        </Badge>
      </Group>

      {(error || fetchError) && (
        <Alert color="red" icon={<IconAlertCircle size={16} />}>
          {error || 'Failed to load cards. Please retry.'}
        </Alert>
      )}

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Group grow>
            <TextInput
              label="Bank"
              placeholder="BPI"
              value={bank}
              onChange={(e) => setBank(e.currentTarget.value)}
            />
            <TextInput
              label="Card Label"
              placeholder="Card A / Team Ops"
              value={label}
              onChange={(e) => setLabel(e.currentTarget.value)}
            />
          </Group>
          <Group grow>
            <TextInput
              label="Name on Card"
              placeholder="Ronald Allan G. Balnig"
              value={nameOnCard}
              onChange={(e) => setNameOnCard(e.currentTarget.value)}
            />
            <TextInput
              label="Last 4 (optional)"
              placeholder="0602"
              value={last4}
              maxLength={4}
              onChange={(e) => setLast4(e.currentTarget.value)}
            />
          </Group>
          <Group justify="flex-end">
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleAdd}
              loading={createCard.isPending}
            >
              Add Card
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <Title order={5}>Saved Cards</Title>
            <Text size="sm" c="dimmed">
              {sortedCards.length} stored
            </Text>
          </Group>

          <Table striped highlightOnHover withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Bank</Table.Th>
                <Table.Th>Label</Table.Th>
                <Table.Th>Name on Card</Table.Th>
                <Table.Th>Masked</Table.Th>
                <Table.Th style={{ width: 100 }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Group justify="center" py="md">
                      <Loader size="sm" />
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ) : sortedCards.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="sm" c="dimmed" ta="center" py="sm">
                      No cards stored yet.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                sortedCards.map((card) => (
                  <Table.Tr key={card.id}>
                    <Table.Td>{card.bank}</Table.Td>
                    <Table.Td>{card.label}</Table.Td>
                    <Table.Td>{card.nameOnCard}</Table.Td>
                    <Table.Td>{buildMasked(card.last4)}</Table.Td>
                    <Table.Td>
                      <Group justify="flex-end" gap="xs">
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          onClick={() => deleteCard.mutate(card.id)}
                          disabled={
                            deleteCard.isPending && deletingId === card.id
                          }
                        >
                          {deleteCard.isPending && deletingId === card.id ? (
                            <Loader size="xs" />
                          ) : (
                            <IconTrash size={16} />
                          )}
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Stack>
      </Card>
    </Stack>
  );
}
