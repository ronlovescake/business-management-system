'use client';

import { useMemo } from 'react';
import {
  Stack,
  Group,
  Button,
  Select,
  Textarea,
  NumberInput,
  Text,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconCurrencyPeso, IconBuildingBank } from '@tabler/icons-react';
import { useForm } from '@mantine/form';
import type { ShipmentData } from '../types/shipment.types';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { UniversalModal } from '@/components/modals/UniversalModal';

type PaidAccountOption = 'Cash' | 'E-Wallet';

type TransitBuildFormValues = {
  postingDate: Date | null;
  paidAccount: PaidAccountOption | '';
  paidAmount: number;
  supplierEstimate: number;
  forwarderEstimate: number;
  courierEstimate: number;
  notes: string;
};

interface TransitBuildModalProps {
  opened: boolean;
  onClose: () => void;
  shipment: ShipmentData | null;
  onSubmit: (input: {
    postingDate: Date;
    paidAccount: PaidAccountOption;
    paidAmount: number;
    supplierEstimate: number;
    forwarderEstimate: number;
    courierEstimate: number;
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
  const linkedProductCogsTotal = shipment?.linkedProductCogsTotal;

  const paidAccountOptions = useMemo(
    () => [
      {
        value: 'Cash',
        label: 'Cash (Bank + GCash)',
      },
      {
        value: 'E-Wallet',
        label: 'E-Wallet',
      },
    ],
    []
  );

  const form = useForm<TransitBuildFormValues>({
    initialValues: {
      postingDate: new Date(),
      paidAccount: 'Cash',
      paidAmount: 0,
      supplierEstimate: 0,
      forwarderEstimate: 0,
      courierEstimate: 0,
      notes: '',
    },
    validate: {
      postingDate: (value) => (!value ? 'Posting date is required.' : null),
      paidAccount: (value) => (!value ? 'Choose a paid account.' : null),
      paidAmount: (value) =>
        !Number.isFinite(value) || value < 0
          ? 'Paid amount must be 0 or greater.'
          : null,
      supplierEstimate: (value) =>
        !Number.isFinite(value) || value < 0
          ? 'Supplier balance must be 0 or greater.'
          : null,
      forwarderEstimate: (value) =>
        !Number.isFinite(value) || value < 0
          ? 'Forwarder estimate must be 0 or greater.'
          : null,
      courierEstimate: (value) =>
        !Number.isFinite(value) || value < 0
          ? 'Courier estimate must be 0 or greater.'
          : null,
    },
  });

  const handleSubmit = async (values: TransitBuildFormValues) => {
    if (!shipment) {
      return;
    }

    const postingDate = values.postingDate;
    const paidAccount = values.paidAccount;

    if (!postingDate || !paidAccount) {
      return;
    }

    const paidAmount = Number(values.paidAmount ?? 0);
    const supplierEstimate = Number(values.supplierEstimate ?? 0);
    const forwarderEstimate = Number(values.forwarderEstimate ?? 0);
    const courierEstimate = Number(values.courierEstimate ?? 0);

    if (
      !Number.isFinite(paidAmount) ||
      !Number.isFinite(supplierEstimate) ||
      !Number.isFinite(forwarderEstimate) ||
      !Number.isFinite(courierEstimate)
    ) {
      return;
    }

    if (
      paidAmount < 0 ||
      supplierEstimate < 0 ||
      forwarderEstimate < 0 ||
      courierEstimate < 0
    ) {
      return;
    }

    if (
      paidAmount + supplierEstimate + forwarderEstimate + courierEstimate <=
      0
    ) {
      form.setFieldError(
        'paidAmount',
        'Enter at least one amount (paid/supplier/forwarder/courier).'
      );
      return;
    }

    const ok = await onSubmit({
      postingDate,
      paidAccount,
      paidAmount,
      supplierEstimate,
      forwarderEstimate,
      courierEstimate,
      notes: values.notes?.trim() ? values.notes.trim() : undefined,
    });

    if (ok) {
      form.reset();
      onClose();
    }
  };

  return (
    <UniversalModal
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
            label="Paid From"
            placeholder="Select paid account"
            required
            data={paidAccountOptions}
            leftSection={<IconBuildingBank size={16} />}
            {...form.getInputProps('paidAccount')}
          />

          <NumberInput
            label="Paid Amount (Supplier + Alibaba)"
            description="This is the portion already paid now."
            prefix="₱ "
            decimalScale={2}
            min={0}
            {...form.getInputProps('paidAmount')}
          />

          <NumberInput
            label="Supplier Balance (Unpaid)"
            description="Creates: Dr Inventory in Transit / Cr Accounts Payable"
            prefix="₱ "
            decimalScale={2}
            min={0}
            {...form.getInputProps('supplierEstimate')}
          />

          <NumberInput
            label="Forwarder Estimate (Unpaid)"
            description="Creates: Dr Inventory in Transit / Cr Forwarder Payable"
            prefix="₱ "
            decimalScale={2}
            min={0}
            {...form.getInputProps('forwarderEstimate')}
          />

          <NumberInput
            label="Courier Estimate (Unpaid)"
            description="Creates: Dr Inventory in Transit / Cr Courier Payable"
            prefix="₱ "
            decimalScale={2}
            min={0}
            {...form.getInputProps('courierEstimate')}
          />

          <Text size="sm" c="dimmed">
            Note: The system computes the shipment total from linked Products
            (sum of Product COGS). Your Paid + Supplier + Forwarder + Courier
            amounts must equal that total.
          </Text>

          {Number.isFinite(linkedProductCogsTotal) ? (
            <Text size="sm" c="dimmed">
              Shipment total (linked Product COGS): ₱
              {Number(linkedProductCogsTotal).toFixed(2)}
            </Text>
          ) : null}

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
    </UniversalModal>
  );
}
