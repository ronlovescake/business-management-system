#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Report trips missing customerId and optionally apply a mapping file.
 *
 * Usage:
 *   node scripts/trucking-trip-customer-backfill.js               # report only (read-only)
 *   node scripts/trucking-trip-customer-backfill.js --apply map.json  # apply mappings from file
 *
 * Mapping file format (JSON):
 * [
 *   { "tripId": "trip_cuid", "customerId": 123 },
 *   ...
 * ]
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

const envFile = process.env.CUSTOM_ENV_FILE || '.env';
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const applyIndex = args.indexOf('--apply');
  return {
    applyFile: applyIndex >= 0 ? args[applyIndex + 1] : null,
  };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalize(str = '') {
  return String(str).toLowerCase().trim();
}

function findCandidates(trip, customers, limit = 3) {
  const haystack =
    `${trip.destination || ''} ${trip.remarks || ''}`.toLowerCase();
  const matches = [];

  for (const customer of customers) {
    const name = normalize(customer.customerName || customer.name || '');
    if (!name) {
      continue;
    }
    if (haystack.includes(name)) {
      matches.push({
        customerId: customer.id,
        customerName: customer.customerName || customer.name,
        reason: 'name matched in destination/remarks',
      });
    }
    if (matches.length >= limit) {
      break;
    }
  }

  return matches;
}

async function reportMissing() {
  const [trips, customers] = await Promise.all([
    prisma.truckingTrip.findMany({
      where: { customerId: null, deletedAt: null },
      select: {
        id: true,
        date: true,
        truckId: true,
        destination: true,
        driver: true,
        helper: true,
        grossRevenue: true,
        fuelCost: true,
        maintenance: true,
        tollFees: true,
        miscExpenses: true,
        totalExpenses: true,
        remarks: true,
        status: true,
        completedAt: true,
      },
    }),
    prisma.customer.findMany({
      select: { id: true, customerName: true, name: true },
    }),
  ]);

  if (trips.length === 0) {
    console.log('✅ All trips have customerId set.');
    return;
  }

  const enriched = trips.map((trip) => ({
    ...trip,
    candidates: findCandidates(trip, customers),
  }));

  ensureDir(path.resolve(process.cwd(), 'scripts/output'));
  const outFile = path.resolve(
    process.cwd(),
    'scripts/output/trucking-trips-missing-customer.json'
  );
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        envFile,
        missingCount: enriched.length,
        trips: enriched,
      },
      null,
      2
    )
  );

  console.log(
    `⚠️  Found ${enriched.length} trips without customerId. Report: ${outFile}`
  );
}

async function applyMappings(filePath) {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Mapping file not found: ${fullPath}`);
  }

  const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  if (!Array.isArray(data)) {
    throw new Error('Mapping file must be an array of { tripId, customerId }');
  }

  let applied = 0;
  for (const entry of data) {
    const tripId = entry.tripId;
    const customerId = Number(entry.customerId);
    if (!tripId || !Number.isFinite(customerId)) {
      console.warn('Skipping invalid mapping', entry);
      continue;
    }

    const trip = await prisma.truckingTrip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: { id: true, customerId: true },
    });
    if (!trip) {
      console.warn(`Trip not found: ${tripId}`);
      continue;
    }
    if (trip.customerId) {
      console.warn(`Trip already has customerId, skipping: ${tripId}`);
      continue;
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      console.warn(`Customer not found: ${customerId}`);
      continue;
    }

    await prisma.truckingTrip.update({
      where: { id: tripId },
      data: { customerId },
    });
    applied += 1;
  }

  console.log(`✅ Applied ${applied} customer mappings.`);
}

async function main() {
  const { applyFile } = parseArgs();

  if (applyFile) {
    console.log(`Applying mappings from ${applyFile} ...`);
    await applyMappings(applyFile);
  } else {
    await reportMissing();
  }
}

main()
  .catch((error) => {
    console.error('❌ Backfill script failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
