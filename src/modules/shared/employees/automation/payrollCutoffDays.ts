const MIN_PAYROLL_CUTOFF_DAY = 1;
const MAX_PAYROLL_CUTOFF_DAY = 31;

export function normalizePayrollCutoffDays(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw new Error(
      'Payroll cutoff dates must be provided as a list of dates.'
    );
  }

  const normalized = Array.from(
    new Set(
      value.map((entry) => {
        const parsed =
          typeof entry === 'number'
            ? entry
            : Number.parseInt(String(entry), 10);

        if (!Number.isFinite(parsed)) {
          throw new Error('Payroll cutoff dates must use valid day numbers.');
        }

        const day = Math.floor(parsed);

        if (day < MIN_PAYROLL_CUTOFF_DAY || day > MAX_PAYROLL_CUTOFF_DAY) {
          throw new Error(
            `Payroll cutoff dates must be between ${MIN_PAYROLL_CUTOFF_DAY} and ${MAX_PAYROLL_CUTOFF_DAY}. Received: ${entry}`
          );
        }

        return day;
      })
    )
  );

  normalized.sort((left, right) => left - right);
  return normalized;
}
