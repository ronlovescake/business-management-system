export const TAGGABLE_ACCOUNT_PARENTS = [
  'Loan Payable',
  'Accounts Payable',
] as const;

export type TaggableAccountParent = (typeof TAGGABLE_ACCOUNT_PARENTS)[number];

const DASH_PREFIX = /^[-–—]+\s*/;
const SEPARATOR = ' – ';

export function isTaggableAccountParent(
  account: string
): account is TaggableAccountParent {
  const trimmed = account.trim();
  return (TAGGABLE_ACCOUNT_PARENTS as readonly string[]).includes(trimmed);
}

export function normalizeAccountTag(tag: string): string {
  const trimmed = tag.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.replace(DASH_PREFIX, '').trim();
}

export function buildTaggedAccountName(
  parent: TaggableAccountParent,
  tag: string
): string {
  const normalizedTag = normalizeAccountTag(tag);
  return normalizedTag ? `${parent}${SEPARATOR}${normalizedTag}` : parent;
}

export function splitTaggedAccountName(account: string): {
  parent: TaggableAccountParent;
  tag: string;
} | null {
  const trimmed = account.trim();
  if (!trimmed) {
    return null;
  }

  for (const parent of TAGGABLE_ACCOUNT_PARENTS) {
    if (trimmed.toLowerCase() === parent.toLowerCase()) {
      return { parent, tag: '' };
    }

    if (trimmed.toLowerCase().startsWith(parent.toLowerCase())) {
      const rest = trimmed.slice(parent.length).trim();
      if (!rest) {
        return { parent, tag: '' };
      }
      const tag = normalizeAccountTag(rest);
      return { parent, tag };
    }
  }

  return null;
}

export function toTaggableSelection(account: string): {
  account: string;
  tag: string;
} {
  const split = splitTaggedAccountName(account);
  if (!split) {
    return { account, tag: '' };
  }

  return {
    account: split.parent,
    tag: split.tag,
  };
}

export function collapseTaggableAccountsForOptions(
  accounts: string[]
): string[] {
  const collapsed = accounts.map((account) => {
    const split = splitTaggedAccountName(account);
    return split ? split.parent : account;
  });

  return Array.from(new Set(collapsed)).sort((a, b) => a.localeCompare(b));
}
