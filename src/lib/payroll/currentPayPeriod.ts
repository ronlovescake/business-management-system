type PayrollPeriodReference =
  | Date
  | {
      year: number;
      month: number;
      day: number;
    };

function toReferenceParts(referenceDate: PayrollPeriodReference) {
  if (referenceDate instanceof Date) {
    return {
      year: referenceDate.getFullYear(),
      month: referenceDate.getMonth() + 1,
      day: referenceDate.getDate(),
    };
  }

  return referenceDate;
}

function formatIsoDate(parts: { year: number; month: number; day: number }) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(
    parts.day
  ).padStart(2, '0')}`;
}

function getMonthEndDay(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function getCurrentPayrollPeriod(
  referenceDate: PayrollPeriodReference = new Date()
) {
  const { year, month, day } = toReferenceParts(referenceDate);

  const start =
    day <= 15
      ? formatIsoDate({ year, month, day: 1 })
      : formatIsoDate({ year, month, day: 16 });
  const end =
    day <= 15
      ? formatIsoDate({ year, month, day: 15 })
      : formatIsoDate({ year, month, day: getMonthEndDay(year, month) });

  return {
    start,
    end,
    label: `${start} to ${end}`,
  };
}
