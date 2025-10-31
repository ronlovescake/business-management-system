/**
 * Fuzzy String Matching Utilities
 *
 * Provides functions for comparing addresses, names, and other text fields
 * to find potential matches between dispatch orders and customers
 */

/**
 * Calculate Levenshtein distance between two strings
 * (number of single-character edits needed to change one string to another)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two strings (0-100%)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) {
    return 0;
  }

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) {
    return 100;
  }

  const maxLength = Math.max(s1.length, s2.length);
  if (maxLength === 0) {
    return 100;
  }

  const distance = levenshteinDistance(s1, s2);
  return Math.round(((maxLength - distance) / maxLength) * 100);
}

/**
 * Normalize address for comparison
 * Removes common variations and standardizes format
 */
function normalizeAddress(address: string): string {
  return (
    address
      .toLowerCase()
      .trim()
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Standardize common abbreviations
      .replace(/\bst\b\.?/g, 'street')
      .replace(/\bave\b\.?/g, 'avenue')
      .replace(/\brd\b\.?/g, 'road')
      .replace(/\bblvd\b\.?/g, 'boulevard')
      .replace(/\bblk\b\.?/g, 'block')
      .replace(/\bapt\b\.?/g, 'apartment')
      .replace(/\bunit\b\.?/g, 'unit')
      // Remove punctuation
      .replace(/[,.;:#]/g, '')
      // Standardize spacing around numbers
      .replace(/(\d+)\s*-\s*(\d+)/g, '$1-$2')
  );
}

/**
 * Extract key components from address
 */
function extractAddressComponents(address: string): {
  street: string;
  city: string;
  province: string;
  zipCode: string;
  keywords: Set<string>;
} {
  const normalized = normalizeAddress(address);
  const parts = normalized.split(',').map((p) => p.trim());

  // Common Philippine provinces
  const provinces = [
    'metro manila',
    'manila',
    'cebu',
    'davao',
    'cavite',
    'laguna',
    'rizal',
    'bulacan',
    'pampanga',
    'batangas',
    'quezon',
    'pangasinan',
  ];

  // Common cities
  const cities = [
    'quezon city',
    'manila',
    'makati',
    'pasig',
    'taguig',
    'paranaque',
    'las pinas',
    'muntinlupa',
    'marikina',
    'pasay',
    'caloocan',
    'valenzuela',
    'malabon',
    'navotas',
    'san juan',
    'mandaluyong',
  ];

  let province = '';
  let city = '';
  let zipCode = '';

  // Extract zip code
  const zipMatch = normalized.match(/\b\d{4}\b/);
  if (zipMatch) {
    zipCode = zipMatch[0];
  }

  // Extract province
  for (const prov of provinces) {
    if (normalized.includes(prov)) {
      province = prov;
      break;
    }
  }

  // Extract city
  for (const ct of cities) {
    if (normalized.includes(ct)) {
      city = ct;
      break;
    }
  }

  // Get first part as street (usually most detailed)
  const street = parts[0] || '';

  // Extract keywords (significant words)
  const keywords = new Set(
    normalized
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          ![
            'street',
            'avenue',
            'road',
            'boulevard',
            'block',
            'apartment',
            'unit',
          ].includes(word)
      )
  );

  return { street, city, province, zipCode, keywords };
}

/**
 * Calculate address similarity score with component weighting
 */
export function calculateAddressSimilarity(
  address1: string,
  address2: string
): number {
  if (!address1 || !address2) {
    return 0;
  }

  const comp1 = extractAddressComponents(address1);
  const comp2 = extractAddressComponents(address2);

  let score = 0;
  let totalWeight = 0;

  // Exact zip code match (high confidence)
  if (comp1.zipCode && comp2.zipCode) {
    totalWeight += 25;
    if (comp1.zipCode === comp2.zipCode) {
      score += 25;
    }
  }

  // Province match (important)
  if (comp1.province && comp2.province) {
    totalWeight += 20;
    if (comp1.province === comp2.province) {
      score += 20;
    }
  }

  // City match (important)
  if (comp1.city && comp2.city) {
    totalWeight += 20;
    if (comp1.city === comp2.city) {
      score += 20;
    }
  }

  // Street similarity (most detailed part)
  totalWeight += 20;
  const streetSimilarity = calculateSimilarity(comp1.street, comp2.street);
  score += (streetSimilarity / 100) * 20;

  // Keyword overlap
  totalWeight += 15;
  const commonKeywords = new Set(
    [...comp1.keywords].filter((k) => comp2.keywords.has(k))
  );
  const keywordScore =
    commonKeywords.size > 0
      ? (commonKeywords.size /
          Math.max(comp1.keywords.size, comp2.keywords.size)) *
        15
      : 0;
  score += keywordScore;

  // Normalize to 0-100
  return totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0;
}

/**
 * Calculate phone number similarity
 * Handles various formats and partial matches
 */
export function calculatePhoneSimilarity(
  phone1: string,
  phone2: string
): number {
  if (!phone1 || !phone2) {
    return 0;
  }

  // Extract only digits
  const digits1 = phone1.replace(/\D/g, '');
  const digits2 = phone2.replace(/\D/g, '');

  if (!digits1 || !digits2) {
    return 0;
  }

  // Exact match
  if (digits1 === digits2) {
    return 100;
  }

  // Check last 7 digits (common for Philippine mobile numbers)
  const last7_1 = digits1.slice(-7);
  const last7_2 = digits2.slice(-7);

  if (last7_1 === last7_2 && last7_1.length === 7) {
    return 90;
  }

  // Check last 4 digits (for masked numbers)
  const last4_1 = digits1.slice(-4);
  const last4_2 = digits2.slice(-4);

  if (last4_1 === last4_2 && last4_1.length === 4) {
    return 60;
  }

  // Use general similarity
  return calculateSimilarity(digits1, digits2);
}

/**
 * Calculate name similarity
 * Handles partial matches and name variations
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  if (!name1 || !name2) {
    return 0;
  }

  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  // Exact match
  if (n1 === n2) {
    return 100;
  }

  // Split into parts
  const parts1 = n1.split(/\s+/);
  const parts2 = n2.split(/\s+/);

  // Check if one name is contained in the other
  if (n1.includes(n2) || n2.includes(n1)) {
    return 80;
  }

  // Count matching parts
  let matchingParts = 0;
  for (const part1 of parts1) {
    for (const part2 of parts2) {
      if (part1 === part2 || part1.includes(part2) || part2.includes(part1)) {
        matchingParts++;
        break;
      }
    }
  }

  const partScore =
    (matchingParts / Math.max(parts1.length, parts2.length)) * 100;

  // Use general similarity as well
  const generalScore = calculateSimilarity(n1, n2);

  // Return the higher score
  return Math.max(partScore, generalScore);
}

/**
 * Highlight matching parts between two strings
 */
export function highlightMatches(str1: string, str2: string): string {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);

  const highlighted: string[] = [];
  const originalWords = str1.split(/\s+/);

  for (let i = 0; i < originalWords.length; i++) {
    const word = words1[i];
    const isMatch = words2.some(
      (w) => w === word || w.includes(word) || word.includes(w)
    );

    if (isMatch) {
      highlighted.push(`**${originalWords[i]}**`);
    } else {
      highlighted.push(originalWords[i]);
    }
  }

  return highlighted.join(' ');
}
