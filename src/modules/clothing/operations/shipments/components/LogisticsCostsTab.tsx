'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Paper,
  Select,
  Skeleton,
  Stack,
  Stepper,
  Table,
  Text,
  TextInput,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { showNotification } from '@mantine/notifications';
import {
  IconCheck,
  IconCircleDashed,
  IconCurrencyPeso,
  IconInfoCircle,
} from '@tabler/icons-react';
import { buildApiPath } from '@/lib/api/paths';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { logger } from '@/lib/logger';
import { toISODate } from '@/utils/date';
import type { ShipmentData } from '../types/shipment.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogisticsVendor = 'Forwarder' | 'Courier' | 'Packaging';
type LogisticsAction = 'accrue' | 'pay' | 'capitalize' | 'adjust-down';

type LogisticsAccountConfig = {
  clearingAccount: string;
  forwarderPayableAccount: string;
  courierPayableAccount: string;
  packagingPayableAccount: string;
};

const ACCOUNT_CONFIG_STORAGE_KEY =
  'clothing.shipments.logisticsCosts.accountConfig.v1';

const DEFAULT_ACCOUNT_CONFIG: LogisticsAccountConfig = {
  clearingAccount: 'Landed Cost Clearing',
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

type JournalLine = {
  id: number;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
  sourceType: string;
  sourceLineKey: string;
};

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_ACTIONS: LogisticsAction[] = [
  'accrue',
  'pay',
  'capitalize',
  'adjust-down',
];

const STEP_META: Record<
  LogisticsAction,
  { label: string; shortLabel: string; description: string }
> = {
  accrue: {
    label: 'Accrue to Clearing',
    shortLabel: 'Accrued',
    description: 'Record the estimated logistics cost while in transit.',
  },
  pay: {
    label: 'Pay Payable',
    shortLabel: 'Paid',
    description: 'Record the cash payment to settle the payable.',
  },
  capitalize: {
    label: 'Capitalize (Delivered)',
    shortLabel: 'Capitalized',
    description: 'Move logistics cost from clearing into Stock on Hand.',
  },
  'adjust-down': {
    label: 'Adjust Down',
    shortLabel: 'Adjusted',
    description: 'Reduce the accrued estimate to match the actual invoice.',
  },
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function getPayableAccount(
  vendor: LogisticsVendor,
  config: LogisticsAccountConfig
): string {
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

/** Map description keywords to an action type for detected steps. */
function detectActionFromDescription(desc: string): LogisticsAction | null {
  const lower = desc.toLowerCase();
  if (lower.includes('accrued') || lower.includes('accrue')) {return 'accrue';}
  if (lower.includes('payable paid') || lower.includes('pay payable'))
    {return 'pay';}
  if (lower.includes('capitalized') || lower.includes('capitalize'))
    {return 'capitalize';}
  if (lower.includes('adjusted down') || lower.includes('adjust'))
    {return 'adjust-down';}
  return null;
}

/** Detect vendor from description keywords. */
function detectVendorFromDescription(desc: string): LogisticsVendor | null {
  const lower = desc.toLowerCase();
  if (lower.includes('forwarder')) {return 'Forwarder';}
  if (lower.includes('courier')) {return 'Courier';}
  if (lower.includes('packaging')) {return 'Packaging';}
  return null;
}

function getEstimateForVendor(
  vendor: LogisticsVendor,
  shipment: ShipmentData | undefined
): number {
  if (!shipment) {return 0;}
  switch (vendor) {
    case 'Forwarder':
      return shipment.linkedProductForwardersFee ?? 0;
    case 'Courier':
      return shipment.linkedProductLalamove ?? 0;
    case 'Packaging':
      return shipment.linkedProductPackagingCost ?? 0;
  }
}

function formatPeso(amount: number): string {
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Posting history detection
// ---------------------------------------------------------------------------

type StepStatus = {
  done: boolean;
  amount: number;
  date: string;
};

function detectCompletedSteps(
  lines: JournalLine[],
  vendor: LogisticsVendor
): Record<LogisticsAction, StepStatus> {
  const result: Record<LogisticsAction, StepStatus> = {
    accrue: { done: false, amount: 0, date: '' },
    pay: { done: false, amount: 0, date: '' },
    capitalize: { done: false, amount: 0, date: '' },
    'adjust-down': { done: false, amount: 0, date: '' },
  };

  // Group lines into pairs by sourceId (debit + credit)
  const pairsBySource = new Map<
    string,
    { debit?: JournalLine; credit?: JournalLine }
  >();
  for (const line of lines) {
    const key = line.sourceLineKey === 'debit' || line.sourceLineKey === 'credit'
      ? `${line.date}-${line.description}-${Math.max(line.debit, line.credit)}`
      : line.id.toString();
    let pair = pairsBySource.get(key);
    if (!pair) {
      pair = {};
      pairsBySource.set(key, pair);
    }
    if (line.debit > 0) {
      pair.debit = line;
    }
    if (line.credit > 0) {
      pair.credit = line;
    }
  }

  for (const line of lines) {
    if (line.credit > 0) {
      continue;
    }
    const action = detectActionFromDescription(line.description);
    const lineVendor = detectVendorFromDescription(line.description);

    if (action && lineVendor === vendor) {
      result[action] = {
        done: true,
        amount: line.debit,
        date: line.date,
      };
    }
  }

  return result;
}

function getNextRecommendedAction(
  steps: Record<LogisticsAction, StepStatus>,
  isDelivered: boolean
): LogisticsAction {
  if (!steps.accrue.done) {return 'accrue';}
  if (!steps.pay.done) {return 'pay';}
  if (isDelivered && !steps.capitalize.done) {return 'capitalize';}
  return 'accrue'; // default fallback
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LogisticsCostsTab = memo(function LogisticsCostsTab({
  shipments,
  apiBasePath,
}: {
  shipments: ShipmentData[];
  apiBasePath?: string;
}) {
  // ---- Account config (persisted to localStorage) ----

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

  // ---- Shipment options ----

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

  // ---- Form ----

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

  // ---- Posting history ----

  const [journalLines, setJournalLines] = useState<JournalLine[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  const fetchHistory = useCallback(
    async (ref: string) => {
      if (!ref.trim()) {
        setJournalLines([]);
        return;
      }
      setHistoryLoading(true);
      try {
        const res = await fetch(
          buildApiPath(
            apiBasePath,
            `/accounting/journal-lines-by-ref?ref=${encodeURIComponent(ref.trim())}`
          )
        );
        if (res.ok) {
          const body = await res.json();
          setJournalLines(body.data ?? []);
        }
      } catch (error) {
        logger.warn('Failed to fetch journal history', { error });
      } finally {
        setHistoryLoading(false);
      }
    },
    [apiBasePath]
  );

  // Fetch history when shipment code changes
  useEffect(() => {
    if (form.values.shipmentCode) {
      void fetchHistory(form.values.shipmentCode);
    } else {
      setJournalLines([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.shipmentCode, fetchHistory, historyVersion]);

  // ---- Step detection ----

  const completedSteps = useMemo(
    () => detectCompletedSteps(journalLines, form.values.vendor),
    [journalLines, form.values.vendor]
  );

  const recommendedAction = useMemo(
    () => getNextRecommendedAction(completedSteps, delivered ?? false),
    [completedSteps, delivered]
  );

  // Auto-select recommended action when shipment/vendor changes (but not on initial load)
  useEffect(() => {
    if (form.values.shipmentCode && !historyLoading) {
      form.setFieldValue('action', recommendedAction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recommendedAction, historyLoading]);

  // ---- Auto-populate amount ----

  useEffect(() => {
    if (!form.values.shipmentCode || form.values.amount > 0) {return;}

    const estimate = getEstimateForVendor(
      form.values.vendor,
      selectedShipment
    );
    if (estimate <= 0) {return;}

    const { action } = form.values;
    if (action === 'accrue') {
      form.setFieldValue('amount', estimate);
    } else if (action === 'pay' || action === 'capitalize') {
      // Use accrued amount if available, else estimate
      const accrued = completedSteps.accrue.amount;
      const adjusted = completedSteps['adjust-down'].amount;
      const netAccrued = accrued > 0 ? accrued - adjusted : 0;
      form.setFieldValue('amount', netAccrued > 0 ? netAccrued : estimate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.values.shipmentCode,
    form.values.vendor,
    form.values.action,
    selectedShipment,
    completedSteps,
  ]);

  // ---- Stepper active index ----

  const stepperActive = useMemo(() => {
    // The stepper shows 3 main steps: accrue → pay → capitalize
    // Adjust-down is optional and not part of the main flow
    if (completedSteps.capitalize.done) {return 3;}
    if (completedSteps.pay.done) {return 2;}
    if (completedSteps.accrue.done) {return 1;}
    return 0;
  }, [completedSteps]);

  // ---- Submit ----

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

      // Refresh history
      setHistoryVersion((v) => v + 1);
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

  // ---- Determine which actions should be disabled ----

  const actionDisabled: Record<LogisticsAction, string | false> = {
    accrue: completedSteps.accrue.done
      ? `Already accrued (${formatPeso(completedSteps.accrue.amount)})`
      : false,
    pay: !completedSteps.accrue.done
      ? 'Nothing accrued yet — accrue first.'
      : completedSteps.pay.done
        ? `Already paid (${formatPeso(completedSteps.pay.amount)})`
        : false,
    capitalize: !delivered
      ? `Shipment status is "${selectedShipment?.['Shipment Status'] ?? 'Unknown'}" — must be Delivered.`
      : completedSteps.capitalize.done
        ? `Already capitalized (${formatPeso(completedSteps.capitalize.amount)})`
        : false,
    'adjust-down': !completedSteps.accrue.done
      ? 'Nothing accrued yet — nothing to adjust.'
      : false,
  };

  // ---- Render ----

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        {/* Info banner */}
        <Alert
          icon={<IconInfoCircle size={16} />}
          title="Pattern B: capitalize logistics only when Delivered"
          color="blue"
          variant="light"
        >
          <Text size="sm">
            Post logistics costs without touching Inventory in Transit. Typical
            flow: (1) accrue to clearing, (2) pay payable, (3) capitalize at
            delivery. Steps auto-detect from existing entries.
          </Text>
        </Alert>

        {/* Account config */}
        <Card withBorder radius="md" p="md">
          <Text size="sm" fw={600} mb="sm">
            Account names (match your chart)
          </Text>
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
          </Stack>
        </Card>

        <form
          onSubmit={form.onSubmit((values) => {
            void submit(values);
          })}
        >
          <Stack gap="md">
            {/* ---- Shipment Code + Vendor row ---- */}
            <Group gap="md" align="flex-start" grow>
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

                  // Reset amount when switching shipments
                  form.setFieldValue('amount', 0);
                }}
                error={form.errors.shipmentCode}
              />

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
                  form.setFieldValue('amount', 0);
                }}
              />

              <DateInput
                label="Posting Date"
                placeholder="Select posting date"
                required
                {...COMMON_DATE_INPUT_PROPS}
                {...form.getInputProps('postingDate')}
              />
            </Group>

            {/* ---- Shipment summary card ---- */}
            {selectedShipment && (
              <Card withBorder radius="sm" p="sm" bg="gray.0">
                <Group justify="space-between" wrap="wrap">
                  <Group gap="xs">
                    <Text size="sm" fw={600}>
                      {selectedShipment['Shipment Code']}
                    </Text>
                    <Badge
                      size="sm"
                      color={delivered ? 'teal' : 'yellow'}
                      variant="light"
                    >
                      {selectedShipment['Shipment Status'] || 'Unknown'}
                    </Badge>
                    {selectedShipment['Date Delivered'] && (
                      <Text size="xs" c="dimmed">
                        Delivered: {selectedShipment['Date Delivered']}
                      </Text>
                    )}
                  </Group>
                  <Group gap="lg">
                    <Text size="xs" c="dimmed">
                      Products: {selectedShipment.linkedProductCount ?? 0}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Supplier:{' '}
                      {formatPeso(
                        selectedShipment.linkedProductGrandTotal ?? 0
                      )}
                    </Text>
                  </Group>
                </Group>
                <Divider my="xs" />
                <Group gap="xl">
                  <Box>
                    <Text size="xs" c="dimmed">
                      Forwarder (est.)
                    </Text>
                    <Text
                      size="sm"
                      fw={form.values.vendor === 'Forwarder' ? 700 : 400}
                      c={form.values.vendor === 'Forwarder' ? 'blue' : undefined}
                    >
                      {formatPeso(
                        selectedShipment.linkedProductForwardersFee ?? 0
                      )}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Courier (est.)
                    </Text>
                    <Text
                      size="sm"
                      fw={form.values.vendor === 'Courier' ? 700 : 400}
                      c={form.values.vendor === 'Courier' ? 'blue' : undefined}
                    >
                      {formatPeso(selectedShipment.linkedProductLalamove ?? 0)}
                    </Text>
                  </Box>
                  <Box>
                    <Text size="xs" c="dimmed">
                      Packaging (est.)
                    </Text>
                    <Text
                      size="sm"
                      fw={form.values.vendor === 'Packaging' ? 700 : 400}
                      c={
                        form.values.vendor === 'Packaging' ? 'blue' : undefined
                      }
                    >
                      {formatPeso(
                        selectedShipment.linkedProductPackagingCost ?? 0
                      )}
                    </Text>
                  </Box>
                </Group>
              </Card>
            )}

            {/* ---- Stepper (progress indicator) ---- */}
            {form.values.shipmentCode && (
              <>
                {historyLoading ? (
                  <Skeleton height={60} radius="sm" />
                ) : (
                  <Stepper
                    active={stepperActive}
                    size="sm"
                    completedIcon={<IconCheck size={14} />}
                  >
                    {(['accrue', 'pay', 'capitalize'] as LogisticsAction[]).map(
                      (action) => {
                        const step = completedSteps[action];
                        const meta = STEP_META[action];
                        return (
                          <Stepper.Step
                            key={action}
                            label={meta.shortLabel}
                            description={
                              step.done
                                ? `${formatPeso(step.amount)} on ${step.date}`
                                : meta.description
                            }
                            color={step.done ? 'teal' : 'blue'}
                            icon={
                              step.done ? undefined : (
                                <IconCircleDashed size={14} />
                              )
                            }
                          />
                        );
                      }
                    )}
                  </Stepper>
                )}
              </>
            )}

            {/* ---- Action selector ---- */}
            <Box>
              <Text size="sm" fw={500} mb={4}>
                Action
              </Text>
              <Group gap="xs" grow>
                {STEP_ACTIONS.map((action) => {
                  const meta = STEP_META[action];
                  const isActive = form.values.action === action;
                  const disabledReason = actionDisabled[action];
                  const isRecommended = action === recommendedAction;

                  const button = (
                    <UnstyledButton
                      key={action}
                      onClick={() => {
                        if (!disabledReason) {
                          form.setFieldValue('action', action);
                        }
                      }}
                      style={(theme) => ({
                        flex: 1,
                        padding: theme.spacing.sm,
                        borderRadius: theme.radius.sm,
                        border: `2px solid ${
                          isActive
                            ? theme.colors.blue[6]
                            : disabledReason
                              ? theme.colors.gray[3]
                              : isRecommended
                                ? theme.colors.blue[3]
                                : theme.colors.gray[4]
                        }`,
                        backgroundColor: isActive
                          ? theme.colors.blue[0]
                          : disabledReason
                            ? theme.colors.gray[0]
                            : 'transparent',
                        opacity: disabledReason ? 0.6 : 1,
                        cursor: disabledReason ? 'not-allowed' : 'pointer',
                        transition: 'all 150ms ease',
                      })}
                    >
                      <Group gap={6} justify="center" wrap="nowrap">
                        <Text
                          size="xs"
                          fw={isActive ? 700 : 500}
                          c={
                            disabledReason
                              ? 'dimmed'
                              : isActive
                                ? 'blue'
                                : undefined
                          }
                          ta="center"
                        >
                          {meta.label}
                        </Text>
                        {isRecommended && !disabledReason && !isActive && (
                          <Badge size="xs" variant="light" color="blue">
                            next
                          </Badge>
                        )}
                      </Group>
                    </UnstyledButton>
                  );

                  return disabledReason ? (
                    <Tooltip
                      key={action}
                      label={disabledReason}
                      multiline
                      w={220}
                      withArrow
                    >
                      {button}
                    </Tooltip>
                  ) : (
                    <Tooltip
                      key={action}
                      label={meta.description}
                      multiline
                      w={220}
                      withArrow
                    >
                      {button}
                    </Tooltip>
                  );
                })}
              </Group>
            </Box>

            {/* ---- Entry preview card ---- */}
            <Card withBorder radius="sm" p="sm" bg="blue.0">
              <Text size="xs" fw={600} c="blue.7" mb={4}>
                Entry Preview
              </Text>
              <Group gap="xl">
                <Box>
                  <Text size="xs" c="dimmed">
                    Debit
                  </Text>
                  <Text size="sm" fw={600}>
                    {debitAccount}
                  </Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">
                    Credit
                  </Text>
                  <Text size="sm" fw={600}>
                    {creditAccount}
                  </Text>
                </Box>
                {form.values.amount > 0 && (
                  <Box>
                    <Text size="xs" c="dimmed">
                      Amount
                    </Text>
                    <Text size="sm" fw={600}>
                      {formatPeso(form.values.amount)}
                    </Text>
                  </Box>
                )}
              </Group>
              {form.values.action === 'capitalize' &&
                !delivered &&
                form.values.shipmentCode && (
                  <Text size="xs" c="orange" mt={4}>
                    ⚠ Shipment not yet Delivered (status:{' '}
                    {selectedShipment?.['Shipment Status'] ?? 'Unknown'})
                  </Text>
                )}
            </Card>

            {/* ---- Amount + Ref ---- */}
            <Group gap="md" align="flex-start" grow>
              <NumberInput
                label="Amount"
                required
                prefix="₱ "
                decimalScale={2}
                min={0}
                thousandSeparator=","
                {...form.getInputProps('amount')}
              />

              <TextInput
                label="Ref"
                required
                placeholder="e.g. KPC 23930A-00222"
                {...form.getInputProps('ref')}
              />
            </Group>

            <Textarea
              label="Description (optional)"
              placeholder="Leave blank to auto-generate"
              rows={2}
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

        {/* ---- Posting history panel ---- */}
        {form.values.shipmentCode && (
          <>
            <Divider label="Posting history for this shipment" labelPosition="center" />
            {historyLoading ? (
              <Skeleton height={80} radius="sm" />
            ) : journalLines.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="sm">
                No entries posted for {form.values.shipmentCode} yet.
              </Text>
            ) : (
              <Table
                striped
                highlightOnHover
                withTableBorder
                withColumnBorders
                fz="xs"
              >
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Account</Table.Th>
                    <Table.Th ta="right">Debit</Table.Th>
                    <Table.Th ta="right">Credit</Table.Th>
                    <Table.Th>Description</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {journalLines.map((line) => (
                    <Table.Tr key={line.id}>
                      <Table.Td>{line.date}</Table.Td>
                      <Table.Td>{line.account}</Table.Td>
                      <Table.Td ta="right">
                        {line.debit > 0 ? formatPeso(line.debit) : ''}
                      </Table.Td>
                      <Table.Td ta="right">
                        {line.credit > 0 ? formatPeso(line.credit) : ''}
                      </Table.Td>
                      <Table.Td>{line.description}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
});
