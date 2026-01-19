'use client';

import { useMemo } from 'react';
import { Modal, Stack, Group, Button, Select, Textarea } from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconCurrencyPeso, IconBuildingBank } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import type { ShipmentData } from '../types/shipment.types';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';

type CreditAccountOption =
  | 'Cash'
  | 'Bank'
  | 'E-Wallet'
  | 'Accounts Payable'
  | 'Forwarder Payable'
  | 'Courier Payable';

type TransitBuildFormValues = {
  postingDate: Date | null;
  creditAccount: CreditAccountOption | '';
  notes: string;
};

interface TransitBuildModalProps {
  opened: boolean;
  onClose: () => void;
  shipment: ShipmentData | null;
  onSubmit: (input: {
    postingDate: Date;
    creditAccount: CreditAccountOption;
    notes?: string;
  }) => Promise<boolean>;
}

export function TransitBuildModal({
  opened,
  onClose,
  shipment,
  onSubmit,
}: TransitBuildModalProps) {
  const shipmentCode = (shipment?.['Shipment Code'] ?? '').trim();

  const creditOptions = useMemo(
    () => [
      {
        value: 'Cash',
        label: 'Cash',
      },
      {
        value: 'Bank',
        label: 'Bank',
      },
      {
        value: 'E-Wallet',
        label: 'E-Wallet',
      },
      {
        value: 'Accounts Payable',
        label: 'Accounts Payable',
      },
      {
        value: 'Forwarder Payable',
        label: 'Forwarder Payable',
      },
      {
        value: 'Courier Payable',
        label: 'Courier Payable',
      },
    ],
    []
  );

  const form = useForm<TransitBuildFormValues>({
    initialValues: {
      postingDate: new Date(),
      creditAccount: 'Cash',
      notes: '',
    },
    validate: {
      postingDate: (value) => (!value ? 'Posting date is required.' : null),
      creditAccount: (value) => (!value ? 'Choose a credit account.' : null),
    },
  });

  const handleSubmit = async (values: TransitBuildFormValues) => {
    if (!shipment) {
      return;
    }

    const postingDate = values.postingDate;
    const creditAccount = values.creditAccount;

    if (!postingDate || !creditAccount) {
      return;
    }

    const ok = await onSubmit({
      postingDate,
      creditAccount,
      notes: values.notes?.trim() ? values.notes.trim() : undefined,
    });

    if (ok) {
      form.reset();
      onClose();
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        shipmentCode ? `Transit Build-Up • ${shipmentCode}` : 'Transit Build-Up'
      }
      centered
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Select
            label="Credit Account"
            placeholder="Select credit account"
            required
            data={creditOptions}
            leftSection={<IconBuildingBank size={16} />}
            {...form.getInputProps('creditAccount')}
          />

          <DateInput
            label="Posting Date"
            placeholder="Select posting date"
            required
            {...COMMON_DATE_INPUT_PROPS}
            {...form.getInputProps('postingDate')}
          />

          <Textarea
            label="Notes (optional)"
            placeholder="Optional memo"
            rows={3}
            {...form.getInputProps('notes')}
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" leftSection={<IconCurrencyPeso size={16} />}>
              Create Entry
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
