import {
  buildTaggedAccountName,
  isTaggableAccountParent,
} from '@/lib/accounting/account-tagging';

export const normalizeUtcMidnight = (date: Date): Date => {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
};

export const clampDayInMonthUtc = (
  year: number,
  monthIndex: number,
  day: number
) => {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(day, lastDay);
};

export const addOneMonthUtc = (date: Date, dayOfMonth: number): Date => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();

  const nextMonthIndex = month + 1;
  const nextYear = year + Math.floor(nextMonthIndex / 12);
  const normalizedMonth = ((nextMonthIndex % 12) + 12) % 12;

  const day = clampDayInMonthUtc(nextYear, normalizedMonth, dayOfMonth);
  return new Date(Date.UTC(nextYear, normalizedMonth, day));
};

export const isUniqueViolation = (error: unknown): boolean => {
  const code = (error as { code?: string })?.code;
  return code === 'P2002';
};

export const isMissingTableError = (error: unknown): boolean => {
  const code = (error as { code?: string })?.code;
  const message = (error as { message?: string })?.message ?? '';
  return code === 'P2021' || message.includes('does not exist');
};

export const resolveTaggedAccount = (
  account: string,
  tag: string | null
): string => {
  if (!tag) {
    return account;
  }

  if (!isTaggableAccountParent(account)) {
    return account;
  }

  return buildTaggedAccountName(account, tag);
};
