import { logger } from '@/lib/logger';
import { sanitizers } from '@/lib/security/sanitize';
import type { CustomerDTO } from './dto';

const STATUS_LOOKUP: Record<string, CustomerDTO['Customer Status']> = {
  active: 'Active',
  inactive: 'Inactive',
  prospect: 'Prospect',
  vip: 'VIP',
  banned: 'Banned',
  '🚫 banned': 'Banned',
};

function normalizeStatus(value: unknown): CustomerDTO['Customer Status'] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Active';
    }

    const mapped = STATUS_LOOKUP[trimmed.toLowerCase()];
    if (mapped) {
      return mapped;
    }

    logger.warn('Unknown customer status supplied, defaulting to Active', {
      status: value,
    });
    return 'Active';
  }

  return 'Active';
}

export function sanitizeCustomerRecord(
  entry: unknown
): Record<string, unknown> {
  if (typeof entry !== 'object' || entry === null) {
    return {};
  }

  const record = { ...(entry as Record<string, unknown>) };

  record.Date = sanitizers.date(record.Date);
  record['Customer Status'] = normalizeStatus(record['Customer Status']);
  record['Customer Name'] = sanitizers.name(record['Customer Name']);
  record['Phone Number'] = sanitizers.phone(record['Phone Number']);
  record.Address = sanitizers.address(record.Address);
  record['Business Name'] = sanitizers.name(record['Business Name']);
  record['Business Address'] = sanitizers.address(record['Business Address']);
  record['Business Contact Number'] = sanitizers.phone(
    record['Business Contact Number']
  );
  record['Email Address'] = sanitizers.email(record['Email Address']);
  record.Facebook = sanitizers.url(record.Facebook);
  record['Tax Number'] = sanitizers.name(record['Tax Number']);

  return record;
}
