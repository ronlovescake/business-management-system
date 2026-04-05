import {
  getGeneralMerchandiseEmployeeAutomationSettings,
  hasGeneralMerchandiseEmployeeAutomationRunForPeriod,
} from '@/lib/settings/generalMerchandiseEmployeeAutomation';
import {
  getEmployeeAutomationSettings,
  hasEmployeeAutomationRunForPeriod,
} from '@/lib/settings/employeeAutomation';
import {
  getTruckingEmployeeAutomationSettings,
  hasTruckingEmployeeAutomationRunForPeriod,
} from '@/lib/settings/truckingEmployeeAutomation';
import { runStayInAutoPresenceAutomation } from '@/lib/automation/stayInAutoPresence';
import { runGeneralMerchandiseStayInAutoPresenceAutomation } from '@/lib/automation/stayInAutoPresenceGeneralMerchandise';
import { runTruckingStayInAutoPresenceAutomation } from '@/lib/automation/stayInAutoPresenceTrucking';
import { invokePayrollGenerationRoute } from './payrollRouteInvoker';
import {
  getDueStayInAutomationTarget,
  getDuePayrollAutomationPeriod,
  getStayInBackfillDateRange,
} from './scheduling';
import { STAY_IN_ATTENDANCE_LOOKBACK_DAYS } from './stayInBackfill';
import type {
  EmployeeAutomationExecutionResult,
  EmployeeAutomationSettings,
} from './types';

export type EmployeeAutomationDomain =
  | 'clothing'
  | 'trucking'
  | 'general-merchandise';

type RunCheck = (periodKey: string) => Promise<boolean>;

type SkipReason = 'disabled' | 'already-recorded-run';

function buildSkippedResult(
  automationType: EmployeeAutomationExecutionResult['automationType'],
  message: string,
  extras?: Partial<EmployeeAutomationExecutionResult> & {
    skipReason?: SkipReason;
  }
): EmployeeAutomationExecutionResult {
  return {
    automationType,
    status: 'skipped',
    message,
    processed: 0,
    inserted: 0,
    skipped: 0,
    ...(extras?.skipReason
      ? { metadata: { skipReason: extras.skipReason } }
      : {}),
    ...extras,
  };
}

async function getSettingsForDomain(
  domain: EmployeeAutomationDomain
): Promise<EmployeeAutomationSettings> {
  if (domain === 'trucking') {
    return getTruckingEmployeeAutomationSettings();
  }

  if (domain === 'general-merchandise') {
    return getGeneralMerchandiseEmployeeAutomationSettings();
  }

  return getEmployeeAutomationSettings();
}

async function runStayInAutomationForDate(params: {
  domain: EmployeeAutomationDomain;
  settings: EmployeeAutomationSettings;
  targetDate: string;
}): Promise<EmployeeAutomationExecutionResult> {
  const result =
    params.domain === 'trucking'
      ? await runTruckingStayInAutoPresenceAutomation({
          settings: params.settings,
          targetDate: params.targetDate,
        })
      : params.domain === 'general-merchandise'
        ? await runGeneralMerchandiseStayInAutoPresenceAutomation({
            settings: params.settings,
            targetDate: params.targetDate,
          })
        : await runStayInAutoPresenceAutomation({
            settings: params.settings,
            targetDate: params.targetDate,
          });

  return {
    automationType: 'stay-in-attendance',
    status: (result.inserted ?? 0) > 0 ? 'success' : 'skipped',
    message:
      result.message ??
      `Stay-in attendance automation completed for ${result.targetDate ?? params.targetDate}.`,
    processed: result.processed ?? 0,
    inserted: result.inserted ?? 0,
    skipped: result.skipped ?? 0,
    periodKey: result.targetDate ?? params.targetDate,
    targetDate: result.targetDate ?? params.targetDate,
    metadata: result,
  };
}

