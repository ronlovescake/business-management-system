#!/usr/bin/env node

/**
 * Address Normalization and Deduplication Script
 *
 * This script:
 * 1. Normalizes addresses for comparison
 * 2. Detects duplicate addresses with quality scoring
 * 3. Selects the best quality address from duplicates
 * 4. Identifies genuinely different addresses for Additional Address columns
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const INPUT_FILE = path.join(
  __dirname,
  '..',
  'csv',
  'for update',
  'customers-merged-2025-11-03.csv'
);
const OUTPUT_FILE = path.join(
  __dirname,
  '..',
  'csv',
  'for update',
  'customers-normalized-2025-11-03.csv'
);
const REPORT_FILE = path.join(
  __dirname,
  '..',
  'csv',
  'for update',
  'address-normalization-report.txt'
);

// ============================================================================
// Address Normalization Functions
// ============================================================================

/**
 * Common abbreviation mappings
 */
const ABBREVIATION_MAP = {
  // Subdivision/Street
  subd: 'subdivision',
  subdv: 'subdivision',
  st: 'street',
  ave: 'avenue',
  rd: 'road',
  dr: 'drive',
  blvd: 'boulevard',
  hwy: 'highway',

  // Locations
  ph: 'phase',
  phs: 'phase',
  pkg: 'package',
  blk: 'block',
  lt: 'lot',
  brgy: 'barangay',
  bgy: 'barangay',
  pob: 'poblacion',

  // Building types
  bldg: 'building',
  apt: 'apartment',
  condo: 'condominium',

  // Directions
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
};

/**
 * Normalize address for comparison (case-insensitive, no punctuation)
 */
function normalizeAddressForComparison(address) {
  if (!address) {
    return '';
  }

  let normalized = address.toLowerCase().trim();

  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ');

  // Remove punctuation
  normalized = normalized.replace(/[,\.;:\(\)\[\]]/g, ' ');

  // Expand abbreviations
  Object.keys(ABBREVIATION_MAP).forEach((abbr) => {
    const full = ABBREVIATION_MAP[abbr];
    // Match whole words only
    const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
    normalized = normalized.replace(regex, full);
  });

  // Remove extra spaces again after replacements
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Expand abbreviations in address while preserving case and punctuation
 */
function expandAbbreviations(address) {
  if (!address) {
    return '';
  }

  let expanded = address;

  Object.keys(ABBREVIATION_MAP).forEach((abbr) => {
    const full = ABBREVIATION_MAP[abbr];

    // Match abbreviation with optional period, case-insensitive
    const regex = new RegExp(`\\b${abbr}\\.?\\b`, 'gi');

    expanded = expanded.replace(regex, (match) => {
      // Preserve capitalization pattern
      if (match[0] === match[0].toUpperCase()) {
        return full.charAt(0).toUpperCase() + full.slice(1);
      }
      return full;
    });
  });

  return expanded;
}

/**
 * Calculate quality score for an address
 */
function calculateQualityScore(address) {
  if (!address) {
    return 0;
  }

  let score = 0;
  const lower = address.toLowerCase();

  // Check for expanded forms (no abbreviations) - +3 points per full word
  const fullWords = [
    'subdivision',
    'street',
    'avenue',
    'phase',
    'package',
    'block',
    'barangay',
    'building',
  ];
  fullWords.forEach((word) => {
    if (lower.includes(word)) {
      score += 3;
    }
  });

  // Check for abbreviations (penalty) - -2 points per abbreviation
  const abbreviations = [
    'subd.',
    'st.',
    'ave.',
    'ph.',
    'phs.',
    'pkg.',
    'blk.',
    'brgy.',
  ];
  abbreviations.forEach((abbr) => {
    if (lower.includes(abbr)) {
      score -= 2;
    }
  });

  // Proper punctuation (commas between address parts) - +2 points
  const commaCount = (address.match(/,/g) || []).length;
  if (commaCount >= 3) {
    score += 2;
  }

  // Proper capitalization (not all lowercase or all uppercase) - +2 points
  if (address !== address.toLowerCase() && address !== address.toUpperCase()) {
    score += 2;
  }

  // Complete barangay info - +1 point
  if (lower.includes('barangay') || lower.includes('brgy')) {
    score += 1;
  }

  // No excessive landmarks in parentheses - +1 point
  const landmarkCount = (address.match(/\([^)]*store[^)]*\)/gi) || []).length;
  if (landmarkCount === 0) {
    score += 1;
  }

  // Consistent spacing (no double spaces) - +1 point
  if (!address.includes('  ')) {
    score += 1;
  }

  // Length bonus (more complete addresses) - +1 point per 50 chars (max 3)
  const lengthBonus = Math.min(3, Math.floor(address.length / 50));
  score += lengthBonus;

  return score;
}

