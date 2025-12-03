import { MANILA_TIME_FORMATTER, DUE_STATUS_CLASSNAMES } from './constants';
import type { DueStatus } from './types';

export const formatDueInLabel = (hours: number): string => {
  if (!Number.isFinite(hours)) {
    return '';
  }
  if (hours === 0) {
    return 'Due now';
  }

  const absHours = Math.abs(hours);
  const hourLabel = absHours === 1 ? 'hour' : 'hours';

  if (hours < 0) {
    return `${absHours} ${hourLabel} overdue`;
  }

  return `in ${absHours} ${hourLabel}`;
};

export const getDueStatusFromHours = (hours: number): DueStatus => {
  if (!Number.isFinite(hours)) {
    return null;
  }

  if (hours < -24) {
    return 'past-due';
  }

  if (hours <= 0 && hours >= -24) {
    return 'due-today';
  }

  return null;
};

export const getDueStatusClassName = (
  status: DueStatus
): string | undefined => {
  if (!status) {
    return undefined;
  }
  return DUE_STATUS_CLASSNAMES[status];
};

export const parseDateToTimestamp = (value: string): number => {
  if (!value || value.trim() === '') {
    return 0;
  }

  const trimmedValue = value.trim();

  const attempts = [trimmedValue];

  if (!/[zZ]|GMT|UTC|[+-]\d{2}:?\d{2}/.test(trimmedValue)) {
    attempts.push(`${trimmedValue} GMT+0800`);

    if (!/[0-9]{1,2}:[0-9]{2}/.test(trimmedValue)) {
      attempts.push(`${trimmedValue}T00:00:00+08:00`);
    }
  }

  for (const candidate of attempts) {
    const timestamp = Date.parse(candidate);
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  return 0;
};

export const formatUpdatedLabel = (timestamp: number): string => {
  if (!timestamp) {
    return '';
  }

  return MANILA_TIME_FORMATTER.format(new Date(timestamp));
};
