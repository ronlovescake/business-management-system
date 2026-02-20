export const extractSuffixFromName = (fullName?: string | null): string => {
  if (!fullName) {
    return '';
  }

  const commaMatch = fullName.match(/,\s*(.+)$/);
  if (commaMatch?.[1]) {
    return commaMatch[1];
  }

  const parts = fullName.trim().split(/\s+/);
  const lastPart = parts[parts.length - 1]?.toLowerCase();
  const commonSuffixes = new Set([
    'jr',
    'jr.',
    'sr',
    'sr.',
    'ii',
    'iii',
    'iv',
    'v',
  ]);

  return lastPart && commonSuffixes.has(lastPart)
    ? parts[parts.length - 1]
    : '';
};

export const parseNumberOrZero = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const toOptionalNumber = (value: unknown): number | undefined => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const parseOptionalNumericInput = (value?: string): number | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const parsed = Number.parseFloat(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};