/**
 * Calculate similarity between two strings (Levenshtein distance ratio)
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) {
    return 1.0;
  }

  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Levenshtein distance algorithm
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Check if two addresses are duplicates
 */
function areAddressesDuplicates(addr1, addr2, threshold = 0.9) {
  if (!addr1 || !addr2) {
    return false;
  }

  const normalized1 = normalizeAddressForComparison(addr1);
  const normalized2 = normalizeAddressForComparison(addr2);

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return true;
  }

  // High similarity threshold
  const similarity = calculateSimilarity(normalized1, normalized2);
  return similarity >= threshold;
}

/**
 * Select the best address from a group of duplicates
 */
function selectBestAddress(addresses) {
  if (!addresses || addresses.length === 0) {
    return '';
  }
  if (addresses.length === 1) {
    return addresses[0];
  }

  const scored = addresses.map((addr) => ({
    address: addr,
    score: calculateQualityScore(addr),
    normalized: normalizeAddressForComparison(addr),
  }));

  // Sort by score (highest first), then by length (longer first)
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.address.length - a.address.length;
  });

  return scored[0].address;
}

/**
 * Group addresses into duplicates and unique addresses
 */
function groupAddresses(addresses) {
  const groups = [];
  const processed = new Set();

  addresses.forEach((addr, index) => {
    if (processed.has(index) || !addr) {
      return;
    }

    const group = [addr];
    processed.add(index);

    // Find all duplicates of this address
    for (let i = index + 1; i < addresses.length; i++) {
      if (processed.has(i)) {
        continue;
      }

      if (areAddressesDuplicates(addr, addresses[i])) {
        group.push(addresses[i]);
        processed.add(i);
      }
    }

    groups.push(group);
  });

  return groups;
}

// ============================================================================
// CSV Processing Functions
// ============================================================================

/**
 * Parse CSV line handling quoted fields with commas
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Escape CSV field
 */
function escapeCSVField(field) {
  if (field === null || field === undefined) {
    return '';
  }
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Read CSV file
 */
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  const headers = parseCSVLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    data.push(row);
  }

  return { headers, data };
}

/**
 * Write CSV file
 */
