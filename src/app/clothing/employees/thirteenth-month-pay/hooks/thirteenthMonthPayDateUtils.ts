const parseDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const deriveYearFromPayroll = (
  payroll: Record<string, unknown>
): number | null => {
  const primary = parseDate(payroll.periodEnd as string | undefined);
  if (primary) {
    return primary.getFullYear();
  }

  const secondary = parseDate(payroll.periodStart as string | undefined);
  if (secondary) {
    return secondary.getFullYear();
  }

  const payPeriod = payroll.payPeriod as string | undefined;
  if (payPeriod) {
    const parts = payPeriod.split(' to ').map((part) => part.trim());
    const fallback = parseDate(parts[1] || parts[0]);
    if (fallback) {
      return fallback.getFullYear();
    }
  }

  return null;
};

export const deriveMonthFromPayroll = (
  payroll: Record<string, unknown>
): number | null => {
  const primary = parseDate(payroll.periodEnd as string | undefined);
  if (primary) {
    return primary.getMonth();
  }

  const secondary = parseDate(payroll.periodStart as string | undefined);
  if (secondary) {
    return secondary.getMonth();
  }

  const payPeriod = payroll.payPeriod as string | undefined;
  if (payPeriod) {
    const parts = payPeriod.split(' to ').map((part) => part.trim());
    const fallback = parseDate(parts[1] || parts[0]);
    if (fallback) {
      return fallback.getMonth();
    }
  }

  return null;
};

export const calculateTenureshipLabel = (
  hireDateValue: string | null | undefined,
  year: number,
  referenceDate: Date = new Date()
): string => {
  if (!hireDateValue) {
    return 'N/A';
  }

  const hireDate = parseDate(hireDateValue);
  if (!hireDate) {
    return 'N/A';
  }

  const periodEnd =
    referenceDate.getFullYear() === year
      ? referenceDate
      : new Date(year, 11, 31);

  if (hireDate > periodEnd) {
    return 'Less than 1 day';
  }

  let years = periodEnd.getFullYear() - hireDate.getFullYear();
  let months = periodEnd.getMonth() - hireDate.getMonth();
  let days = periodEnd.getDate() - hireDate.getDate();

  if (days < 0) {
    const previousMonth = new Date(
      periodEnd.getFullYear(),
      periodEnd.getMonth(),
      0
    );
    days += previousMonth.getDate();
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  if (years < 0) {
    return 'Less than 1 day';
  }

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? 'month' : 'months'}`);
  }
  if (days > 0) {
    parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  }

  if (parts.length === 0) {
    return 'Less than 1 day';
  }

  return parts.join(', ');
};
