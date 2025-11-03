#!/usr/bin/env node

/**
 * Merge Customer Data Script
 *
 * Merges two CSV files:
 * 1. Customer Database (existing customers with full info)
 * 2. Shopee Usernames (delivery names, usernames, updated addresses)
 *
 * Strategy:
 * - Match customers by name (with normalization for variations)
 * - Use Shopee delivery address as primary address (more recent/accurate)
 * - Add Shopee usernames as "Shopee Username 1, 2, 3..." columns
 * - Keep customers who don't have Shopee accounts (pickup only)
 * - Create new customers for Shopee entries that don't match existing customers
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Helper Functions
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
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Normalize name for matching
 * Handles variations like:
 * - "John Doe | Jane Doe" -> ["john doe", "jane doe"]
 * - "Mary-Ann Smith" -> ["mary ann smith", "maryann smith"]
 */
function normalizeNames(name) {
  const names = [];

  // Split by pipe
  const parts = name.split('|').map((p) => p.trim());

  parts.forEach((part) => {
    // Convert to lowercase and remove extra spaces
    const normalized = part.toLowerCase().replace(/\s+/g, ' ').trim();
    names.push(normalized);

    // Also add version without hyphens
    if (normalized.includes('-')) {
      names.push(normalized.replace(/-/g, ' ').replace(/\s+/g, ' '));
      names.push(normalized.replace(/-/g, ''));
    }
  });

  return [...new Set(names)]; // Remove duplicates
}

/**
 * Check if two names match
 */
