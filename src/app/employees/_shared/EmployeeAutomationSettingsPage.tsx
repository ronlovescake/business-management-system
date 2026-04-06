'use client';

import React from 'react';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { PageLayout } from '@/components/layout/PageLayout';
import { EmployeeAutomationHistoryCard } from '@/app/employees/_shared/EmployeeAutomationHistoryCard';
import { useEmployeeAutomationSettingsController } from '@/app/employees/_shared/useEmployeeAutomationSettingsController';
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
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import {
  IconAlertCircle,
  IconBolt,
  IconCheck,
  IconReceipt,
  IconUsers,
} from '@tabler/icons-react';
import {
  END_OF_MONTH_CUTOFF_DAY,
  formatCutoffDayLabel,
  formatCutoffSummary,
} from './employeeAutomationSettingsUtils';

type EmployeeAutomationSettingsPageProps = {
  apiBasePath?: string;
  embedded?: boolean;
};

export function EmployeeAutomationSettingsPage({
  apiBasePath,
  embedded,
}: EmployeeAutomationSettingsPageProps) {
  const {
    busy,
    draft,
    error,
    handleAddEndOfMonthCutoff,
    handleAddPayrollCutoffDate,
    handleFieldChange,
    handleGraceMinutesChange,
    handleRemovePayrollCutoffDay,
    handleReset,
    handleRunAutomation,
    handleSubmit,
    hasChanges,
    history,
    pendingPayrollCutoffDate,
    runningType,
    setPendingPayrollCutoffDate,
    success,
  } = useEmployeeAutomationSettingsController(apiBasePath);

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

        <EmployeeAutomationHistoryCard history={history} />

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
