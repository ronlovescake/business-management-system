import type { CSSProperties } from 'react';
import type { DateInputProps } from '@mantine/dates';

const highlightStyle: CSSProperties = {
  border: '1px solid var(--mantine-color-blue-5)',
  backgroundColor: 'var(--mantine-color-blue-0)',
  color: 'var(--mantine-color-blue-7)',
  borderRadius: 'var(--mantine-radius-sm)',
  fontWeight: 600,
};

const isSameDay = (date: Date, comparison: Date): boolean => {
  return (
    date.getFullYear() === comparison.getFullYear() &&
    date.getMonth() === comparison.getMonth() &&
    date.getDate() === comparison.getDate()
  );
};

export const DATE_INPUT_VALUE_FORMAT = 'YYYY-MM-DD';

export const COMMON_DATE_INPUT_PROPS: Pick<
  DateInputProps,
  'firstDayOfWeek' | 'getDayProps' | 'valueFormat'
> = {
  firstDayOfWeek: 0,
  valueFormat: DATE_INPUT_VALUE_FORMAT,
  getDayProps: (date) => {
    const today = new Date();

    if (!isSameDay(date, today)) {
      return {};
    }

    return {
      style: {
        ...highlightStyle,
      },
    };
  },
};

export const parseDateValue = (
  value: string | Date | null | undefined
): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  // Handle ISO-like date strings (YYYY-MM-DD) as local dates to avoid
  // timezone offsets shifting the day (e.g., UTC parsing subtracting a day
  // in negative timezones).
  if (typeof value === 'string') {
    const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = isoDatePattern.exec(value.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const localDate = new Date(year, month - 1, day);
      return Number.isNaN(localDate.getTime()) ? null : localDate;
    }
  }

  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateForInput = (value: Date | null | undefined): string => {
  if (!value) {
    return '';
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};
