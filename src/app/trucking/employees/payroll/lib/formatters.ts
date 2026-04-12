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
      month: 'long',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'Asia/Manila',
    });
  };

  const start = formatDatePart(startRaw);
  const end = formatDatePart(endRaw);

  return end ? `${start} - ${end}` : start;
};
