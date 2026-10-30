import { calculateAddressSimilarity } from './fuzzyMatch';

export function normalizeCustomerPhone(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/^63(?=\d{10}$)/, '0')
    .replace(/^9(?=\d{9}$)/, '09');
}

function normalize(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bpk\b\.?/g, 'purok')
    .replace(/\b(?:brgy|bgy)\b\.?/g, 'barangay')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function customerAddressTerms(value: string): string[] {
  const generic = new Set([
    'purok',
    'barangay',
    'city',
    'municipality',
    'province',
    'philippines',
    'mindanao',
    'visayas',
    'luzon',
    'street',
    'road',
    'the',
    'of',
    'in',
    'near',
    'beside',
  ]);
  return Array.from(
    new Set(
      normalize(value)
        .split(/\s+/)
        .filter((term) => term.length >= 3 && !generic.has(term))
    )
  );
}

export function compareCustomerAddresses(
  query: string,
  stored: string
): {
  matchedTerms: string[];
  unmatchedTerms: string[];
  similarityScore: number;
} | null {
  const queryTerms = customerAddressTerms(query);
  if (queryTerms.length < 3) {
    return null;
  }
  const storedTerms = new Set(customerAddressTerms(stored));
  const matchedTerms = queryTerms.filter((term) => storedTerms.has(term));
  const coverage = matchedTerms.length / queryTerms.length;
  if (matchedTerms.length < 3 || coverage < 0.6) {
    return null;
  }
  return {
    matchedTerms,
    unmatchedTerms: queryTerms.filter((term) => !storedTerms.has(term)),
    similarityScore: Math.round(
      coverage * 80 +
        calculateAddressSimilarity(normalize(query), normalize(stored)) * 0.2
    ),
  };
}