function getStayInRunCheck(domain: EmployeeAutomationDomain): RunCheck {
  if (domain === 'trucking') {
    return (periodKey) =>
      hasTruckingEmployeeAutomationRunForPeriod(
        'stay-in-attendance',
        periodKey
      );
  }

  if (domain === 'general-merchandise') {
    return (periodKey) =>
      hasGeneralMerchandiseEmployeeAutomationRunForPeriod(
        'stay-in-attendance',
        periodKey
      );
  }

  return (periodKey) =>
    hasEmployeeAutomationRunForPeriod('stay-in-attendance', periodKey);
}

function getPayrollRunCheck(domain: EmployeeAutomationDomain): RunCheck {
  if (domain === 'trucking') {
    return (periodKey) =>
      hasTruckingEmployeeAutomationRunForPeriod(
        'payroll-generation',
        periodKey
      );
  }

  if (domain === 'general-merchandise') {
    return (periodKey) =>
      hasGeneralMerchandiseEmployeeAutomationRunForPeriod(
        'payroll-generation',
        periodKey
      );
  }

  return (periodKey) =>
    hasEmployeeAutomationRunForPeriod('payroll-generation', periodKey);
}

export async function executeStayInAutomation(params: {
  domain: EmployeeAutomationDomain;
  settings?: EmployeeAutomationSettings;
  skipIfAlreadyRecorded?: boolean;
  backfillLookbackDays?: number;
}): Promise<EmployeeAutomationExecutionResult> {
  const settings =
    params.settings ?? (await getSettingsForDomain(params.domain));

  if (!settings.stayInAutoPresenceEnabled) {
    return buildSkippedResult(
      'stay-in-attendance',
      'Stay-in attendance automation is disabled.',
      {
        skipReason: 'disabled',
      }
    );
  }

  const singleTarget = !params.backfillLookbackDays
    ? getDueStayInAutomationTarget({
        scheduleTime: settings.stayInAutoPresenceTime,
        timezone: settings.stayInAutoPresenceTimezone,
        graceMinutes: settings.stayInAutoPresenceGraceMinutes,
      })
    : null;

  const backfillTarget = params.backfillLookbackDays
    ? getStayInBackfillDateRange({
        scheduleTime: settings.stayInAutoPresenceTime,
        timezone: settings.stayInAutoPresenceTimezone,
        graceMinutes: settings.stayInAutoPresenceGraceMinutes,
        lookbackDays: params.backfillLookbackDays,
      })
    : null;

  const target = backfillTarget ?? singleTarget;

  if (!target) {
    return buildSkippedResult(
      'stay-in-attendance',
      'Stay-in attendance automation could not resolve a target date.'
    );
  }

  if (params.skipIfAlreadyRecorded) {
    const alreadyRecorded = await getStayInRunCheck(params.domain)(
      target.periodKey
    );

    if (alreadyRecorded) {
      return buildSkippedResult(
        'stay-in-attendance',
        `Stay-in attendance automation already ran for ${target.targetDate}.`,
        {
          skipReason: 'already-recorded-run',
          periodKey: target.periodKey,
          targetDate: target.targetDate,
        }
      );
    }
  }

  if (backfillTarget) {
    const dateRange = [...backfillTarget.dateRange].reverse();
    const results: EmployeeAutomationExecutionResult[] = [];

    for (const date of dateRange) {
      results.push(
        await runStayInAutomationForDate({
          domain: params.domain,
          settings,
          targetDate: date,
        })
      );
    }

    const aggregated = results.reduce(
      (accumulator, result) => ({
        processed: accumulator.processed + (result.processed ?? 0),
        inserted: accumulator.inserted + (result.inserted ?? 0),
        skipped: accumulator.skipped + (result.skipped ?? 0),
      }),
      { processed: 0, inserted: 0, skipped: 0 }
    );

    const oldestDate = dateRange[0] ?? backfillTarget.targetDate;
    const successfulDays = results.filter(
      (result) => (result.inserted ?? 0) > 0
    ).length;

    return {
      automationType: 'stay-in-attendance',
      status: aggregated.inserted > 0 ? 'success' : 'skipped',
      message:
        aggregated.inserted > 0
          ? `Auto-recorded stay-in attendance catch-up for ${oldestDate} to ${backfillTarget.targetDate}: ${aggregated.inserted} recorded across ${successfulDays} day(s), ${aggregated.skipped} skipped.`
          : `No stay-in attendance catch-up entries were needed for ${oldestDate} to ${backfillTarget.targetDate}. Checked ${dateRange.length} day(s).`,
      processed: aggregated.processed,
      inserted: aggregated.inserted,
      skipped: aggregated.skipped,
      periodKey: backfillTarget.periodKey,
      targetDate: backfillTarget.targetDate,
      metadata: {
        oldestTargetDate: oldestDate,
        lookbackDays: params.backfillLookbackDays,
        checkedDates: dateRange,
        results: results.map((result) => ({
          targetDate: result.targetDate,
          processed: result.processed ?? 0,
          inserted: result.inserted ?? 0,
          skipped: result.skipped ?? 0,
          status: result.status,
        })),
      },
    };
  }

  const result = await runStayInAutomationForDate({
    domain: params.domain,
    settings,
    targetDate: target.targetDate,
  });

  return result;
}

