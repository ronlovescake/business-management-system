'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  Alert,
  Button,
  Group,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import { IconCurrencyPeso, IconInfoCircle } from '@tabler/icons-react';
import { buildApiPath } from '@/lib/api/paths';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { logger } from '@/lib/logger';
import { toISODate } from '@/utils/date';
import type { ShipmentData } from '../types/shipment.types';

type LogisticsVendor = 'Forwarder' | 'Courier' | 'Packaging';
type LogisticsAction = 'accrue' | 'pay' | 'capitalize' | 'adjust-down';

type PayableMode = 'separate' | 'single';

type LogisticsAccountConfig = {
  clearingAccount: string;
  payableMode: PayableMode;
  logisticsPayableAccount: string;
  forwarderPayableAccount: string;
  courierPayableAccount: string;
  packagingPayableAccount: string;
};

const ACCOUNT_CONFIG_STORAGE_KEY =
  'clothing.shipments.logisticsCosts.accountConfig.v1';

const DEFAULT_ACCOUNT_CONFIG: LogisticsAccountConfig = {
  clearingAccount: 'Landed Cost Clearing',
  payableMode: 'separate',
  logisticsPayableAccount: 'Logistics Payable',
  forwarderPayableAccount: 'Forwarder Payable',
  courierPayableAccount: 'Courier Payable',
  packagingPayableAccount: 'Packaging Payable',
};

type LogisticsCostsFormValues = {
  shipmentCode: string;
  postingDate: Date | null;
  vendor: LogisticsVendor;
  action: LogisticsAction;
  amount: number;
  ref: string;
  description: string;
};

function getPayableAccount(
  vendor: LogisticsVendor,
  config: LogisticsAccountConfig
): string {
  if (config.payableMode === 'single') {
    return config.logisticsPayableAccount;
  }

  switch (vendor) {
    case 'Forwarder':
      return config.forwarderPayableAccount;
    case 'Courier':
      return config.courierPayableAccount;
    case 'Packaging':
      return config.packagingPayableAccount;
  }
}

function getEntryAccounts(input: {
  vendor: LogisticsVendor;
  action: LogisticsAction;
  config: LogisticsAccountConfig;
}): { debitAccount: string; creditAccount: string } {
  const payable = getPayableAccount(input.vendor, input.config);
  const clearing = input.config.clearingAccount;

  switch (input.action) {
    case 'accrue':
      return {
        debitAccount: clearing,
        creditAccount: payable,
      };
    case 'pay':
      return {
        debitAccount: payable,
        creditAccount: 'Cash',
      };
    case 'capitalize':
      return {
        debitAccount: 'Stock on Hand',
        creditAccount: clearing,
      };
    case 'adjust-down':
      return {
        debitAccount: payable,
        creditAccount: clearing,
      };
  }
}

function buildDefaultDescription(input: {
  shipmentCode: string;
  vendor: LogisticsVendor;
  action: LogisticsAction;
}): string {
  const code = input.shipmentCode.trim();

  const actionLabel: Record<LogisticsAction, string> = {
    accrue: 'Logistics cost accrued',
    pay: 'Logistics payable paid',
    capitalize: 'Logistics cost capitalized (delivered)',
    'adjust-down': 'Logistics estimate adjusted down',
  };

  return [code, input.vendor, actionLabel[input.action]]
    .filter(Boolean)
    .join(' • ');
}