function namesMatch(name1, name2) {
  const normalized1 = normalizeNames(name1);
  const normalized2 = normalizeNames(name2);

  // Check if any variation matches
  for (const n1 of normalized1) {
    for (const n2 of normalized2) {
      if (n1 === n2) {
        return true;
      }

      // Check if one name is contained in the other (for partial matches)
      if (n1.length > 5 && n2.length > 5) {
        if (n1.includes(n2) || n2.includes(n1)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Read and parse CSV file
 */
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error(
      `CSV file ${filePath} must have headers and at least one data row`
    );
  }

  const headers = parseCSVLine(lines[0]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return { headers, rows };
}

// ============================================================================
// Main Merge Logic
// ============================================================================

function mergeCustomerData() {
  console.log('🔄 Starting customer data merge...\n');

  const csvDir = path.join(__dirname, '..', 'csv', 'for update');
  const customerDbPath = path.join(
    csvDir,
    'Czarlie & Ron Customer Database - customers-export-2025-10-24.csv'
  );
  const shopeeDataPath = path.join(
    csvDir,
    '2025 CHECKOUT DASHBOARD - Copy of Usernames.csv'
  );

  // Read both files
  console.log('📖 Reading customer database...');
  const customerDb = readCSV(customerDbPath);
  console.log(`   ✓ Loaded ${customerDb.rows.length} customers\n`);

  console.log('📖 Reading Shopee username data...');
  const shopeeData = readCSV(shopeeDataPath);
  console.log(`   ✓ Loaded ${shopeeData.rows.length} Shopee records\n`);

  // Group Shopee data by delivery name (same person can have multiple usernames)
  console.log('🔗 Grouping Shopee usernames by customer...');
  const shopeeByCustomer = {};

  shopeeData.rows.forEach((row) => {
    const deliveryName = row['Delivery Names'] || '';
    const username = row['Usernames'] || '';
    const address = row['Address'] || '';

    if (!deliveryName) {
      return;
    }

    if (!shopeeByCustomer[deliveryName]) {
      shopeeByCustomer[deliveryName] = {
        deliveryName,
        usernames: [],
        address: address, // Use the first address found
      };
    }

    if (
      username &&
      !shopeeByCustomer[deliveryName].usernames.includes(username)
    ) {
      shopeeByCustomer[deliveryName].usernames.push(username);
    }
  });

  console.log(
    `   ✓ Grouped into ${Object.keys(shopeeByCustomer).length} unique customers\n`
  );

  // Match and merge
  console.log('🔀 Matching and merging data...');
  const mergedCustomers = [];
  const matchedShopeeCustomers = new Set();
  const stats = {
    matched: 0,
    matchedWithAddress: 0,
    matchedNoAddress: 0,
    unmatched: 0,
    pickupOnly: 0,
  };

  // Process existing customers
  customerDb.rows.forEach((customer) => {
    const customerName = customer['Customer Name'] || '';
    if (!customerName) {
      return;
    }

    // Try to find matching Shopee data
    let shopeeMatch = null;

    for (const [deliveryName, shopeeInfo] of Object.entries(shopeeByCustomer)) {
      if (namesMatch(customerName, deliveryName)) {
        shopeeMatch = shopeeInfo;
        matchedShopeeCustomers.add(deliveryName);
        stats.matched++;
        break;
      }
    }

    // Build merged customer
    const merged = {
      Date: customer['Date'] || '',
      'Customer Name': customerName,
      'Phone Number': customer['Phone Number'] || '',
      Address:
        shopeeMatch && shopeeMatch.address
          ? shopeeMatch.address
          : customer['Address'] || '',
      Facebook: customer['Facebook'] || '',
      'Email Address': customer['Email Address'] || '',
      'Business Name': customer['Business Name'] || '',
      'Tax Number': customer['Tax Number'] || '',
      'Business Address': customer['Business Address'] || '',
      'Business Contact Number': customer['Business Contact Number'] || '',
      'Customer Status': customer['Customer Status'] || '',
    };

    // Add Shopee usernames (up to 5)
    if (shopeeMatch) {
      shopeeMatch.usernames.slice(0, 5).forEach((username, index) => {
        merged[`Shopee Username ${index + 1}`] = username;
      });

      if (shopeeMatch.address) {
        stats.matchedWithAddress++;
      } else {
        stats.matchedNoAddress++;
      }
    } else {
      stats.pickupOnly++;
    }

    // Fill empty username columns
    for (let i = (shopeeMatch?.usernames.length || 0) + 1; i <= 5; i++) {
      merged[`Shopee Username ${i}`] = '';
    }

    mergedCustomers.push(merged);
  });

  // Add Shopee customers that weren't matched (new customers)
  console.log('➕ Adding new customers from Shopee data...');
  for (const [deliveryName, shopeeInfo] of Object.entries(shopeeByCustomer)) {
    if (!matchedShopeeCustomers.has(deliveryName)) {
      const newCustomer = {
        Date: new Date().toISOString().slice(0, 10),
        'Customer Name': deliveryName,
        'Phone Number': '',
        Address: shopeeInfo.address || '',
        Facebook: '',
        'Email Address': '',
        'Business Name': '',
        'Tax Number': '',
        'Business Address': '',
        'Business Contact Number': '',
        'Customer Status': 'Active',
      };

      // Add Shopee usernames
      shopeeInfo.usernames.slice(0, 5).forEach((username, index) => {
        newCustomer[`Shopee Username ${index + 1}`] = username;
      });

      // Fill empty username columns
      for (let i = shopeeInfo.usernames.length + 1; i <= 5; i++) {
        newCustomer[`Shopee Username ${i}`] = '';
      }

      mergedCustomers.push(newCustomer);
      stats.unmatched++;
    }
  }

  console.log(`   ✓ Merged ${mergedCustomers.length} total customers\n`);

  // Write merged CSV
  console.log('💾 Writing merged CSV...');
  const outputPath = path.join(
    csvDir,
    `customers-merged-${new Date().toISOString().slice(0, 10)}.csv`
  );

  const headers = [
    'Date',
    'Customer Name',
    'Phone Number',
    'Address',
    'Facebook',
    'Email Address',
    'Business Name',
    'Tax Number',
    'Business Address',
    'Business Contact Number',
    'Customer Status',
    'Shopee Username 1',
    'Shopee Username 2',
    'Shopee Username 3',
    'Shopee Username 4',
    'Shopee Username 5',
  ];

  const csvLines = [headers.join(',')];

  mergedCustomers.forEach((customer) => {
    const row = headers.map((header) => escapeCSVField(customer[header] || ''));
    csvLines.push(row.join(','));
  });

  fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf-8');
  console.log(`   ✓ Saved to: ${outputPath}\n`);

  // Print statistics
  console.log('📊 Merge Statistics:');
  console.log('═══════════════════════════════════════');
  console.log(`Total customers in merged file: ${mergedCustomers.length}`);
  console.log(`  ├─ Matched with Shopee data: ${stats.matched}`);
  console.log(`  │  ├─ With updated address: ${stats.matchedWithAddress}`);
  console.log(`  │  └─ Address unchanged: ${stats.matchedNoAddress}`);
  console.log(`  ├─ Pickup only (no Shopee): ${stats.pickupOnly}`);
  console.log(`  └─ New from Shopee data: ${stats.unmatched}`);
  console.log('═══════════════════════════════════════\n');

  // Show customers with most usernames
  const customersWithMostUsernames = mergedCustomers
    .map((c) => ({
      name: c['Customer Name'],
      count: [1, 2, 3, 4, 5].filter((i) => c[`Shopee Username ${i}`]).length,
    }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (customersWithMostUsernames.length > 0) {
    console.log('🏆 Top 10 customers with most Shopee usernames:');
    console.log('═══════════════════════════════════════');
    customersWithMostUsernames.forEach((c, i) => {
      console.log(
        `${i + 1}. ${c.name}: ${c.count} username${c.count > 1 ? 's' : ''}`
      );
    });
    console.log('');
  }

  // Show warnings
  const warnings = [];
  const customersExceeding5 = Object.values(shopeeByCustomer).filter(
    (s) => s.usernames.length > 5
  );

  if (customersExceeding5.length > 0) {
    warnings.push(
      `⚠️  ${customersExceeding5.length} customers have more than 5 Shopee usernames (truncated to 5)`
    );
    console.log('⚠️  Customers with >5 usernames (truncated):');
    console.log('═══════════════════════════════════════');
    customersExceeding5.slice(0, 5).forEach((c) => {
      console.log(`   • ${c.deliveryName}: ${c.usernames.length} usernames`);
    });
    if (customersExceeding5.length > 5) {
      console.log(`   ... and ${customersExceeding5.length - 5} more`);
    }
    console.log('');
  }

  console.log('✅ Merge complete!\n');
  console.log('📝 Next steps:');
  console.log('   1. Review the merged CSV file');
  console.log('   2. Import using the "Detailed (Numbered Columns)" format');
  console.log(
    '   3. The import will automatically create AdditionalCustomerInfo records'
  );
  console.log('');

  return outputPath;
}

// ============================================================================
// Run Script
// ============================================================================

try {
  mergeCustomerData();
  process.exit(0);
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
