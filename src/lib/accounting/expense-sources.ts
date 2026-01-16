type SourceLabelOptions = {
  sourceLineKey?: string | null;
  includeLineKey?: boolean;
};

const toTitleCase = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export function getExpenseSourceLabel(
  sourceType?: string | null,
  options: SourceLabelOptions = {}
): string {
  const normalized = (sourceType || 'MANUAL').toUpperCase();

  let baseLabel: string;
  switch (normalized) {
    case 'PRODUCT':
      baseLabel = 'Product';
      break;
    case 'PAYROLL':
      baseLabel = 'Payroll';
      break;
    case 'MANUAL':
      baseLabel = 'Manual';
      break;
    default:
      baseLabel = toTitleCase(normalized);
      break;
  }

  const lineKey = options.sourceLineKey?.trim();
  if (options.includeLineKey && lineKey) {
    return `${baseLabel} — ${lineKey}`;
  }

  return baseLabel;
}

export function getExpenseSourceColor(sourceType?: string | null): string {
  const label = getExpenseSourceLabel(sourceType);
  const map: Record<string, string> = {
    Product: 'blue',
    Payroll: 'cyan',
    Manual: 'gray',
  };
  return map[label] || 'gray';
}
