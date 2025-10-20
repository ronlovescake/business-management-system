'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Group,
  LoadingOverlay,
  NumberInput,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { PageLayout } from '../../../../components/layout/PageLayout';
import type {
  EmployeeAutomationSettings,
  EmployeeAutomationSettingsUpdate,
} from '@/lib/settings/employeeAutomation';

const FALLBACK_SETTINGS: EmployeeAutomationSettings = {
  stayInAutoPresenceEnabled: true,
  stayInAutoPresenceTime: '02:00',
  stayInAutoPresenceTimezone: 'Asia/Manila',
  stayInAutoPresenceGraceMinutes: 0,
};

type SettingsKey = keyof EmployeeAutomationSettings;

const SETTINGS_API_PATH = '/api/employee-automation-settings';

export default function EmployeeSettings() {
  const [draft, setDraft] =
    useState<EmployeeAutomationSettings>(FALLBACK_SETTINGS);
  const [initial, setInitial] = useState<EmployeeAutomationSettings | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(SETTINGS_API_PATH, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to load settings.');
      }

      const data = (await response.json()) as EmployeeAutomationSettings;
      setDraft(data);
      setInitial(data);
    } catch (fetchError) {
      console.error(fetchError);
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Unable to load settings.'
      );
      setDraft(FALLBACK_SETTINGS);
      setInitial(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  const handleFieldChange = <K extends SettingsKey>(
    key: K,
    value: EmployeeAutomationSettings[K]
  ) => {
    setDraft((prev) => ({
      ...prev,
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
    const sanitized = Math.max(0, Math.min(120, Math.floor(numeric)));

    handleFieldChange('stayInAutoPresenceGraceMinutes', sanitized);
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
        draft.stayInAutoPresenceGraceMinutes
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

      const response = await fetch(SETTINGS_API_PATH, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? 'Failed to update settings.');
      }

      const updated = (await response.json()) as EmployeeAutomationSettings;
      setDraft(updated);
      setInitial(updated);
      setSuccess('Automation settings updated successfully.');
    } catch (submitError) {
      console.error(submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to update settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (initial) {
      setDraft(initial);
    } else {
      setDraft(FALLBACK_SETTINGS);
      void fetchSettings();
    }
    setSuccess(null);
    setError(null);
  };

  return (
    <PageLayout title="Settings">
      <form onSubmit={handleSubmit}>
        <Card
          withBorder
          radius="md"
          shadow="sm"
          p="xl"
          style={{ position: 'relative' }}
        >
          <LoadingOverlay
            visible={loading || saving || running}
            zIndex={1000}
            overlayProps={{ blur: 2 }}
          />

          <Stack gap="lg">
            <div>
              <Text fw={700} size="lg">
                Stay-in Attendance Automation
              </Text>
              <Text c="dimmed" size="sm">
                Configure when the system auto-records presence for stay-in
                employees.
              </Text>
            </div>

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
              <Alert
                icon={<IconCheck size={16} />}
                color="green"
                variant="light"
              >
                {success}
              </Alert>
            )}

            <Stack gap="md">
              <Switch
                label="Automatically record presence for stay-in employees"
                description="When enabled, the system records stay-in employees as present at the scheduled time."
                checked={draft.stayInAutoPresenceEnabled}
                onChange={(event) =>
                  handleFieldChange(
                    'stayInAutoPresenceEnabled',
                    event.currentTarget.checked
                  )
                }
              />

              <Group grow>
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
                />
              </Group>

              <NumberInput
                label="Grace period (minutes)"
                description="Allow a short delay before marking the shift as unattended."
                min={0}
                max={120}
                step={5}
                value={draft.stayInAutoPresenceGraceMinutes}
                onChange={handleGraceMinutesChange}
              />
            </Stack>

            <Group justify="flex-end">
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  setError(null);
                  setSuccess(null);
                  setRunning(true);

                  try {
                    const response = await fetch(SETTINGS_API_PATH, {
                      method: 'POST',
                    });

                    if (!response.ok) {
                      const data = (await response
                        .json()
                        .catch(() => null)) as { error?: string } | null;
                      throw new Error(
                        data?.error ?? 'Failed to run automation.'
                      );
                    }

                    const data = (await response.json()) as {
                      success?: boolean;
                      result?: {
                        processed?: number;
                        inserted?: number;
                        skipped?: number;
                        message?: string;
                      };
                    };

                    const summaryParts: string[] = [];
                    if (typeof data.result?.processed === 'number') {
                      summaryParts.push(`processed ${data.result.processed}`);
                    }
                    if (typeof data.result?.inserted === 'number') {
                      summaryParts.push(`added ${data.result.inserted}`);
                    }
                    if (typeof data.result?.skipped === 'number') {
                      summaryParts.push(`skipped ${data.result.skipped}`);
                    }

                    const summary = summaryParts.length
                      ? summaryParts.join(', ')
                      : undefined;

                    await fetchSettings();

                    setSuccess(
                      data.result?.message ??
                        summary ??
                        'Automation executed successfully.'
                    );
                  } catch (runError) {
                    console.error(runError);
                    setError(
                      runError instanceof Error
                        ? runError.message
                        : 'Unable to run automation.'
                    );
                  } finally {
                    setRunning(false);
                  }
                }}
                disabled={running}
              >
                Run automation now
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={handleReset}
                disabled={
                  loading ||
                  saving ||
                  running ||
                  (!hasChanges && !error && !success)
                }
              >
                Reset
              </Button>
              <Button type="submit" disabled={!hasChanges || saving || running}>
                Save changes
              </Button>
            </Group>
          </Stack>
        </Card>
      </form>
    </PageLayout>
  );
}