export async function executePayrollAutomation(params: {
  domain: EmployeeAutomationDomain;
  settings?: EmployeeAutomationSettings;
  skipIfAlreadyRecorded?: boolean;
}): Promise<EmployeeAutomationExecutionResult> {
  const settings =
    params.settings ?? (await getSettingsForDomain(params.domain));

  if (!settings.payrollAutoGenerationEnabled) {
    return buildSkippedResult(
      'payroll-generation',
      'Payroll automation is disabled.',
      {
        skipReason: 'disabled',
      }
    );
  }

  const period = getDuePayrollAutomationPeriod({
    scheduleTime: settings.payrollAutoGenerationTime,
    timezone: settings.payrollAutoGenerationTimezone,
    cutoffDays: settings.payrollAutoGenerationCutoffDays,
  });

  if (!period) {
    return buildSkippedResult(
      'payroll-generation',
      'Payroll automation has no due cutoff date to process yet.',
      {
        metadata: {
          skipReason: 'no-due-cutoff',
          cutoffDays: settings.payrollAutoGenerationCutoffDays,
        },
      }
    );
  }

  if (params.skipIfAlreadyRecorded) {
    const alreadyRecorded = await getPayrollRunCheck(params.domain)(
      period.periodKey
    );

    if (alreadyRecorded) {
      return buildSkippedResult(
        'payroll-generation',
        `Payroll automation already ran for ${period.label}.`,
        {
          skipReason: 'already-recorded-run',
          periodKey: period.periodKey,
          payrollPeriodStart: period.periodStart,
          payrollPeriodEnd: period.periodEnd,
        }
      );
    }
  }

  return invokePayrollGenerationRoute({
    domain: params.domain,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    label: period.label,
    periodKey: period.periodKey,
  });
}

export async function executeDueAutomations(params: {
  domain: EmployeeAutomationDomain;
  settings?: EmployeeAutomationSettings;
}): Promise<EmployeeAutomationExecutionResult[]> {
  const settings =
    params.settings ?? (await getSettingsForDomain(params.domain));

  const results: EmployeeAutomationExecutionResult[] = [];

  results.push(
    await executeStayInAutomation({
      domain: params.domain,
      settings,
      skipIfAlreadyRecorded: true,
      backfillLookbackDays: STAY_IN_ATTENDANCE_LOOKBACK_DAYS,
    })
  );

  results.push(
    await executePayrollAutomation({
      domain: params.domain,
      settings,
      skipIfAlreadyRecorded: true,
    })
  );

  return results;
}
