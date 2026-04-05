'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiPath } from '@/lib/api/paths';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { logger } from '@/lib/logger';
import { PageLayout } from '@/components/layout/PageLayout';
import { normalizePayrollCutoffDays } from '@/modules/shared/employees/automation/payrollCutoffDays';
import type {
  EmployeeAutomationOverview,
  EmployeeAutomationRunRecord,
  EmployeeAutomationSettings,
  EmployeeAutomationSettingsUpdate,
  EmployeeAutomationType,
} from '@/modules/shared/employees/automation/types';
import {
  Alert,
  Badge,
  Button,
  Card,
  CloseButton,
  Group,
  LoadingOverlay,
  NumberInput,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconAlertCircle,
  IconBolt,
  IconCheck,
  IconHistory,
  IconReceipt,
  IconUsers,
} from '@tabler/icons-react';

const SETTINGS_API_PATH = '/employee-automation-settings';

const FALLBACK_SETTINGS: EmployeeAutomationSettings = {
  stayInAutoPresenceEnabled: true,
  stayInAutoPresenceTime: '02:00',
  stayInAutoPresenceTimezone: 'Asia/Manila',
  stayInAutoPresenceGraceMinutes: 0,
  payrollAutoGenerationEnabled: false,
  payrollAutoGenerationTime: '02:00',
  payrollAutoGenerationTimezone: 'Asia/Manila',
  payrollAutoGenerationCutoffDays: [],
};

const AUTOMATION_LABELS: Record<EmployeeAutomationType, string> = {
  'stay-in-attendance': 'Stay-in Attendance',
  'payroll-generation': 'Payroll Generation',
};

const END_OF_MONTH_CUTOFF_DAY = 31;

type SettingsKey = keyof EmployeeAutomationSettings;

type EmployeeAutomationSettingsPageProps = {
  apiBasePath?: string;
  embedded?: boolean;
};