function writeCSV(filePath, headers, data) {
  const lines = [headers.map(escapeCSVField).join(',')];

  data.forEach((row) => {
    const values = headers.map((header) => escapeCSVField(row[header] || ''));
    lines.push(values.join(','));
  });

  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

// ============================================================================
// Main Processing Logic
// ============================================================================

/**
 * Process customer data and normalize addresses
 */
function processCustomerAddresses() {
  console.log('🔍 Reading customer data...\n');

  const { headers, data } = readCSV(INPUT_FILE);

  const report = {
    totalCustomers: data.length,
    customersProcessed: 0,
    addressesImproved: 0,
    duplicatesFound: 0,
    multipleAddresses: 0,
    details: [],
  };

  console.log(`Found ${data.length} customers\n`);
  console.log('🔄 Processing addresses...\n');

  data.forEach((customer, index) => {
    const customerName = customer['Customer Name'];
    const primaryAddress = customer['Address'];

    // Collect all addresses for this customer
    const addresses = [primaryAddress];
    for (let i = 1; i <= 5; i++) {
      const additionalAddr = customer[`Additional Address ${i}`];
      if (additionalAddr) {
        addresses.push(additionalAddr);
      }
    }

    // Remove empty addresses
    const validAddresses = addresses.filter((addr) => addr && addr.trim());

    if (validAddresses.length === 0) {
      report.customersProcessed++;
      return;
    }

    // Group addresses into duplicates
    const groups = groupAddresses(validAddresses);

    // Select best address from each group
    const uniqueAddresses = groups.map((group) => {
      const best = selectBestAddress(group);

      // Expand abbreviations in the best address
      const expanded = expandAbbreviations(best);

      // Track if we found duplicates
      if (group.length > 1) {
        report.duplicatesFound++;
        report.details.push({
          customer: customerName,
          duplicates: group,
          selected: expanded,
          scores: group.map((addr) => ({
            address: addr,
            score: calculateQualityScore(addr),
          })),
        });
      }

      // Track if we improved the address
      if (expanded !== best) {
        report.addressesImproved++;
      }

      return expanded;
    });

    // Update customer record
    customer['Address'] = uniqueAddresses[0] || '';

    // Clear all additional address fields first
    for (let i = 1; i <= 5; i++) {
      customer[`Additional Address ${i}`] = '';
    }

    // Add remaining unique addresses to Additional Address columns
    for (let i = 1; i < uniqueAddresses.length && i < 6; i++) {
      customer[`Additional Address ${i}`] = uniqueAddresses[i];
    }

    if (uniqueAddresses.length > 1) {
      report.multipleAddresses++;
    }

    report.customersProcessed++;

    // Progress indicator
    if ((index + 1) % 100 === 0) {
      console.log(`  Processed ${index + 1}/${data.length} customers...`);
    }
  });

  console.log('\n✅ Processing complete!\n');

  // Write normalized CSV
  console.log('💾 Writing normalized CSV...\n');
  writeCSV(OUTPUT_FILE, headers, data);

  // Generate report
  console.log('📊 Generating report...\n');
  generateReport(report);

  // Print summary
  printSummary(report);
}

/**
 * Generate detailed report
 */
function generateReport(report) {
  const lines = [];

  lines.push(
    '═══════════════════════════════════════════════════════════════════'
  );
  lines.push('            ADDRESS NORMALIZATION REPORT');
  lines.push(
    '═══════════════════════════════════════════════════════════════════'
  );
  lines.push('');
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');
  lines.push(
    '───────────────────────────────────────────────────────────────────'
  );
  lines.push('SUMMARY');
  lines.push(
    '───────────────────────────────────────────────────────────────────'
  );
  lines.push('');
  lines.push(`Total Customers:              ${report.totalCustomers}`);
  lines.push(`Customers Processed:          ${report.customersProcessed}`);
  lines.push(`Addresses Improved:           ${report.addressesImproved}`);
  lines.push(`Duplicate Groups Found:       ${report.duplicatesFound}`);
  lines.push(`Customers w/ Multiple Addrs:  ${report.multipleAddresses}`);
  lines.push('');

  if (report.details.length > 0) {
    lines.push(
      '───────────────────────────────────────────────────────────────────'
    );
    lines.push('DUPLICATE ADDRESSES DETECTED');
    lines.push(
      '───────────────────────────────────────────────────────────────────'
    );
    lines.push('');

    report.details.forEach((detail, index) => {
      lines.push(`${index + 1}. ${detail.customer}`);
      lines.push('');
      lines.push('   Found Duplicates:');
      detail.scores.forEach(({ address, score }) => {
        lines.push(`   - [Score: ${score.toString().padStart(2)}] ${address}`);
      });
      lines.push('');
      lines.push(`   ✅ Selected: ${detail.selected}`);
      lines.push('');
      lines.push(
        '   ─────────────────────────────────────────────────────────────'
      );
      lines.push('');
    });
  }

  lines.push(
    '═══════════════════════════════════════════════════════════════════'
  );
  lines.push('END OF REPORT');
  lines.push(
    '═══════════════════════════════════════════════════════════════════'
  );

  fs.writeFileSync(REPORT_FILE, lines.join('\n'), 'utf-8');
}

/**
 * Print summary to console
 */
function printSummary(report) {
  console.log(
    '═══════════════════════════════════════════════════════════════════'
  );
  console.log('                           SUMMARY');
  console.log(
    '═══════════════════════════════════════════════════════════════════'
  );
  console.log('');
  console.log(`  Total Customers:              ${report.totalCustomers}`);
  console.log(`  Customers Processed:          ${report.customersProcessed}`);
  console.log(`  Addresses Improved:           ${report.addressesImproved}`);
  console.log(`  Duplicate Groups Found:       ${report.duplicatesFound}`);
  console.log(`  Customers w/ Multiple Addrs:  ${report.multipleAddresses}`);
  console.log('');
  console.log(
    '───────────────────────────────────────────────────────────────────'
  );
  console.log('');
  console.log(`✅ Output: ${OUTPUT_FILE}`);
  console.log(`📄 Report: ${REPORT_FILE}`);
  console.log('');
  console.log(
    '═══════════════════════════════════════════════════════════════════'
  );
}

// ============================================================================
// Execute
// ============================================================================

if (!fs.existsSync(INPUT_FILE)) {
  console.error(`❌ Error: Input file not found: ${INPUT_FILE}`);
  console.error('');
  console.error('Please ensure the merged customer CSV exists first.');
  console.error('Run: node scripts/merge-customer-data.js');
  process.exit(1);
}

try {
  processCustomerAddresses();
} catch (error) {
  console.error('❌ Error processing addresses:', error.message);
  console.error(error.stack);
  process.exit(1);
}
