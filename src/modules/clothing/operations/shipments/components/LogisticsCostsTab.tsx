'use client';

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { randomUuid } from '@/lib/utils/randomUuid';
import { toISODate } from '@/utils/date';
import type { ShipmentData } from '../types/shipment.types';
import {
  getLogisticsBalances,
  logisticsAmountLimit,
  parseLogisticsLineKey,
  type LogisticsVendor,
  type LogisticsAction,
} from '../lib/logisticsCosts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
  id: string | number;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string | null;
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
    label: 'Record Actual Cost',
    shortLabel: 'Actual Cost',
    description: 'Record the confirmed actual logistics charge.',
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
    description:
      'Correct an actual charge before it has been paid or capitalized.',
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
    accrue: 'Actual logistics cost recorded',
    pay: 'Logistics payable paid',
    capitalize: 'Logistics cost capitalized (delivered)',
    'adjust-down': 'Actual logistics cost corrected down',
  };

  return [code, input.vendor, actionLabel[input.action]]
    .filter(Boolean)
    .join(' • ');
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

  for (const line of lines) {
    const identity = parseLogisticsLineKey(line.sourceLineKey);
    if (
      line.sourceType === 'SHIPMENT_LOGISTICS' &&
      identity?.vendor === vendor &&
      identity.side === 'debit'
    ) {
      const step = result[identity.action];
      step.done = true;
      step.amount += line.debit;
      step.date = line.date.slice(0, 10);
    }
  }
  const balances = getLogisticsBalances(lines, vendor);
  result.accrue.amount = balances.actual;
  result.pay.done = balances.actual > 0 && balances.payable <= 0;
  result.capitalize.done = balances.actual > 0 && balances.clearing <= 0;
  return result;
}