function areCutoffDaysEqual(left: number[], right: number[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function formatOrdinal(value: number) {
  const modTen = value % 10;
  const modHundred = value % 100;

  if (modTen === 1 && modHundred !== 11) {
    return `${value}st`;
  }

  if (modTen === 2 && modHundred !== 12) {
    return `${value}nd`;
  }

  if (modTen === 3 && modHundred !== 13) {
    return `${value}rd`;
  }

  return `${value}th`;
}

function formatCutoffDayLabel(value: number) {
  if (value === END_OF_MONTH_CUTOFF_DAY) {
    return 'End of month';
  }

  return formatOrdinal(value);
}

function formatCutoffSummary(cutoffDays: number[]) {
  if (cutoffDays.length === 0) {
    return 'No cutoff dates configured yet.';
  }

  return cutoffDays.map((day) => formatCutoffDayLabel(day)).join(', ');
}

function getStatusColor(status: EmployeeAutomationRunRecord['status']) {
  if (status === 'success') {
    return 'green';
  }

  if (status === 'error') {
    return 'red';
  }

  return 'yellow';
}

function getTriggerColor(
  triggerSource: EmployeeAutomationRunRecord['triggerSource']
) {
  return triggerSource === 'manual' ? 'blue' : 'gray';
}

function formatRunTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function formatRunTarget(run: EmployeeAutomationRunRecord) {
  if (run.automationType === 'stay-in-attendance') {
    return run.targetDate ?? 'Not specified';
  }

  if (run.payrollPeriodStart && run.payrollPeriodEnd) {
    return `${run.payrollPeriodStart} to ${run.payrollPeriodEnd}`;
  }

  return run.periodKey ?? 'Not specified';
}

function buildUpdatePayload(
  initial: EmployeeAutomationSettings | null,
  draft: EmployeeAutomationSettings
): EmployeeAutomationSettingsUpdate {
  const payload: EmployeeAutomationSettingsUpdate = {};

  if (
    !initial ||
    draft.stayInAutoPresenceEnabled !== initial.stayInAutoPresenceEnabled
  ) {
    payload.stayInAutoPresenceEnabled = draft.stayInAutoPresenceEnabled;
  }

  if (
    !initial ||
    draft.stayInAutoPresenceTime !== initial.stayInAutoPresenceTime
  ) {
    payload.stayInAutoPresenceTime = draft.stayInAutoPresenceTime;
  }

  if (
    !initial ||
    draft.stayInAutoPresenceTimezone !== initial.stayInAutoPresenceTimezone
  ) {
    payload.stayInAutoPresenceTimezone = draft.stayInAutoPresenceTimezone;
  }

  if (
    !initial ||
    draft.stayInAutoPresenceGraceMinutes !==
      initial.stayInAutoPresenceGraceMinutes
  ) {
    payload.stayInAutoPresenceGraceMinutes =
      draft.stayInAutoPresenceGraceMinutes;
  }

  if (
    !initial ||
    draft.payrollAutoGenerationEnabled !== initial.payrollAutoGenerationEnabled
  ) {
    payload.payrollAutoGenerationEnabled = draft.payrollAutoGenerationEnabled;
  }

  if (
    !initial ||
    draft.payrollAutoGenerationTime !== initial.payrollAutoGenerationTime
  ) {
    payload.payrollAutoGenerationTime = draft.payrollAutoGenerationTime;
  }

  if (
    !initial ||
    draft.payrollAutoGenerationTimezone !==
      initial.payrollAutoGenerationTimezone
  ) {
    payload.payrollAutoGenerationTimezone = draft.payrollAutoGenerationTimezone;
  }

  if (
    !initial ||
    !areCutoffDaysEqual(
      draft.payrollAutoGenerationCutoffDays,
      initial.payrollAutoGenerationCutoffDays
    )
  ) {
    payload.payrollAutoGenerationCutoffDays =
      draft.payrollAutoGenerationCutoffDays;
  }

  return payload;
}

export function EmployeeAutomationSettingsPage({
  apiBasePath,
  embedded,
}: EmployeeAutomationSettingsPageProps) {
  const settingsApiPath = buildApiPath(apiBasePath, SETTINGS_API_PATH);
  const [draft, setDraft] =
    useState<EmployeeAutomationSettings>(FALLBACK_SETTINGS);
  const [initial, setInitial] = useState<EmployeeAutomationSettings | null>(
    null
  );
  const [pendingPayrollCutoffDate, setPendingPayrollCutoffDate] =
    useState<Date | null>(null);
  const [history, setHistory] = useState<EmployeeAutomationRunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningType, setRunningType] = useState<EmployeeAutomationType | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(settingsApiPath, {
        cache: 'no-store',
      });

      if (!response.ok) {
        let body: { error?: string } | null = null;
        try {
          body = (await response.json()) as { error?: string };
        } catch {
          body = null;
        }

        throw new Error(body?.error ?? 'Failed to load settings.');
      }

      const data = (await response.json()) as EmployeeAutomationOverview;
      setDraft(data.settings ?? FALLBACK_SETTINGS);
      setInitial(data.settings ?? FALLBACK_SETTINGS);
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (fetchError) {
      logger.error(fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Unable to load settings.'
      );
      setDraft(FALLBACK_SETTINGS);
      setInitial(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [settingsApiPath]);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  const handleFieldChange = <K extends SettingsKey>(
    key: K,
    value: EmployeeAutomationSettings[K]
  ) => {
    setDraft((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleGraceMinutesChange = (value: string | number) => {
    if (value === '' || value === null) {
      handleFieldChange('stayInAutoPresenceGraceMinutes', 0);
      return;
    }

    const numeric =
      typeof value === 'number' ? value : Number.parseInt(value, 10) || 0;
    handleFieldChange(
      'stayInAutoPresenceGraceMinutes',
      Math.max(0, Math.min(120, Math.floor(numeric)))
    );
  };

  const handleAddPayrollCutoffDate = () => {
    if (!pendingPayrollCutoffDate) {
      return;
    }

    handleFieldChange(
      'payrollAutoGenerationCutoffDays',
      normalizePayrollCutoffDays([
        ...draft.payrollAutoGenerationCutoffDays,
        pendingPayrollCutoffDate.getDate(),
      ])
    );
    setPendingPayrollCutoffDate(null);
  };

  const handleAddEndOfMonthCutoff = () => {
    handleFieldChange(
      'payrollAutoGenerationCutoffDays',
      normalizePayrollCutoffDays([
        ...draft.payrollAutoGenerationCutoffDays,
        END_OF_MONTH_CUTOFF_DAY,
      ])
    );
    setPendingPayrollCutoffDate(null);
  };

  const handleRemovePayrollCutoffDay = (cutoffDay: number) => {
    handleFieldChange(
      'payrollAutoGenerationCutoffDays',
      draft.payrollAutoGenerationCutoffDays.filter((day) => day !== cutoffDay)
    );
  };

  const hasChanges = useMemo(() => {
    if (!initial) {
      return true;
    }

    return (
      initial.stayInAutoPresenceEnabled !== draft.stayInAutoPresenceEnabled ||
      initial.stayInAutoPresenceTime !== draft.stayInAutoPresenceTime ||
      initial.stayInAutoPresenceTimezone !== draft.stayInAutoPresenceTimezone ||
      initial.stayInAutoPresenceGraceMinutes !==
        draft.stayInAutoPresenceGraceMinutes ||
      initial.payrollAutoGenerationEnabled !==
        draft.payrollAutoGenerationEnabled ||
      initial.payrollAutoGenerationTime !== draft.payrollAutoGenerationTime ||
      initial.payrollAutoGenerationTimezone !==
        draft.payrollAutoGenerationTimezone ||
      !areCutoffDaysEqual(
        initial.payrollAutoGenerationCutoffDays,
        draft.payrollAutoGenerationCutoffDays
      )
    );
  }, [draft, initial]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hasChanges) {
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = buildUpdatePayload(initial, draft);
      const response = await fetch(settingsApiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as
        | EmployeeAutomationSettings
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          body && 'error' in body && typeof body.error === 'string'
            ? body.error
            : 'Failed to update settings.'
        );
      }

      const updated = body as EmployeeAutomationSettings;
      setDraft(updated);
      setInitial(updated);
      setSuccess('Automation settings updated successfully.');
    } catch (submitError) {
      logger.error(submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to update settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRunAutomation = async (
    automationType: EmployeeAutomationType
  ) => {
    setRunningType(automationType);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(settingsApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ automationType }),
      });

      const body = (await response.json().catch(() => null)) as {
        error?: string;
        success?: boolean;
        result?: { message?: string; status?: string };
      } | null;

      if (!response.ok || body?.success === false) {
        throw new Error(
          body?.result?.message ?? body?.error ?? 'Failed to run automation.'
        );
      }

      await fetchOverview();
      setSuccess(body?.result?.message ?? 'Automation executed successfully.');
    } catch (runError) {
      logger.error(runError);
      setError(
        runError instanceof Error
          ? runError.message
          : 'Unable to run automation.'
      );
    } finally {
      setRunningType(null);
    }
  };

  const handleReset = () => {
    if (initial) {
      setDraft(initial);
    } else {
      setDraft(FALLBACK_SETTINGS);
      void fetchOverview();
    }

    setPendingPayrollCutoffDate(null);

    setError(null);
    setSuccess(null);
  };

  const busy = loading || saving || runningType !== null;

  const formElement = (
    <form onSubmit={handleSubmit}>
      <Stack gap="lg" pos="relative">
        <LoadingOverlay
          visible={busy}
          zIndex={1000}
          overlayProps={{ blur: 2 }}
        />

        {!embedded && (
          <div>
            <Text fw={700} size="xl">
              Employee Automation Settings
            </Text>
            <Text c="dimmed" size="sm">
              Configure the server-side scheduler behavior for stay-in
              attendance and payroll generation, then review recent execution
              history in one place.
            </Text>
          </div>
        )}

        {error && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
          >
            {error}
          </Alert>
        )}

        {success && (
          <Alert icon={<IconCheck size={16} />} color="green" variant="light">
            {success}
          </Alert>
        )}

        <Alert icon={<IconBolt size={16} />} color="blue" variant="light">
          Manual runs are recorded in the history table below. Payroll &quot;Run
          now&quot; targets the current payroll period, while scheduled payroll
          automation waits for the latest due cutoff date.
        </Alert>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Card withBorder radius="md" shadow="sm" p="xl">
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" align="center">
                    <IconUsers size={18} />
                    <Text fw={700} size="lg">
                      Stay-in Attendance Automation
                    </Text>
                  </Group>
                  <Text c="dimmed" size="sm" mt={4}>
                    Auto-record presence for active stay-in employees using
                    their daily schedule data.
                  </Text>
                </div>

                <Button
                  type="button"
                  variant="light"
                  onClick={() => void handleRunAutomation('stay-in-attendance')}
                  loading={runningType === 'stay-in-attendance'}
                  disabled={busy}
                >
                  Run now
                </Button>
              </Group>

              <Stack gap="md">
                <Switch
                  label="Automatically record presence for stay-in employees"
                  description="When enabled, the scheduler records stay-in employees as present at the configured run time."
                  checked={draft.stayInAutoPresenceEnabled}
                  onChange={(event) =>
                    handleFieldChange(
                      'stayInAutoPresenceEnabled',
                      event.currentTarget.checked
                    )
                  }
                />

                <Group grow align="flex-start">
                  <TextInput
                    label="Automation run time"
                    description="24-hour format"
                    placeholder="02:00"
                    type="time"
                    value={draft.stayInAutoPresenceTime}
                    onChange={(event) =>
                      handleFieldChange(
                        'stayInAutoPresenceTime',
                        event.currentTarget.value
                      )
                    }
                    required
                    disabled={!draft.stayInAutoPresenceEnabled}
                  />

                  <TextInput
                    label="Timezone"
                    description="IANA timezone identifier"
                    placeholder="Asia/Manila"
                    value={draft.stayInAutoPresenceTimezone}
                    onChange={(event) =>
                      handleFieldChange(
                        'stayInAutoPresenceTimezone',
                        event.currentTarget.value
                      )
                    }
                    required
                    disabled={!draft.stayInAutoPresenceEnabled}
                  />
                </Group>

                <NumberInput
                  label="Grace period (minutes)"
                  description="Delay the due window before treating the day as unattended."
                  min={0}
                  max={120}
                  step={5}
                  value={draft.stayInAutoPresenceGraceMinutes}
                  onChange={handleGraceMinutesChange}
                  disabled={!draft.stayInAutoPresenceEnabled}
                />
              </Stack>
            </Stack>
          </Card>

          <Card withBorder radius="md" shadow="sm" p="xl">
            <Stack gap="lg">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" align="center">
                    <IconReceipt size={18} />
                    <Text fw={700} size="lg">
                      Payroll Automation
                    </Text>
                  </Group>
                  <Text c="dimmed" size="sm" mt={4}>
                    Generate payroll using the same current-period flow as the
                    payroll page when a configured cutoff date becomes due, and
                    keep a run audit trail.
                  </Text>
                </div>

                <Button
                  type="button"
                  variant="light"
                  onClick={() => void handleRunAutomation('payroll-generation')}
                  loading={runningType === 'payroll-generation'}
                  disabled={busy}
                >
                  Run now
                </Button>
              </Group>

              <Stack gap="md">
                <Switch
                  label="Automatically generate payroll for the latest configured cutoff period"
                  description="The scheduler waits for the configured cutoff dates below, then runs the same current-period payroll generation used by the Generate Payroll button."
                  checked={draft.payrollAutoGenerationEnabled}
                  onChange={(event) =>
                    handleFieldChange(
                      'payrollAutoGenerationEnabled',
                      event.currentTarget.checked
                    )
                  }
                />

                <Group grow align="flex-start">
                  <TextInput
                    label="Payroll run time"
                    description="24-hour format"
                    placeholder="02:00"
                    type="time"
                    value={draft.payrollAutoGenerationTime}
                    onChange={(event) =>
                      handleFieldChange(
                        'payrollAutoGenerationTime',
                        event.currentTarget.value
                      )
                    }
                    required
                    disabled={!draft.payrollAutoGenerationEnabled}
                  />

                  <TextInput
                    label="Timezone"
                    description="IANA timezone identifier"
                    placeholder="Asia/Manila"
                    value={draft.payrollAutoGenerationTimezone}
                    onChange={(event) =>
                      handleFieldChange(
                        'payrollAutoGenerationTimezone',
                        event.currentTarget.value
                      )
                    }
                    required
                    disabled={!draft.payrollAutoGenerationEnabled}
                  />
                </Group>

                <Stack gap="xs">
                  <Group align="flex-end" grow>
                    <DatePickerInput
                      label="Add payroll cutoff date"
                      description="Pick example cutoff dates. Only the day of month is saved and repeated every month. Use End of month for the last calendar day."
                      placeholder="Select cutoff date"
                      value={pendingPayrollCutoffDate}
                      onChange={setPendingPayrollCutoffDate}
                      disabled={!draft.payrollAutoGenerationEnabled}
                      clearable
                      {...COMMON_DATE_INPUT_PROPS}
                    />

                    <Button
                      type="button"
                      variant="default"
                      onClick={handleAddPayrollCutoffDate}
                      disabled={
                        !draft.payrollAutoGenerationEnabled ||
                        pendingPayrollCutoffDate === null
                      }
                    >
                      Add cutoff
                    </Button>
                  </Group>

                  <Group gap="sm">
                    <Button
                      type="button"
                      variant="default"
                      onClick={handleAddEndOfMonthCutoff}
                      disabled={
                        !draft.payrollAutoGenerationEnabled ||
                        draft.payrollAutoGenerationCutoffDays.includes(
                          END_OF_MONTH_CUTOFF_DAY
                        )
                      }
                    >
                      Add end of month
                    </Button>

                    <Text c="dimmed" size="sm">
                      This stores an internal cutoff marker of 31 and runs on
                      the last day of shorter months automatically.
                    </Text>
                  </Group>

                  <Text c="dimmed" size="sm">
                    Saved monthly cutoff dates:{' '}
                    {formatCutoffSummary(draft.payrollAutoGenerationCutoffDays)}
                  </Text>

                  {draft.payrollAutoGenerationCutoffDays.length > 0 && (
                    <Group gap="xs">
                      {draft.payrollAutoGenerationCutoffDays.map(
                        (cutoffDay) => (
                          <Badge
                            key={cutoffDay}
                            color="blue"
                            variant="light"
                            size="lg"
                            rightSection={
                              <CloseButton
                                aria-label={`Remove ${formatCutoffDayLabel(cutoffDay)} cutoff`}
                                onClick={() =>
                                  handleRemovePayrollCutoffDay(cutoffDay)
                                }
                                size="sm"
                                disabled={!draft.payrollAutoGenerationEnabled}
                              />
                            }
                          >
                            {formatCutoffDayLabel(cutoffDay)}
                          </Badge>
                        )
                      )}
                    </Group>
                  )}
                </Stack>

                <Alert color="gray" variant="light">
                  This automation follows the existing payroll generation flow.
                  When a configured cutoff date becomes due, it generates the
                  same current payroll period the Payroll page would generate if
                  someone clicked Generate Payroll that day.
                </Alert>
              </Stack>
            </Stack>
          </Card>
        </SimpleGrid>

        <Card withBorder radius="md" shadow="sm" p="xl">
          <Stack gap="md">
            <Group gap="xs">
              <IconHistory size={18} />
              <Text fw={700} size="lg">
                Recent Automation History
              </Text>
            </Group>

            {history.length === 0 ? (
              <Text c="dimmed" size="sm">
                No automation runs have been recorded yet.
              </Text>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>When</Table.Th>
                      <Table.Th>Automation</Table.Th>
                      <Table.Th>Trigger</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Target</Table.Th>
                      <Table.Th>Summary</Table.Th>
                      <Table.Th>Actor</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {history.map((run) => (
                      <Table.Tr key={run.id}>
                        <Table.Td>
                          <Text size="sm">
                            {formatRunTimestamp(run.createdAt)}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {AUTOMATION_LABELS[run.automationType]}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={getTriggerColor(run.triggerSource)}
                            variant="light"
                          >
                            {run.triggerSource}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Badge
                            color={getStatusColor(run.status)}
                            variant="light"
                          >
                            {run.status}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{formatRunTarget(run)}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text size="sm">
                              {run.message ?? 'No summary available.'}
                            </Text>
                            <Text c="dimmed" size="xs">
                              Processed {run.processed} | Inserted{' '}
                              {run.inserted} | Skipped {run.skipped}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {run.triggeredByUserName ?? 'System'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Stack>
        </Card>

        <Group justify="flex-end">
          <Button
            type="button"
            variant="default"
            onClick={handleReset}
            disabled={busy || (!hasChanges && !error && !success)}
          >
            Reset
          </Button>
          <Button type="submit" disabled={!hasChanges || busy}>
            Save changes
          </Button>
        </Group>
      </Stack>
    </form>
  );

  if (embedded) {
    return formElement;
  }

  return (
    <PageLayout fluid withPadding>
      {formElement}
    </PageLayout>
  );
}
