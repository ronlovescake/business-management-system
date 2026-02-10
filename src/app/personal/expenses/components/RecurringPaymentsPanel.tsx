'use client';

import React from 'react';
import {
  Badge,
  Box,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconRepeat } from '@tabler/icons-react';
import {
  HouseholdRecurringPaymentService,
  type HouseholdRecurringPaymentDTO,
} from '@/services/HouseholdRecurringPaymentService';
import { UniversalModal } from '@/components/modals/UniversalModal';

import { usePolishedFieldStyles } from '@/components/modals/usePolishedFieldStyles';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';

type SelectOption = { value: string; label: string };

export function RecurringPaymentsPanel(props: {
  categories: string[];
  accountOptions: SelectOption[];
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
  getCategoryColor: (category: string) => string;
  searchQuery: string;
  opened: boolean;
  setOpened: (opened: boolean) => void;
  lastGenerateResult:
    | { month: string; created: number; skipped: number }
    | null
    | undefined;
}) {
  const {
    categories,
    accountOptions,
    formatCurrency,
    formatDate,
    getCategoryColor,
    searchQuery,
    opened,
    setOpened,
    lastGenerateResult,
  } = props;
  const queryClient = useQueryClient();

  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState<number | ''>('');
  const [category, setCategory] = React.useState<string | null>(null);
  const [accountId, setAccountId] = React.useState<string | null>(null);
  const [startDate, setStartDate] = React.useState<Date | null>(new Date());
  const [monthsCount, setMonthsCount] = React.useState<number | ''>('');
  const [isActive, setIsActive] = React.useState(true);
  const [deductOnGenerate, setDeductOnGenerate] = React.useState(true);
  const [notes, setNotes] = React.useState('');
  const [editingItem, setEditingItem] =
    React.useState<HouseholdRecurringPaymentDTO | null>(null);
  const isEditing = Boolean(editingItem);

  const recurringQuery = useQuery({
    queryKey: ['household-recurring-payments'],
    queryFn: () => HouseholdRecurringPaymentService.getAll(),
    staleTime: 60 * 1000,
  });

  const resetForm = React.useCallback(() => {
    setName('');
    setAmount('');
    setCategory(null);
    setAccountId(null);
    setStartDate(new Date());
    setMonthsCount('');
    setIsActive(true);
    setDeductOnGenerate(true);
    setNotes('');
  }, []);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) {
        throw new Error('Name is required');
      }
      if (amount === '' || Number(amount) <= 0) {
        throw new Error('Amount must be greater than zero');
      }
      if (!category) {
        throw new Error('Category is required');
      }
      if (!startDate) {
        throw new Error('Start date is required');
      }
      if (!accountId) {
        throw new Error('Account is required');
      }

      return HouseholdRecurringPaymentService.create({
        name: name.trim(),
        amount,
        category,
        notes: notes.trim() ? notes.trim() : null,
        startDate: startDate.toISOString(),
        monthsCount: monthsCount === '' ? null : monthsCount,
        isActive,
        deductOnGenerate,
        accountId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['household-recurring-payments'],
      });
      setOpened(false);
      setEditingItem(null);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingItem) {
        throw new Error('No recurring payment selected');
      }
      if (!name.trim()) {
        throw new Error('Name is required');
      }
      if (amount === '' || Number(amount) <= 0) {
        throw new Error('Amount must be greater than zero');
      }
      if (!category) {
        throw new Error('Category is required');
      }
      if (!startDate) {
        throw new Error('Start date is required');
      }
      if (!accountId) {
        throw new Error('Account is required');
      }

      return HouseholdRecurringPaymentService.update(editingItem.id, {
        name: name.trim(),
        amount,
        category,
        notes: notes.trim() ? notes.trim() : null,
        startDate: startDate.toISOString(),
        monthsCount: monthsCount === '' ? null : monthsCount,
        isActive,
        deductOnGenerate,
        accountId,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['household-recurring-payments'],
      });
      setOpened(false);
      setEditingItem(null);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      HouseholdRecurringPaymentService.deleteById(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['household-recurring-payments'],
      });
    },
  });

  const isValid =
    Boolean(name.trim()) &&
    typeof amount === 'number' &&
    amount > 0 &&
    Boolean(category) &&
    Boolean(startDate) &&
    Boolean(accountId);

  const { getFieldProps, getTextareaProps, getSelectProps } =
    usePolishedFieldStyles(opened);

  const nameField = getFieldProps('name');
  const amountField = getFieldProps('amount');
  const startDateField = getFieldProps('startDate');
  const categorySelect = getSelectProps('category');
  const accountSelect = getSelectProps('account');
  const monthsCountField = getFieldProps('monthsCount');
  const notesField = getTextareaProps('notes');

  const modalTitle = (
    <Group gap="sm" align="center">
      <IconRepeat size={26} color="#65ab58" />
      <Stack gap={2}>
        <Text fw={700} fz="lg" c="#101828">
          {isEditing ? 'Edit Recurring Payment' : 'Add Recurring Payment'}
        </Text>
        <Text fz="sm" c="#667085">
          {isEditing
            ? 'Update the details for this recurring payment'
            : 'Fill in the details to add a recurring payment'}
        </Text>
      </Stack>
    </Group>
  );

  const items = React.useMemo(
    () => recurringQuery.data ?? [],
    [recurringQuery.data]
  );

  const filteredItems = React.useMemo(() => {
    const q = (searchQuery || '').trim().toLowerCase();
    if (!q) {
      return items;
    }

    const getAccountLabel = (id: string | null) => {
      if (!id) {
        return '';
      }
      return accountOptions.find((o) => o.value === id)?.label ?? '';
    };

    return items.filter((item) => {
      const haystack = [
        item.name,
        item.category,
        item.notes || '',
        getAccountLabel(item.accountId),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [items, searchQuery, accountOptions]);

  const startEditing = React.useCallback(
    (item: HouseholdRecurringPaymentDTO) => {
      setEditingItem(item);
      setName(item.name);
      setAmount(item.amount);
      setCategory(item.category);
      setAccountId(item.accountId);
      setStartDate(new Date(item.startDate));
      setMonthsCount(item.monthsCount ?? '');
      setIsActive(item.isActive);
      setDeductOnGenerate(item.deductOnGenerate ?? true);
      setNotes(item.notes ?? '');
      setOpened(true);
    },
    [setOpened]
  );

  React.useEffect(() => {
    if (!opened) {
      setEditingItem(null);
      resetForm();
    } else if (!editingItem) {
      resetForm();
    }
  }, [opened, editingItem, resetForm]);

  const rows = filteredItems.map((item: HouseholdRecurringPaymentDTO) => (
    <Table.Tr
      key={item.id}
      onDoubleClick={() => startEditing(item)}
      style={{ cursor: 'pointer' }}
    >
      <Table.Td>
        <Text size="sm" fw={500} c="#495057">
          {item.name}
        </Text>
      </Table.Td>
      <Table.Td style={{ textAlign: 'right' }}>
        <Text fw={600} c="#495057">
          {formatCurrency(item.amount)}
        </Text>
      </Table.Td>
      <Table.Td style={{ textAlign: 'center' }}>
        <Badge color={getCategoryColor(item.category)} variant="light">
          {item.category}
        </Badge>
      </Table.Td>
      <Table.Td style={{ textAlign: 'center' }}>
        <Text size="sm" c="#495057">
          {item.accountId
            ? (accountOptions.find((o) => o.value === item.accountId)?.label ??
              '—')
            : '—'}
        </Text>
      </Table.Td>
      <Table.Td style={{ color: '#495057', textAlign: 'center' }}>
        {formatDate(item.startDate)}
      </Table.Td>
      <Table.Td style={{ color: '#495057', textAlign: 'center' }}>
        {item.monthsCount ?? '—'}
      </Table.Td>
      <Table.Td style={{ textAlign: 'center' }}>
        <Badge color={item.isActive ? 'green' : 'gray'} variant="light">
          {item.isActive ? 'Active' : 'Paused'}
        </Badge>
      </Table.Td>
      <Table.Td style={{ textAlign: 'center' }}>
        <Group gap="xs" justify="center">
          <Button
            size="xs"
            variant="subtle"
            color="red"
            loading={deleteMutation.isPending}
            onClick={(e) => {
              e.stopPropagation();
              if (!window.confirm('Delete this recurring payment?')) {
                return;
              }
              deleteMutation.mutate(item.id);
            }}
          >
            Delete
          </Button>
          <Button
            size="xs"
            variant="light"
            onClick={(e) => {
              e.stopPropagation();
              startEditing(item);
            }}
          >
            Edit
          </Button>
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Stack gap="md">
      {lastGenerateResult ? (
        <Text c="dimmed" size="sm">
          Generated {lastGenerateResult.created} (skipped{' '}
          {lastGenerateResult.skipped}) for {lastGenerateResult.month}.
        </Text>
      ) : null}

      <Card
        withBorder
        padding={0}
        style={{ overflow: 'hidden', height: '73vh' }}
      >
        <Box style={{ height: '100%', overflowY: 'auto' }}>
          <Table highlightOnHover withTableBorder>
            <Table.Thead style={{ backgroundColor: '#f1f3f5' }}>
              <Table.Tr>
                <Table.Th
                  style={{
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  NAME
                </Table.Th>
                <Table.Th
                  style={{
                    width: 220,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  AMOUNT
                </Table.Th>
                <Table.Th
                  style={{
                    width: 220,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  CATEGORY
                </Table.Th>
                <Table.Th
                  style={{
                    width: 260,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  ACCOUNT
                </Table.Th>
                <Table.Th
                  style={{
                    width: 260,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  START
                </Table.Th>
                <Table.Th
                  style={{
                    width: 160,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  MONTHS
                </Table.Th>
                <Table.Th
                  style={{
                    width: 160,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  STATUS
                </Table.Th>
                <Table.Th
                  style={{
                    width: 200,
                    padding: '16px 12px',
                    color: '#495057',
                    backgroundColor: '#f1f3f5',
                    textAlign: 'center',
                  }}
                >
                  ACTIONS
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {recurringQuery.isLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={8} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      Loading recurring payments…
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : filteredItems.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={8} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" py="xl">
                      {items.length === 0
                        ? 'No recurring payments yet.'
                        : 'No recurring payments found'}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                rows
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Card>

      <UniversalModal
        opened={opened}
        onClose={() => setOpened(false)}
        title={modalTitle}
        size="lg"
      >
        <div style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          <Stack gap="lg">
            <Group grow align="flex-start">
              <DateInput
                label="Payment Start"
                required
                value={startDate}
                onChange={setStartDate}
                {...startDateField.handlers}
                styles={startDateField.styles}
                {...COMMON_DATE_INPUT_PROPS}
              />
              <Select
                label="Category"
                data={categories}
                value={category}
                onChange={setCategory}
                required
                searchable
                maxDropdownHeight={400}
                {...categorySelect.handlers}
                styles={categorySelect.styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
            </Group>

            <Group grow align="flex-start">
              <NumberInput
                label="Monthly Amount"
                prefix="₱ "
                decimalScale={2}
                value={amount}
                onChange={(value) =>
                  setAmount(typeof value === 'number' ? value : '')
                }
                required
                min={0}
                {...amountField.handlers}
                styles={amountField.styles}
              />
              <Select
                label="Account"
                data={accountOptions}
                value={accountId}
                onChange={setAccountId}
                searchable
                required
                maxDropdownHeight={400}
                {...accountSelect.handlers}
                styles={accountSelect.styles}
                withCheckIcon={false}
                comboboxProps={{ withinPortal: true, zIndex: 500 }}
              />
            </Group>

            <TextInput
              label="Name"
              placeholder="e.g., Rent, Spotify, Fridge Installment"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              required
              {...nameField.handlers}
              styles={nameField.styles}
            />

            <Group grow align="flex-start">
              <NumberInput
                label="Months (Optional)"
                description="Leave blank for subscriptions with no end date"
                value={monthsCount}
                onChange={(value) =>
                  setMonthsCount(typeof value === 'number' ? value : '')
                }
                min={1}
                allowDecimal={false}
                {...monthsCountField.handlers}
                styles={monthsCountField.styles}
              />
              <Stack gap={10} style={{ flex: 1 }}>
                <Text size="sm" fw={500} c="#101828">
                  Options
                </Text>
                <Switch
                  label="Active"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.currentTarget.checked)}
                />
                <Switch
                  label="Deduct on generate (Auto-paid)"
                  description="If off, this generates as pending and won't deduct until you mark it paid"
                  checked={deductOnGenerate}
                  onChange={(e) => setDeductOnGenerate(e.currentTarget.checked)}
                />
              </Stack>
            </Group>

            <Textarea
              label="Notes (Optional)"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              minRows={3}
              {...notesField.handlers}
              styles={notesField.styles}
            />

            {createMutation.isError || updateMutation.isError ? (
              <Text c="red" size="sm">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : createMutation.error instanceof Error
                    ? createMutation.error.message
                    : 'Failed to save recurring payment'}
              </Text>
            ) : null}

            <Group justify="flex-end" gap="sm" mt="sm">
              <Button
                radius="md"
                variant="default"
                onClick={() => setOpened(false)}
              >
                Cancel
              </Button>
              <Button
                radius="md"
                onClick={() =>
                  isEditing ? updateMutation.mutate() : createMutation.mutate()
                }
                loading={
                  isEditing
                    ? updateMutation.isPending
                    : createMutation.isPending
                }
                disabled={!isValid}
              >
                {isEditing ? 'Update' : 'Save'}
              </Button>
            </Group>
          </Stack>
        </div>
      </UniversalModal>
    </Stack>
  );
}
