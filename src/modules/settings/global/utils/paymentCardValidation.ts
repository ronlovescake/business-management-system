/**
 * Normalize and validate payment card payloads.
 * Ensures only non-sensitive metadata is accepted.
 */

export type PaymentCardPayload = {
  bank: string;
  label: string;
  nameOnCard: string;
  last4: string | null;
};

const toCleanString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

export function normalizePaymentCardPayload(input: unknown): {
  data?: PaymentCardPayload;
  errors?: Record<string, string>;
} {
  if (!input || typeof input !== 'object') {
    return { errors: { payload: 'Invalid payload' } };
  }

  const raw = input as Record<string, unknown>;
  const bank = toCleanString(raw.bank);
  const label = toCleanString(raw.label ?? raw.cardLabel);
  const nameOnCard = toCleanString(raw.nameOnCard ?? raw.cardName);
  const last4Raw = toCleanString(raw.last4 ?? raw.lastFour ?? '');
  const last4 = last4Raw.length === 0 ? null : last4Raw;

  const errors: Record<string, string> = {};

  if (!bank) {
    errors.bank = 'Bank is required';
  }
  if (!label) {
    errors.label = 'Label is required';
  }
  if (!nameOnCard) {
    errors.nameOnCard = 'Name on card is required';
  }
  if (last4 && !/^\d{4}$/.test(last4)) {
    errors.last4 = 'Last 4 must be exactly 4 digits';
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    data: {
      bank,
      label,
      nameOnCard,
      last4,
    },
  };
}
