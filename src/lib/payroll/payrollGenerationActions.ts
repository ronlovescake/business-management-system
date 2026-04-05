import { api } from '@/lib/api/client';
import { getSwal } from '@/lib/alerts';
import { logger } from '@/lib/logger';
import { getCurrentPayrollPeriod } from '@/lib/payroll/currentPayPeriod';
import { getCurrentDateISO } from '@/utils/date';

type ParsedPayPeriod = {
  start: string;
  end: string;
};

type PayrollPeriodRecord = {
  payPeriod: string;
};

type PayslipGenerationResult = {
  success: boolean;
  error?: string;
};

type GeneratedPayrollPeriod = {
  start?: string;
  end?: string;
  label?: string;
} | null;

type PeriodSelectionResult = {
  periodStart: string | null;
  periodEnd: string | null;
  payPeriodLabel: string | null;
};

type BuildSuccessMessageArgs = {
  count: number;
  payPeriodLabel: string | null;
  period: GeneratedPayrollPeriod;
};

type RunPayrollGenerationFlowArgs = {
  payrolls: PayrollPeriodRecord[];
  parsePayPeriodLabel: (value: string) => ParsedPayPeriod | null;
  isGeneratingPayroll: boolean;
  setIsGeneratingPayroll: (value: boolean) => void;
  resolveApiPath: (path: string) => string;
  invalidateQuery: () => void | Promise<void>;
  generatePayslipsForPeriod: (args: {
    periodStart: string;
    periodEnd: string;
    payPeriodLabel: string;
  }) => Promise<PayslipGenerationResult>;
  defaultGenerateErrorMessage: string;
  buildSuccessMessage: (args: BuildSuccessMessageArgs) => string;
  cleanupDialogTitle?: string;
};

type RunPayrollPayslipGenerationFlowArgs = {
  isGeneratingPayslips: boolean;
  payPeriodFilter: string;
  parsePayPeriodLabel: (value: string) => ParsedPayPeriod | null;
  generatePayslipsForPeriod: (args: {
    periodStart: string;
    periodEnd: string;
    payPeriodLabel: string;
  }) => Promise<PayslipGenerationResult>;
};

const parseISODate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatLocalISO = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const alignToPeriodStart = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  return day <= 15 ? new Date(year, month, 1) : new Date(year, month, 16);
};

const buildExpectedPeriods = (startISO: string, endISO: string) => {
  const periods: { start: string; end: string; label: string }[] = [];
  let cursor = alignToPeriodStart(new Date(startISO));
  const endBoundary = new Date(endISO);

  while (cursor <= endBoundary) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const day = cursor.getDate();
    const periodStart = new Date(cursor);
    const periodEnd =
      day === 1 ? new Date(year, month, 15) : new Date(year, month + 1, 0);

    const start = formatLocalISO(periodStart);
    const end = formatLocalISO(periodEnd);
    periods.push({ start, end, label: `${start} to ${end}` });

    cursor =
      day === 1 ? new Date(year, month, 16) : new Date(year, month + 1, 1);
  }

  return periods;
};

const normalizePeriodLabel = (startRaw: string, endRaw: string) => {
  const start = parseISODate(startRaw);
  const end = parseISODate(endRaw);
  if (start && end) {
    const startIso = formatLocalISO(start);
    const endIso = formatLocalISO(end);
    return `${startIso} to ${endIso}`;
  }
  return `${startRaw.trim()} to ${endRaw.trim()}`;
};

