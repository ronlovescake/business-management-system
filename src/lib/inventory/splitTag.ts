export const SPLIT_NAME_PREFIX = '[SPLIT] ';

export function toStoredSplitName(name: string): string {
  return `${SPLIT_NAME_PREFIX}${name.trim()}`;
}

export function fromStoredSplitName(name: string): string {
  if (!name.startsWith(SPLIT_NAME_PREFIX)) {
    return name;
  }

  return name.slice(SPLIT_NAME_PREFIX.length);
}

export function isStoredSplitName(name: string): boolean {
  return name.startsWith(SPLIT_NAME_PREFIX);
}