export const LogisticsCostsTab = memo(function LogisticsCostsTab({
  shipments,
  apiBasePath,
}: {
  shipments: ShipmentData[];
  apiBasePath?: string;
}) {
  const [accountConfig, setAccountConfig] = useState<LogisticsAccountConfig>(
    () => {
      if (typeof window === 'undefined') {
        return DEFAULT_ACCOUNT_CONFIG;
      }

      try {
        const raw = window.localStorage.getItem(ACCOUNT_CONFIG_STORAGE_KEY);
        if (!raw) {
          return DEFAULT_ACCOUNT_CONFIG;
        }

        const parsed = JSON.parse(raw) as Partial<LogisticsAccountConfig>;

        return {
          ...DEFAULT_ACCOUNT_CONFIG,
          ...parsed,
        };
      } catch (error) {
        logger.warn('Failed to load LogisticsCostsTab account config', {
          error,
        });
        return DEFAULT_ACCOUNT_CONFIG;
      }
    }
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        ACCOUNT_CONFIG_STORAGE_KEY,
        JSON.stringify(accountConfig)
      );
    } catch (error) {
      logger.warn('Failed to persist LogisticsCostsTab account config', {
        error,
      });
    }
  }, [accountConfig]);

  const shipmentOptions = useMemo(
    () =>
      shipments
        .map((s) => {
          const code = (s['Shipment Code'] ?? '').trim();
          return {
            value: code,
            label: code,
          };
        })
        .filter((opt) => opt.value)
        .sort((a, b) => a.value.localeCompare(b.value)),
    [shipments]
  );

  const shipmentByCode = useMemo(() => {
    const map = new Map<string, ShipmentData>();
    shipments.forEach((s) => {
      const code = (s['Shipment Code'] ?? '').trim();
      if (code) {
        map.set(code, s);
      }
    });
    return map;
  }, [shipments]);

  const form = useForm<LogisticsCostsFormValues>({
    initialValues: {
      shipmentCode: '',
      postingDate: new Date(),
      vendor: 'Forwarder',
      action: 'accrue',
      amount: 0,
      ref: '',
      description: '',
    },
    validate: {
      shipmentCode: (value) =>
        !value?.trim() ? 'Shipment code is required.' : null,
      postingDate: (value) => (!value ? 'Posting date is required.' : null),
      amount: (value) =>
        !Number.isFinite(value) || value <= 0
          ? 'Amount must be greater than 0.'
          : null,
      ref: (value) => (!value?.trim() ? 'Ref is required.' : null),
    },
  });

  const selectedShipment = shipmentByCode.get(form.values.shipmentCode);
  const delivered = selectedShipment?.['Shipment Status'] === 'Delivered';

  const { debitAccount, creditAccount } = getEntryAccounts({
    vendor: form.values.vendor,
    action: form.values.action,
    config: accountConfig,
  });

  const submit = async (values: LogisticsCostsFormValues) => {
    const postingDate = values.postingDate;
    if (!postingDate) {
      return;
    }

    if (values.action === 'capitalize' && !delivered) {
      const ok = window.confirm(
        `This shipment is not marked Delivered.\n\nContinue with capitalization anyway?\n\nShipment: ${values.shipmentCode}\nStatus: ${selectedShipment?.['Shipment Status'] ?? 'Unknown'}`
      );
      if (!ok) {
        return;
      }
    }

    const description = values.description?.trim()
      ? values.description.trim()
      : buildDefaultDescription({
          shipmentCode: values.shipmentCode,
          vendor: values.vendor,
          action: values.action,
        });

    const payload = {
      date: toISODate(postingDate),
      ref: values.ref.trim(),
      debitAccount,
      creditAccount,
      amount: Number(values.amount),
      description,
    };

    try {
      const res = await fetch(
        buildApiPath(apiBasePath, '/accounting/manual-journal'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const responseBody = await res.json().catch(() => null);
      if (!res.ok) {
        const errorMessage =
          responseBody?.error || 'Failed to save logistics journal entry';
        throw new Error(errorMessage);
      }

      showNotification({
        color: 'teal',
        title: 'Logistics entry saved',
        message: `${debitAccount} / ${creditAccount} • ₱${Number(values.amount).toFixed(2)}`,
      });

      form.setValues({
        ...values,
        amount: 0,
        description: '',
      });
    } catch (error) {
      logger.error('Logistics manual journal save failed', { error });
      showNotification({
        color: 'red',
        title: 'Could not save entry',
        message:
          error instanceof Error ? error.message : 'Unexpected error occurred',
      });
    }
  };

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        <Alert
          icon={<IconInfoCircle size={16} />}
          title="Pattern B: capitalize logistics only when Delivered"
          color="blue"
          variant="light"
        >
          <Text size="sm">
            Use this to post logistics costs without touching Inventory in
            Transit. Typical flow: (1) accrue to clearing, (2) pay payable, (3)
            capitalize at delivery.
          </Text>
        </Alert>

        <Accordion variant="contained" radius="md">
          <Accordion.Item value="accounts">
            <Accordion.Control>
              Account names (match your chart)
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                <TextInput
                  label="Clearing account"
                  description="Asset holding account for logistics until Delivered (e.g. Landed Cost Clearing, Logistics Clearing)"
                  value={accountConfig.clearingAccount}
                  onChange={(event) =>
                    setAccountConfig((prev) => ({
                      ...prev,
                      clearingAccount: event.currentTarget.value,
                    }))
                  }
                />

                <SegmentedControl
                  fullWidth
                  value={accountConfig.payableMode}
                  onChange={(value) =>
                    setAccountConfig((prev) => ({
                      ...prev,
                      payableMode: value as PayableMode,
                    }))
                  }
                  data={[
                    { value: 'separate', label: 'Separate payables' },
                    { value: 'single', label: 'Single logistics payable' },
                  ]}
                />

                {accountConfig.payableMode === 'single' ? (
                  <TextInput
                    label="Logistics payable account"
                    value={accountConfig.logisticsPayableAccount}
                    onChange={(event) =>
                      setAccountConfig((prev) => ({
                        ...prev,
                        logisticsPayableAccount: event.currentTarget.value,
                      }))
                    }
                  />
                ) : (
                  <Group grow>
                    <TextInput
                      label="Forwarder payable account"
                      value={accountConfig.forwarderPayableAccount}
                      onChange={(event) =>
                        setAccountConfig((prev) => ({
                          ...prev,
                          forwarderPayableAccount: event.currentTarget.value,
                        }))
                      }
                    />
                    <TextInput
                      label="Courier payable account"
                      value={accountConfig.courierPayableAccount}
                      onChange={(event) =>
                        setAccountConfig((prev) => ({
                          ...prev,
                          courierPayableAccount: event.currentTarget.value,
                        }))
                      }
                    />
                    <TextInput
                      label="Packaging payable account"
                      value={accountConfig.packagingPayableAccount}
                      onChange={(event) =>
                        setAccountConfig((prev) => ({
                          ...prev,
                          packagingPayableAccount: event.currentTarget.value,
                        }))
                      }
                    />
                  </Group>
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>

        <form
          onSubmit={form.onSubmit((values) => {
            void submit(values);
          })}
        >
          <Stack gap="md">
            <Select
              label="Shipment Code"
              placeholder="Select shipment"
              searchable
              required
              data={shipmentOptions}
              value={form.values.shipmentCode}
              onChange={(value) => {
                const code = (value ?? '').trim();
                form.setFieldValue('shipmentCode', code);

                const shouldAutofillRef =
                  !form.values.ref.trim() ||
                  form.values.ref === form.values.shipmentCode;
                if (code && shouldAutofillRef) {
                  form.setFieldValue('ref', code);
                }
              }}
              error={form.errors.shipmentCode}
            />

            <Group gap="md" align="flex-start">
              <Select
                label="Vendor"
                required
                data={[
                  { value: 'Forwarder', label: 'Forwarder' },
                  { value: 'Courier', label: 'Courier' },
                  { value: 'Packaging', label: 'Packaging' },
                ]}
                value={form.values.vendor}
                onChange={(value) => {
                  if (!value) {
                    return;
                  }
                  form.setFieldValue('vendor', value as LogisticsVendor);
                }}
                style={{ flex: 1 }}
              />

              <DateInput
                label="Posting Date"
                placeholder="Select posting date"
                required
                {...COMMON_DATE_INPUT_PROPS}
                {...form.getInputProps('postingDate')}
                style={{ flex: 1 }}
              />
            </Group>

            <SegmentedControl
              fullWidth
              value={form.values.action}
              onChange={(value) =>
                form.setFieldValue('action', value as LogisticsAction)
              }
              data={[
                { value: 'accrue', label: 'Accrue to Clearing' },
                { value: 'pay', label: 'Pay Payable' },
                { value: 'capitalize', label: 'Capitalize (Delivered)' },
                { value: 'adjust-down', label: 'Adjust Down' },
              ]}
            />

            <Text size="sm" c="dimmed">
              Entry preview: <b>{debitAccount}</b> / <b>{creditAccount}</b>
              {form.values.action === 'capitalize' && form.values.shipmentCode
                ? ` • Shipment status: ${selectedShipment?.['Shipment Status'] ?? 'Unknown'}`
                : null}
            </Text>

            <NumberInput
              label="Amount"
              required
              prefix="₱ "
              decimalScale={2}
              min={0}
              {...form.getInputProps('amount')}
            />

            <TextInput
              label="Ref"
              required
              placeholder="e.g. KPC 23930A-00222"
              {...form.getInputProps('ref')}
            />

            <Textarea
              label="Description (optional)"
              placeholder="Leave blank to auto-generate"
              rows={3}
              {...form.getInputProps('description')}
            />

            <Group justify="flex-end">
              <Button
                variant="outline"
                onClick={() => {
                  form.reset();
                }}
              >
                Reset
              </Button>
              <Button
                type="submit"
                leftSection={<IconCurrencyPeso size={16} />}
              >
                Post Entry
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>
    </Paper>
  );
});