const selectPayrollGenerationPeriod = async ({
  payrolls,
  parsePayPeriodLabel,
}: Pick<
  RunPayrollGenerationFlowArgs,
  'payrolls' | 'parsePayPeriodLabel'
>): Promise<PeriodSelectionResult | null> => {
  const Swal = await getSwal();
  const currentPeriod = getCurrentPayrollPeriod();
  const existingPeriodLabels = new Set<string>();
  let earliestStart: string | null = null;

  payrolls.forEach((payroll) => {
    const parsed = parsePayPeriodLabel(payroll.payPeriod);
    if (!parsed) {
      return;
    }

    const normalizedLabel = normalizePeriodLabel(parsed.start, parsed.end);
    existingPeriodLabels.add(normalizedLabel);

    const parsedStart = parseISODate(parsed.start);
    if (!parsedStart) {
      return;
    }

    const startIso = formatLocalISO(parsedStart);
    if (!earliestStart || parsedStart < new Date(earliestStart)) {
      earliestStart = startIso;
    }
  });

  if (!earliestStart) {
    earliestStart = currentPeriod.start;
  }

  const expectedPeriods = buildExpectedPeriods(
    earliestStart,
    currentPeriod.end
  );
  const missingPeriods = expectedPeriods
    .filter((period) => !existingPeriodLabels.has(period.label))
    .map((period) => ({ value: period.label, label: period.label }));

  const payPeriodChoices = [
    { value: 'current', label: 'Current period (based on today)' },
    ...missingPeriods,
    { value: 'custom', label: 'Custom period' },
  ];

  const payPeriodOptionsHtml = payPeriodChoices
    .map(
      (option) =>
        `<option value="${option.value}" ${option.value === 'current' ? 'selected' : ''}>${option.label}</option>`
    )
    .join('');

  const todayIso = getCurrentDateISO();
  const modalResult = await Swal.fire({
    title: 'Generate Payroll?',
    width: '44rem',
    padding: '2.25rem 2.5rem 2rem',
    html: `
      <div style="text-align:left; margin-bottom: 12px; color: #4b5563;">
        Select a pay period to generate payroll for. Choose an existing period or enter a custom range if it does not exist yet.
      </div>
      <div style="display:flex; flex-direction:column; gap:10px;">
        <label style="font-weight:600; color:#111827;">Pay period</label>
        <div style="display:flex; justify-content:center; width:100%;">
          <select
            id="payPeriodSelect"
            class="swal2-select"
            style="width:100%; max-width: 420px;"
          >
            ${payPeriodOptionsHtml}
          </select>
        </div>
        <div id="customPeriodFields" style="display:none; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:10px; margin-top:8px;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-weight:600; color:#111827;">Start date</label>
            <input id="customPeriodStart" type="date" class="swal2-input" style="width:100%;" value="${todayIso}" />
          </div>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <label style="font-weight:600; color:#111827;">End date</label>
            <input id="customPeriodEnd" type="date" class="swal2-input" style="width:100%;" value="${todayIso}" />
          </div>
          <div style="grid-column: span 2; display:flex; flex-direction:column; gap:4px;">
            <label style="font-weight:600; color:#111827;">Optional label</label>
            <input id="customPeriodLabel" type="text" class="swal2-input" placeholder="e.g., 2025-12-01 to 2025-12-15" style="width:100%;" />
          </div>
        </div>
      </div>
    `,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Generate Payroll',
    cancelButtonText: 'Cancel',
    allowOutsideClick: false,
    focusConfirm: false,
    didOpen: () => {
      const selectEl = document.getElementById(
        'payPeriodSelect'
      ) as HTMLSelectElement | null;
      const customFields = document.getElementById('customPeriodFields');

      const toggleCustomFields = (value: string | undefined) => {
        if (!customFields) {
          return;
        }
        customFields.style.display = value === 'custom' ? 'grid' : 'none';
      };

      toggleCustomFields(selectEl?.value);
      selectEl?.addEventListener('change', (event) => {
        const target = event.target as HTMLSelectElement;
        toggleCustomFields(target.value);
      });
    },
    preConfirm: () => {
      const selectEl = document.getElementById(
        'payPeriodSelect'
      ) as HTMLSelectElement | null;
      const selected = selectEl?.value ?? 'current';

      if (selected === 'current') {
        return {
          periodStart: null,
          periodEnd: null,
          payPeriodLabel: null,
        } as const;
      }

      if (selected === 'custom') {
        const startEl = document.getElementById(
          'customPeriodStart'
        ) as HTMLInputElement | null;
        const endEl = document.getElementById(
          'customPeriodEnd'
        ) as HTMLInputElement | null;
        const labelEl = document.getElementById(
          'customPeriodLabel'
        ) as HTMLInputElement | null;

        const periodStart = startEl?.value || '';
        const periodEnd = endEl?.value || '';
        const payPeriodLabel = (labelEl?.value || '').trim();

        if (!periodStart || !periodEnd) {
          Swal.showValidationMessage(
            'Please provide both start and end dates.'
          );
          return null;
        }

        if (new Date(periodStart) > new Date(periodEnd)) {
          Swal.showValidationMessage('Start date must be before end date.');
          return null;
        }

        return {
          periodStart,
          periodEnd,
          payPeriodLabel: payPeriodLabel || `${periodStart} to ${periodEnd}`,
        } as const;
      }

      const parsed = parsePayPeriodLabel(selected);
      if (!parsed) {
        Swal.showValidationMessage('Please select a valid pay period.');
        return null;
      }

      return {
        periodStart: parsed.start,
        periodEnd: parsed.end,
        payPeriodLabel: selected,
      } as const;
    },
  });

  if (!modalResult.isConfirmed || !modalResult.value) {
    return null;
  }

  return modalResult.value as PeriodSelectionResult;
};

