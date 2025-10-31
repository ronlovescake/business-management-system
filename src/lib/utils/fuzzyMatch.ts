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
 * Calculate token-based similarity (more forgiving of word order and small differences)
 */
function calculateTokenSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) {
    return 0;
  }

  const tokens1 = str1
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1); // Ignore single characters
  const tokens2 = str2
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1);

  if (tokens1.length === 0 || tokens2.length === 0) {
    return 0;
  }

  let matchedTokens = 0;
  const used = new Set<number>();

  // Count tokens that match or are very similar
  for (const token1 of tokens1) {
    for (let i = 0; i < tokens2.length; i++) {
      if (used.has(i)) {
        continue;
      }

      const token2 = tokens2[i];

      // Exact match
      if (token1 === token2) {
        matchedTokens += 1;
        used.add(i);
        break;
      }

      // One contains the other (e.g., "mercdes" vs "mercedes")
      if (token1.includes(token2) || token2.includes(token1)) {
        matchedTokens += 0.9;
        used.add(i);
        break;
      }

      // Very similar (> 80% Levenshtein similarity)
      const similarity = calculateSimilarity(token1, token2);
      if (similarity >= 80) {
        matchedTokens += similarity / 100;
        used.add(i);
        break;
      }
    }
  }

  // Return percentage of matched tokens
  const totalTokens = Math.max(tokens1.length, tokens2.length);
  return Math.round((matchedTokens / totalTokens) * 100);
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
      // Standardize common abbreviations (more comprehensive)
      .replace(/\bst\b\.?/gi, 'street')
      .replace(/\bave\b\.?/gi, 'avenue')
      .replace(/\bavenue\b\.?/gi, 'avenue')
      .replace(/\brd\b\.?/gi, 'road')
      .replace(/\bblvd\b\.?/gi, 'boulevard')
      .replace(/\bblk\b\.?/gi, 'block')
      .replace(/\bapt\b\.?/gi, 'apartment')
      .replace(/\bunit\b\.?/gi, 'unit')
      .replace(/\bbrgy\b\.?/gi, 'barangay')
      .replace(/\bsubd\b\.?/gi, 'subdivision')
      .replace(/\bph\b\.?/gi, 'phase')
      .replace(/\bqc\b\.?/gi, 'quezon city')
      // Common typos and variations
      .replace(/mercdes/gi, 'mercedes')
      .replace(/excutive/gi, 'executive')
      .replace(/vilige/gi, 'village')
      .replace(/villge/gi, 'village')
      .replace(/pasig\s*city/gi, 'pasig')
      .replace(/metro\s*manila/gi, 'metromanila')
      // Remove common filler words
      .replace(/\b(the|of|at|in)\b/gi, '')
      // Remove punctuation but keep numbers
      .replace(/[,.;:#()\[\]]/g, ' ')
      // Standardize spacing around numbers
      .replace(/(\d+)\s*-\s*(\d+)/g, '$1-$2')
      // Remove extra spaces again after replacements
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Extract landmark identifiers (business names, buildings, etc.)
 * These are highly specific and should be weighted heavily
 */
function extractLandmarks(address: string): Set<string> {
  const landmarks = new Set<string>();

  // Common landmark patterns (case-insensitive matching)
  const landmarkPatterns = [
    // Buildings and establishments
    /\b([a-z]+\s+)?plaza\b/gi,
    /\b([a-z]+\s+)?mall\b/gi,
    /\b([a-z]+\s+)?tower\b/gi,
    /\b([a-z]+\s+)?building\b/gi,
    /\b([a-z]+\s+)?hotel\b/gi,
    /\b([a-z]+\s+)?condominium\b/gi,
    /\b([a-z]+\s+)?condo\b/gi,
    /\b([a-z]+\s+)?residence\b/gi,

    // Services and businesses
    /\b([a-z]+\s+)?gas\s+station\b/gi,
    /\b([a-z]+\s+)?gasoline\s+station\b/gi,
    /\b([a-z]+\s+)?carwash\b/gi,
    /\b([a-z]+\s+)?car\s+wash\b/gi,
    /\b([a-z]+\s+)?restaurant\b/gi,
    /\b([a-z]+\s+)?store\b/gi,
    /\b([a-z]+\s+)?shop\b/gi,
    /\b([a-z]+\s+)?market\b/gi,
    /\b([a-z]+\s+)?supermarket\b/gi,

    // Specific brand names (highly identifiable)
    /\bparagon\b/gi,
    /\bpetron\b/gi,
    /\bshell\b/gi,
    /\bcaltex\b/gi,
    /\bseaoil\b/gi,
    /\b7\s*-?\s*eleven\b/gi,
    /\bmercedes\b/gi,
    /\bsm\b/gi,
    /\brobinsons\b/gi,
    /\bayala\b/gi,
  ];

  for (const pattern of landmarkPatterns) {
    const matches = Array.from(address.matchAll(pattern));
    for (const match of matches) {
      // Add the full match (including prefix if any)
      const landmark = match[0].toLowerCase().trim().replace(/\s+/g, ' ');
      if (landmark.length > 2) {
        landmarks.add(landmark);
      }
    }
  }

  return landmarks;
}

/**
 * Extract street markers (KM markers, block numbers, lot numbers)
 * These are highly specific location identifiers
 */
function extractStreetMarkers(address: string): Set<string> {
  const markers = new Set<string>();

  // KM markers (Kilometer markers on highways)
  const kmPattern = /\bkm\s*\.?\s*(\d+\.?\d*)\b/gi;
  const kmMatches = Array.from(address.matchAll(kmPattern));
  for (const match of kmMatches) {
    markers.add(`km${match[1]}`); // Normalize to "km39", "km42", etc.
  }

  // Block numbers
  const blockPattern = /\bblk\.?\s*(\d+[a-z]?)\b/gi;
  const blockMatches = Array.from(address.matchAll(blockPattern));
  for (const match of blockMatches) {
    markers.add(`block${match[1]}`);
  }

  // Lot numbers
  const lotPattern = /\blot\.?\s*(\d+[a-z]?)\b/gi;
  const lotMatches = Array.from(address.matchAll(lotPattern));
  for (const match of lotMatches) {
    markers.add(`lot${match[1]}`);
  }

  // House/building numbers at the start
  const housePattern = /^(\d+[a-z]?)\s/i;
  const houseMatch = address.match(housePattern);
  if (houseMatch) {
    markers.add(`house${houseMatch[1]}`);
  }

  return markers;
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
  landmarks: Set<string>;
  streetMarkers: Set<string>;
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

  // Extract landmarks (brand names, buildings, etc.)
  const landmarks = extractLandmarks(address);

  // Extract street markers (KM, block, lot numbers)
  const streetMarkers = extractStreetMarkers(address);

  // Extract keywords (significant words) - focus on meaningful address components
  const stopWords = new Set([
    'street',
    'avenue',
    'road',
    'boulevard',
    'block',
    'apartment',
    'unit',
    'city',
    'metro',
    'floor',
    'gate',
    'phase',
    'subdivision',
    'village',
    'metromanila',
  ]);

  const keywords = new Set(
    normalized.split(/\s+/).filter((word) => {
      // Keep words that are:
      // - Numbers with letters (lot16b, 4a, etc.)
      // - Words longer than 2 characters
      // - Not in stop words list
      const hasNumberAndLetter = /\d/.test(word) && /[a-z]/.test(word);
      const isSignificant = word.length > 2 && !stopWords.has(word);
      return hasNumberAndLetter || isSignificant;
    })
  );

  return {
    street,
    city,
    province,
    zipCode,
    keywords,
    landmarks,
    streetMarkers,
  };
}

/**
 * Calculate address similarity score with component weighting
 * Prioritizes landmarks and street markers (KM, block numbers) as they are highly specific
 */
export function calculateAddressSimilarity(
  address1: string,
  address2: string
): number {
  if (!address1 || !address2) {
    return 0;
  }

  // Normalize both addresses
  const norm1 = normalizeAddress(address1);
  const norm2 = normalizeAddress(address2);

  // Quick check: if normalized addresses are very similar, return high score
  const directSimilarity = calculateSimilarity(norm1, norm2);
  if (directSimilarity >= 95) {
    return directSimilarity;
  }

  // Token-based similarity (more forgiving)
  const tokenSimilarity = calculateTokenSimilarity(norm1, norm2);

  // Component-based analysis
  const comp1 = extractAddressComponents(address1);
  const comp2 = extractAddressComponents(address2);

  let score = 0;
  let totalWeight = 0;

  // ===== HIGHEST PRIORITY: Landmarks (brand names, buildings) =====
  // These are HIGHLY specific and distinctive - if they match, it's likely the same place
  const commonLandmarks = new Set(
    Array.from(comp1.landmarks).filter((l) => comp2.landmarks.has(l))
  );
  if (comp1.landmarks.size > 0 || comp2.landmarks.size > 0) {
    totalWeight += 30; // Very high weight!
    if (commonLandmarks.size > 0) {
      // Full credit if any landmark matches
      score += 30;
    }
  }

  // ===== HIGH PRIORITY: Street Markers (KM, Block, Lot numbers) =====
  // These are precise location identifiers
  const commonMarkers = new Set(
    Array.from(comp1.streetMarkers).filter((m) => comp2.streetMarkers.has(m))
  );
  if (comp1.streetMarkers.size > 0 || comp2.streetMarkers.size > 0) {
    totalWeight += 25; // High weight!
    if (commonMarkers.size > 0) {
      // Proportional credit based on how many markers match
      const markerScore =
        (commonMarkers.size /
          Math.max(comp1.streetMarkers.size, comp2.streetMarkers.size)) *
        25;
      score += markerScore;
    }
  }

  // ===== MEDIUM PRIORITY: Geographic components =====
  // Exact zip code match (good confidence)
  if (comp1.zipCode && comp2.zipCode) {
    totalWeight += 10;
    if (comp1.zipCode === comp2.zipCode) {
      score += 10;
    }
  }

  // Province match
  if (comp1.province && comp2.province) {
    totalWeight += 8;
    if (comp1.province === comp2.province) {
      score += 8;
    }
  }

  // City match
  if (comp1.city && comp2.city) {
    totalWeight += 8;
    if (comp1.city === comp2.city) {
      score += 8;
    }
  }

  // ===== LOWER PRIORITY: Street similarity =====
  // Street-level matching (less reliable due to variations)
  totalWeight += 12;
  const streetLevenshtein = calculateSimilarity(comp1.street, comp2.street);
  const streetToken = calculateTokenSimilarity(comp1.street, comp2.street);
  const streetScore = Math.max(streetLevenshtein, streetToken);
  score += (streetScore / 100) * 12;

  // Keyword overlap (backup indicator)
  totalWeight += 7;
  const commonKeywords = new Set(
    Array.from(comp1.keywords).filter((k) => comp2.keywords.has(k))
  );
  const keywordScore =
    commonKeywords.size > 0
      ? (commonKeywords.size /
          Math.max(comp1.keywords.size, comp2.keywords.size)) *
        7
      : 0;
  score += keywordScore;

  // Normalize to 0-100
  const componentScore =
    totalWeight > 0 ? Math.round((score / totalWeight) * 100) : 0;

  // Return the best score from any method
  return Math.max(componentScore, tokenSimilarity, directSimilarity);
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
