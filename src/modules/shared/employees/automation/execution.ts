import {
  getGeneralMerchandiseEmployeeAutomationSettings,
  findGeneralMerchandiseEmployeeAutomationRunForPeriod,
} from '@/lib/settings/generalMerchandiseEmployeeAutomation';
import {
  findEmployeeAutomationRunForPeriod,
  getEmployeeAutomationSettings,
} from '@/lib/settings/employeeAutomation';
import {
  findTruckingEmployeeAutomationRunForPeriod,
  getTruckingEmployeeAutomationSettings,
} from '@/lib/settings/truckingEmployeeAutomation';
import { runStayInAutoPresenceAutomation } from '@/lib/automation/stayInAutoPresence';
import { runGeneralMerchandiseStayInAutoPresenceAutomation } from '@/lib/automation/stayInAutoPresenceGeneralMerchandise';
import { runTruckingStayInAutoPresenceAutomation } from '@/lib/automation/stayInAutoPresenceTrucking';
import { prisma } from '@/lib/db';
import { invokePayrollGenerationRoute } from './payrollRouteInvoker';
import {
  getDueStayInAutomationTarget,
  getDuePayrollAutomationPeriod,
  getStayInBackfillDateRange,
} from './scheduling';
import { STAY_IN_ATTENDANCE_LOOKBACK_DAYS } from './stayInBackfill';
import type {
  EmployeeAutomationExecutionResult,
  EmployeeAutomationRunRecord,
  EmployeeAutomationSettings,
} from './types';

export type EmployeeAutomationDomain =
  | 'clothing'
  | 'trucking'
  | 'general-merchandise';

type RunLookup = (
  periodKey: string
) => Promise<EmployeeAutomationRunRecord | null>;

type SkipReason = 'disabled' | 'already-recorded-run';

const AUTO_STAY_IN_ATTENDANCE_DETAILS = 'Auto-recorded stay-in presence entry.';

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

function getStayInRunLookup(domain: EmployeeAutomationDomain): RunLookup {
  if (domain === 'trucking') {
    return (periodKey) =>
      findTruckingEmployeeAutomationRunForPeriod(
        'stay-in-attendance',
        periodKey
      );
  }

  if (domain === 'general-merchandise') {
    return (periodKey) =>
      findGeneralMerchandiseEmployeeAutomationRunForPeriod(
        'stay-in-attendance',
        periodKey
      );
  }

  return (periodKey) =>
    findEmployeeAutomationRunForPeriod('stay-in-attendance', periodKey);
}

function getPayrollRunLookup(domain: EmployeeAutomationDomain): RunLookup {
  if (domain === 'trucking') {
    return (periodKey) =>
      findTruckingEmployeeAutomationRunForPeriod(
        'payroll-generation',
        periodKey
      );
  }

  if (domain === 'general-merchandise') {
    return (periodKey) =>
      findGeneralMerchandiseEmployeeAutomationRunForPeriod(
        'payroll-generation',
        periodKey
      );
  }

  return (periodKey) =>
    findEmployeeAutomationRunForPeriod('payroll-generation', periodKey);
}

function getExpectedStayInArtifacts(
  run: EmployeeAutomationRunRecord
): Array<{ targetDate: string; expectedCount: number }> {
  const metadata =
    run.metadata && typeof run.metadata === 'object'
      ? (run.metadata as {
          results?: Array<{ targetDate?: string | null; inserted?: number }>;
        })
      : null;

  const metadataResults = Array.isArray(metadata?.results)
    ? metadata.results
        .map((result) => ({
          targetDate: result?.targetDate ?? null,
          expectedCount: Math.max(0, result?.inserted ?? 0),
        }))
        .filter(
          (result): result is { targetDate: string; expectedCount: number } =>
            Boolean(result.targetDate) && result.expectedCount > 0
        )
    : [];

  if (metadataResults.length > 0) {
    return metadataResults;
  }

  if (run.targetDate && run.inserted > 0) {
    return [{ targetDate: run.targetDate, expectedCount: run.inserted }];
  }

  return [];
}

async function listActiveAutoAttendanceDates(params: {
  domain: EmployeeAutomationDomain;
  dates: string[];
}): Promise<string[]> {
  if (params.dates.length === 0) {
    return [];
  }

  const where = {
    deletedAt: null,
    date: { in: params.dates },
    details: AUTO_STAY_IN_ATTENDANCE_DETAILS,
  };

  if (params.domain === 'trucking') {
    const records = await prisma.truckingAttendance.findMany({
      where,
      select: { date: true },
    });

    return records.map((record) => record.date);
  }

  if (params.domain === 'general-merchandise') {
    const records = await prisma.generalMerchandiseAttendance.findMany({
      where,
      select: { date: true },
    });

    return records.map((record) => record.date);
  }

  const records = await prisma.attendance.findMany({
    where,
    select: { date: true },
  });

  return records.map((record) => record.date);
}

async function shouldSkipRecordedStayInRun(params: {
  domain: EmployeeAutomationDomain;
  run: EmployeeAutomationRunRecord;
}): Promise<boolean> {
  const expectedArtifacts = getExpectedStayInArtifacts(params.run);

  if (expectedArtifacts.length === 0) {
    return true;
  }

  const activeDates = await listActiveAutoAttendanceDates({
    domain: params.domain,
    dates: expectedArtifacts.map((artifact) => artifact.targetDate),
  });

  const activeCounts = activeDates.reduce<Map<string, number>>((acc, date) => {
    acc.set(date, (acc.get(date) ?? 0) + 1);
    return acc;
  }, new Map());

  return expectedArtifacts.every(
    ({ targetDate, expectedCount }) =>
      (activeCounts.get(targetDate) ?? 0) >= expectedCount
  );
}

function isPayrollRecoveryCandidate(run: EmployeeAutomationRunRecord): boolean {
  if (run.inserted > 0) {
    return true;
  }

  const message = run.message?.toLowerCase() ?? '';
  return message.includes('payroll already exists');
}

async function countActivePayrollRecords(params: {
  domain: EmployeeAutomationDomain;
  periodStart: string;
  periodEnd: string;
}): Promise<number> {
  const where = {
    deletedAt: null,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  };

  if (params.domain === 'trucking') {
    return prisma.truckingPayroll.count({ where });
  }

  if (params.domain === 'general-merchandise') {
    return prisma.generalMerchandisePayroll.count({ where });
  }

  return prisma.payroll.count({ where });
}

async function shouldSkipRecordedPayrollRun(params: {
  domain: EmployeeAutomationDomain;
  run: EmployeeAutomationRunRecord;
  periodStart: string;
  periodEnd: string;
}): Promise<boolean> {
  const activeRecordCount = await countActivePayrollRecords({
    domain: params.domain,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });

  if (activeRecordCount === 0) {
    return !isPayrollRecoveryCandidate(params.run);
  }

  if (params.run.inserted > 0) {
    return activeRecordCount >= params.run.inserted;
  }

  return true;
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
    const recordedRun = await getStayInRunLookup(params.domain)(
      target.periodKey
    );

    if (
      recordedRun &&
      (await shouldSkipRecordedStayInRun({
        domain: params.domain,
        run: recordedRun,
      }))
    ) {
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
    const recordedRun = await getPayrollRunLookup(params.domain)(
      period.periodKey
    );

    if (
      recordedRun &&
      (await shouldSkipRecordedPayrollRun({
        domain: params.domain,
        run: recordedRun,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      }))
    ) {
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