export async function runPayrollGenerationFlow({
  payrolls,
  parsePayPeriodLabel,
  isGeneratingPayroll,
  setIsGeneratingPayroll,
  resolveApiPath,
  invalidateQuery,
  generatePayslipsForPeriod,
  defaultGenerateErrorMessage,
  buildSuccessMessage,
  cleanupDialogTitle,
}: RunPayrollGenerationFlowArgs) {
  const Swal = await getSwal();
  if (isGeneratingPayroll) {
    return;
  }

  const selectedPeriod = await selectPayrollGenerationPeriod({
    payrolls,
    parsePayPeriodLabel,
  });

  if (!selectedPeriod) {
    return;
  }

  const { periodStart, periodEnd, payPeriodLabel } = selectedPeriod;
  setIsGeneratingPayroll(true);

  try {
    const payload: Record<string, unknown> = {};
    if (periodStart && periodEnd) {
      payload.periodStart = periodStart;
      payload.periodEnd = periodEnd;
    }
    if (payPeriodLabel) {
      payload.payPeriodLabel = payPeriodLabel;
    }

    const result = await api.post<unknown>(
      resolveApiPath('/payroll/generate'),
      payload
    );

    const normalized =
      typeof result === 'object' && result !== null
        ? (result as Record<string, unknown>)
        : {};

    if (normalized.success === false) {
      const message =
        typeof normalized.message === 'string'
          ? normalized.message
          : typeof normalized.error === 'string'
            ? normalized.error
            : defaultGenerateErrorMessage;

      const action =
        typeof normalized.action === 'string' ? normalized.action : undefined;

      if (
        action === 'restore_or_hard_delete' ||
        action === 'cleanup_soft_deleted'
      ) {
        const cleanupResult = await Swal.fire({
          title: cleanupDialogTitle,
          html: `
            <p>${message}</p>
            <p style="margin-top: 15px; color: #666;">
              Would you like to permanently remove the deleted payroll records and generate new ones?
            </p>
          `,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Yes, clean up and regenerate',
          cancelButtonText: 'Cancel',
          allowOutsideClick: false,
        });

        if (cleanupResult.isConfirmed) {
          const period = normalized.period as ParsedPayPeriod | undefined;
          if (period?.start && period?.end) {
            await api.delete(
              `${resolveApiPath('/payroll/cleanup')}?periodStart=${period.start}&periodEnd=${period.end}`
            );

            const retryResult = await api.post<unknown>(
              resolveApiPath('/payroll/generate'),
              payload
            );
            const retryNormalized =
              typeof retryResult === 'object' && retryResult !== null
                ? (retryResult as Record<string, unknown>)
                : {};

            if (retryNormalized.success === false) {
              throw new Error(
                typeof retryNormalized.message === 'string'
                  ? retryNormalized.message
                  : 'Failed to generate payroll after cleanup.'
              );
            }

            await Promise.resolve(invalidateQuery());

            const count = Number(retryNormalized.count ?? 0);
            const safeCount = Number.isFinite(count) ? count : 0;

            await Swal.fire({
              title: 'Success!',
              text: `Successfully cleaned up deleted records and generated payroll for ${safeCount} employee${safeCount === 1 ? '' : 's'}.`,
              icon: 'success',
              confirmButtonColor: '#3085d6',
              confirmButtonText: 'OK',
              allowOutsideClick: false,
            });

            return;
          }
        }

        return;
      }

      throw new Error(message);
    }

    await Promise.resolve(invalidateQuery());

    const count = Number(normalized.count ?? 0);
    const safeCount = Number.isFinite(count) ? count : 0;
    const period = (normalized.period ?? null) as GeneratedPayrollPeriod;
    const message =
      typeof normalized.message === 'string' && normalized.message.trim()
        ? normalized.message
        : buildSuccessMessage({
            count: safeCount,
            payPeriodLabel,
            period,
          });

    let payslipResult: PayslipGenerationResult | null = null;
    if (period?.start && period?.end) {
      payslipResult = await generatePayslipsForPeriod({
        periodStart: period.start,
        periodEnd: period.end,
        payPeriodLabel:
          typeof period.label === 'string' && period.label.trim()
            ? period.label
            : `${period.start} to ${period.end}`,
      });
    }

    const payslipSuccess = payslipResult?.success ?? false;
    const infoMessage = payslipSuccess
      ? `${message} Payslips downloaded successfully.`
      : payslipResult
        ? `${message} However, payslip generation failed. ${payslipResult.error ?? 'Please try again through the Generate Payslips button.'}`
        : message;

    await Swal.fire({
      title: payslipSuccess
        ? 'Success!'
        : payslipResult
          ? 'Payroll Generated'
          : 'Success!',
      text: infoMessage,
      icon: payslipSuccess ? 'success' : payslipResult ? 'warning' : 'success',
      confirmButtonColor: payslipSuccess ? '#3085d6' : '#f59e0b',
      confirmButtonText: 'OK',
      allowOutsideClick: false,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Failed to generate payroll. Please try again.';
    logger.error('Error generating payroll:', error);

    await Swal.fire({
      title: 'Error!',
      text: message,
      icon: 'error',
      confirmButtonColor: '#d33',
      confirmButtonText: 'OK',
      allowOutsideClick: false,
    });
  } finally {
    setIsGeneratingPayroll(false);
  }
}

export async function runPayrollPayslipGenerationFlow({
  isGeneratingPayslips,
  payPeriodFilter,
  parsePayPeriodLabel,
  generatePayslipsForPeriod,
}: RunPayrollPayslipGenerationFlowArgs) {
  const Swal = await getSwal();
  if (isGeneratingPayslips) {
    return;
  }

  if (payPeriodFilter === 'all') {
    await Swal.fire({
      title: 'Select Pay Period',
      text: 'Please choose a specific pay period filter before generating payslips.',
      icon: 'info',
      confirmButtonColor: '#3085d6',
      confirmButtonText: 'OK',
      allowOutsideClick: false,
    });
    return;
  }

  const parsed = parsePayPeriodLabel(payPeriodFilter);
  if (!parsed) {
    await Swal.fire({
      title: 'Invalid Pay Period',
      text: 'Unable to determine the selected pay period. Please try again.',
      icon: 'error',
      confirmButtonColor: '#d33',
      confirmButtonText: 'OK',
      allowOutsideClick: false,
    });
    return;
  }

  const result = await generatePayslipsForPeriod({
    periodStart: parsed.start,
    periodEnd: parsed.end,
    payPeriodLabel: payPeriodFilter,
  });

  await Swal.fire({
    title: result.success ? 'Payslips Ready' : 'Failed to Generate Payslips',
    text: result.success
      ? `Payslips for ${payPeriodFilter} have been downloaded as a ZIP file.`
      : (result.error ?? 'Please try again later.'),
    icon: result.success ? 'success' : 'error',
    confirmButtonColor: result.success ? '#3085d6' : '#d33',
    confirmButtonText: 'OK',
    allowOutsideClick: false,
  });
}
