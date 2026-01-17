export type AccountType = 'Asset' | 'Liability' | 'Equity';

const ACCOUNT_MAP: Record<AccountType, Set<string>> = {
  Asset: new Set([
    'cash',
    'cash on hand',
    'gcash',
    'bank',
    'bank account',
    'e-wallet',
    'e wallet',
    'ewallet',
    'wallet',
    'inventory',
    'stock on hand',
    'inventory in transit',
    'accounts receivable',
    'a/r',
    'prepaid',
    'prepaid expense',
    'deposit',
    'deposits',
  ]),
  Liability: new Set([
    'accounts payable',
    'a/p',
    'taxes payable',
    'withholding payable',
    'accrued freight',
    'accrued expense',
    'accrued expenses',
    'credit card',
    'credit card payable',
    'card payable',
    'loan',
    'liability',
  ]),
  Equity: new Set([
    'opening equity',
    'owner’s equity',
    "owner's equity",
    'owner contribution',
    "owner's contribution",
    'owner’s contribution',
    'capital contribution',
    'owner capital',
    'owner investment',
    'owner draw',
    'owner’s draw',
    "owner's draw",
    'owners draw',
    'retained earnings',
    'capital',
    'equity',
  ]),
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const matchesKeyword = (nameTokens: string[], normalizedKeyword: string) => {
  const keywordTokens = normalizedKeyword.split(' ').filter(Boolean);
  if (keywordTokens.length === 0) {
    return false;
  }

  if (keywordTokens.length === 1) {
    return nameTokens.includes(keywordTokens[0]);
  }

  for (let i = 0; i <= nameTokens.length - keywordTokens.length; i += 1) {
    let match = true;
    for (let j = 0; j < keywordTokens.length; j += 1) {
      if (nameTokens[i + j] !== keywordTokens[j]) {
        match = false;
        break;
      }
    }
    if (match) {
      return true;
    }
  }

  return false;
};

export function detectAccountType(account: string): AccountType | null {
  const rawName = account.trim();
  const name = rawName.toLowerCase();
  if (!name) {
    return null;
  }

  for (const type of Object.keys(ACCOUNT_MAP) as AccountType[]) {
    if (ACCOUNT_MAP[type].has(name)) {
      return type;
    }
  }

  const normalizedName = normalize(rawName);
  if (!normalizedName) {
    return null;
  }

  const nameTokens = normalizedName.split(' ').filter(Boolean);

  if (
    normalizedName.includes('loan payable') ||
    (nameTokens.includes('loan') && nameTokens.includes('payable'))
  ) {
    return 'Liability';
  }

  for (const type of Object.keys(ACCOUNT_MAP) as AccountType[]) {
    for (const keyword of Array.from(ACCOUNT_MAP[type])) {
      const normalizedKeyword = normalize(keyword);
      if (!normalizedKeyword) {
        continue;
      }

      if (normalizedName === normalizedKeyword) {
        return type;
      }

      if (matchesKeyword(nameTokens, normalizedKeyword)) {
        return type;
      }
    }
  }

  return null;
}
