import type { DueStatus } from './types';

export const DEFAULT_READ_ONLY_COLUMNS = {
  unitPrice: true,
  lineTotal: true,
  invoiceDate: true,
  packedDate: true,
  shipmentCode: true,
};

export type ReadOnlyColumnFlags = typeof DEFAULT_READ_ONLY_COLUMNS;

export const DUE_DATE_FILTER_OPTIONS = [
  'Show All',
  'Due in 2 days',
  'Due in 1 day',
  'Due today',
  'Past due',
] as const;

export const MAX_PLACEHOLDER_ROWS = 20;

export const MANILA_TIME_FORMATTER = {
  format(date: Date): string {
    const datePart = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      month: 'long',
      day: '2-digit',
      year: 'numeric',
    }).format(date);
    const timePart = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    return `${datePart} \u00B7 ${timePart}`;
  },
};

export const MANILA_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Manila',
  month: 'long',
  day: '2-digit',
  year: 'numeric',
});

export const DUE_STATUS_CLASSNAMES: Record<Exclude<DueStatus, null>, string> = {
  'due-today': 'ht-due-status-today',
  'past-due': 'ht-due-status-past',
};
