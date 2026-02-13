export const MIX_AND_MATCH_NAME_PREFIX = '[MIXMATCH] ';

export function toStoredMixAndMatchName(name: string): string {
  return `${MIX_AND_MATCH_NAME_PREFIX}${name.trim()}`;
}

export function fromStoredMixAndMatchName(name: string): string {
  if (!name.startsWith(MIX_AND_MATCH_NAME_PREFIX)) {
    return name;
  }

  return name.slice(MIX_AND_MATCH_NAME_PREFIX.length);
}

export function isStoredMixAndMatchName(name: string): boolean {
  return name.startsWith(MIX_AND_MATCH_NAME_PREFIX);
}