function getNextRecommendedAction(
  steps: Record<LogisticsAction, StepStatus>,
  isDelivered: boolean
): LogisticsAction {
  if (!steps.accrue.done) {
    return 'accrue';
  }
  if (!steps.pay.done) {
    return 'pay';
  }
  if (isDelivered && !steps.capitalize.done) {
    return 'capitalize';
  }
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
      Array.from(
        new Map(
          shipments
            .map((s) => {
              const code = (s['Shipment Code'] ?? '').trim();
              return {
                value: code,
                label: code,
              };
            })
            .filter((opt) => opt.value)
            .map((opt) => [opt.value, opt])
        ).values()
      ).sort((a, b) => a.value.localeCompare(b.value)),
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
  const [historyLoadedFor, setHistoryLoadedFor] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [requiresReview, setRequiresReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const historyRequest = useRef(0);
  const submitLock = useRef(false);
  const pendingPost = useRef<{ signature: string; requestId: string } | null>(
    null
  );
  const invalidateHistoryRequests = useCallback(() => {
    historyRequest.current++;
  }, []);

  const fetchHistory = useCallback(
    async (shipmentId: number) => {
      const version = ++historyRequest.current;
      setHistoryLoading(true);
      setHistoryLoadedFor(null);
      setJournalLines([]);
      setHistoryError(false);
      setRequiresReview(false);
      try {
        const res = await fetch(
          buildApiPath(
            apiBasePath,
            `/accounting/shipment-logistics?shipmentId=${shipmentId}`
          )
        );
        if (!res.ok) {
          throw new Error('Could not load logistics history');
        }
        const body = await res.json();
        if (!Array.isArray(body.data?.lines)) {
          throw new Error('Invalid logistics history');
        }
        if (version !== historyRequest.current) {
          return;
        }
        setJournalLines(body.data.lines);
        setRequiresReview(Boolean(body.data.requiresReview));
        setHistoryLoadedFor(shipmentId);
      } catch (error) {
        logger.warn('Failed to fetch journal history', { error });
        if (version === historyRequest.current) {
          setHistoryError(true);
        }
      } finally {
        if (version === historyRequest.current) {
          setHistoryLoading(false);
        }
      }
    },
    [apiBasePath]
  );

  // Fetch history when shipment code changes
  useEffect(() => {
    if (selectedShipment) {
      void fetchHistory(selectedShipment.id);
    } else {
      setJournalLines([]);
      setHistoryLoadedFor(null);
    }
    return invalidateHistoryRequests;
  }, [
    selectedShipment,
    fetchHistory,
    historyVersion,
    invalidateHistoryRequests,
  ]);

  // ---- Step detection ----

  const completedSteps = useMemo(
    () => detectCompletedSteps(journalLines, form.values.vendor),
    [journalLines, form.values.vendor]
  );
  const balances = getLogisticsBalances(journalLines, form.values.vendor);

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

  // ---- Stepper active index ----

  const stepperActive = useMemo(() => {
    // The stepper shows 3 main steps: accrue → pay → capitalize
    // Adjust-down is optional and not part of the main flow
    if (completedSteps.capitalize.done) {
      return 3;
    }
    if (completedSteps.pay.done) {
      return 2;
    }
    if (completedSteps.accrue.done) {
      return 1;
    }
    return 0;
  }, [completedSteps]);

  // ---- Submit ----

  const submit = async (values: LogisticsCostsFormValues) => {
    const postingDate = values.postingDate;
    if (
      !postingDate ||
      !selectedShipment ||
      submitLock.current ||
      historyLoadedFor !== selectedShipment.id ||
      requiresReview
    ) {
      return;
    }

    if (values.action === 'capitalize' && !delivered) {
      return;
    }

    const description = values.description?.trim()
      ? values.description.trim()
      : buildDefaultDescription({
          shipmentCode: values.shipmentCode,
          vendor: values.vendor,
          action: values.action,
        });

    const payload = {
      shipmentId: selectedShipment.id,
      vendor: values.vendor,
      action: values.action,
      date: toISODate(postingDate),
      ref: values.ref.trim(),
      clearingAccount: accountConfig.clearingAccount,
      payableAccount: getPayableAccount(values.vendor, accountConfig),
      amount: Number(values.amount),
      description,
    };

    submitLock.current = true;
    setSubmitting(true);
    const storageKey = `clothing.logistics.pending.${selectedShipment.id}.${values.vendor}`;
    const signature = JSON.stringify(payload);
    try {
      try {
        const saved = JSON.parse(
          window.sessionStorage.getItem(storageKey) || 'null'
        );
        if (
          saved?.signature === signature &&
          typeof saved.requestId === 'string'
        ) {
          pendingPost.current = saved;
        }
      } catch (error) {
        logger.warn('Could not restore pending logistics request', { error });
      }
      if (pendingPost.current?.signature !== signature) {
        pendingPost.current = {
          signature,
          requestId: randomUuid(),
        };
      }
      try {
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify(pendingPost.current)
        );
      } catch (error) {
        logger.warn('Could not persist pending logistics request', { error });
      }
      const res = await fetch(
        buildApiPath(apiBasePath, '/accounting/shipment-logistics'),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            requestId: pendingPost.current.requestId,
          }),
        }
      );

      const responseBody = await res.json().catch(() => null);
      if (!res.ok) {
        const errorMessage =
          responseBody?.error || 'Failed to save logistics journal entry';
        throw new Error(errorMessage);
      }
      pendingPost.current = null;
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch (error) {
        logger.warn('Could not clear completed logistics request', { error });
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
      setHistoryLoadedFor(null);
      setHistoryVersion((v) => v + 1);
    } catch (error) {
      logger.error('Logistics manual journal save failed', { error });
      showNotification({
        color: 'red',
        title: 'Could not save entry',
        message:
          error instanceof Error ? error.message : 'Unexpected error occurred',
      });
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  // ---- Determine which actions should be disabled ----

  const actionDisabled: Record<LogisticsAction, string | false> = {
    accrue: false,
    pay: balances.payable <= 0 ? 'No remaining actual payable.' : false,
    capitalize: !delivered
      ? `Shipment status is "${selectedShipment?.['Shipment Status'] ?? 'Unknown'}" — must be Delivered.`
      : balances.clearing <= 0
        ? 'No remaining actual cost to capitalize.'
        : false,
    'adjust-down':
      logisticsAmountLimit('adjust-down', balances) <= 0
        ? 'No unpaid, uncapitalized actual cost to correct.'
        : false,
  };

  // ---- Render ----

  return (
    <Paper withBorder radius="md" p="md">
      <Stack gap="md">
        {requiresReview && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Existing journals require review"
            color="yellow"
          >
            Guided posting is locked for this shipment. Existing manual journals
            have not been changed.
          </Alert>
        )}
        {historyError && (
          <Alert color="red" title="Logistics history unavailable">
            <Button
              variant="subtle"
              onClick={() => setHistoryVersion((version) => version + 1)}
            >
              Retry
            </Button>
          </Alert>
        )}

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
          <fieldset
            disabled={submitting}
            style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
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
                        Forwarder pricing estimate
                      </Text>
                      <Text
                        size="sm"
                        fw={form.values.vendor === 'Forwarder' ? 700 : 400}
                        c={
                          form.values.vendor === 'Forwarder'
                            ? 'blue'
                            : undefined
                        }
                      >
                        {formatPeso(
                          selectedShipment.linkedProductForwardersFee ?? 0
                        )}
                      </Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed">
                        Courier pricing estimate
                      </Text>
                      <Text
                        size="sm"
                        fw={form.values.vendor === 'Courier' ? 700 : 400}
                        c={
                          form.values.vendor === 'Courier' ? 'blue' : undefined
                        }
                      >
                        {formatPeso(
                          selectedShipment.linkedProductLalamove ?? 0
                        )}
                      </Text>
                    </Box>
                    <Box>
                      <Text size="xs" c="dimmed">
                        Packaging pricing estimate
                      </Text>
                      <Text
                        size="sm"
                        fw={form.values.vendor === 'Packaging' ? 700 : 400}
                        c={
                          form.values.vendor === 'Packaging'
                            ? 'blue'
                            : undefined
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
                      {(
                        ['accrue', 'pay', 'capitalize'] as LogisticsAction[]
                      ).map((action) => {
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
                      })}
                    </Stepper>
                  )}
                </>
              )}

              {/* ---- Action selector ---- */}
              <Box>
                <Group gap="lg" mb="sm">
                  <Text size="sm">Actual: {formatPeso(balances.actual)}</Text>
                  <Text size="sm">Unpaid: {formatPeso(balances.payable)}</Text>
                  <Text size="sm">
                    Uncapitalized: {formatPeso(balances.clearing)}
                  </Text>
                </Group>
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
                            form.setFieldValue('amount', 0);
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
                  label="Actual Amount"
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
                  loading={submitting}
                  disabled={
                    !selectedShipment ||
                    historyLoadedFor !== selectedShipment.id ||
                    requiresReview ||
                    Boolean(actionDisabled[form.values.action])
                  }
                >
                  Post Entry
                </Button>
              </Group>
            </Stack>
          </fieldset>
        </form>

        {/* ---- Posting history panel ---- */}
        {form.values.shipmentCode && (
          <>
            <Divider
              label="Posting history for this shipment"
              labelPosition="center"
            />
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
