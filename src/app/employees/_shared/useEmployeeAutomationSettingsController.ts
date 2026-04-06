'use client';

import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildApiPath } from '@/lib/api/paths';
import { logger } from '@/lib/logger';
import { normalizePayrollCutoffDays } from '@/modules/shared/employees/automation/payrollCutoffDays';
import type {
  EmployeeAutomationOverview,
  EmployeeAutomationRunRecord,
  EmployeeAutomationSettings,
  EmployeeAutomationType,
} from '@/modules/shared/employees/automation/types';
import {
  buildUpdatePayload,
  END_OF_MONTH_CUTOFF_DAY,
  FALLBACK_SETTINGS,
  SETTINGS_API_PATH,
  type SettingsKey,
  areCutoffDaysEqual,
} from './employeeAutomationSettingsUtils';

export function useEmployeeAutomationSettingsController(apiBasePath?: string) {
  const settingsApiPath = useMemo(
    () => buildApiPath(apiBasePath, SETTINGS_API_PATH),
    [apiBasePath]
  );
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

  return {
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
    busy: loading || saving || runningType !== null,
    loading,
    pendingPayrollCutoffDate,
    runningType,
    saving,
    setPendingPayrollCutoffDate,
    success,
  };
}
