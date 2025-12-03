export const formatPayPeriodDisplay = (
  period: string | null | undefined
): string => {
  if (!period) {
    return '';
  }

  const [startRaw, endRaw] = period.split(' to ');

  const formatDatePart = (value: string | undefined) => {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const start = formatDatePart(startRaw);
  const end = formatDatePart(endRaw);

  return end ? `${start} - ${end}` : start;
};
