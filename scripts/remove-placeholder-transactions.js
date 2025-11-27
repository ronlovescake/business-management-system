#!/usr/bin/env node
/* eslint-disable no-console */

const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const envFile = process.env.CLEANUP_ENV_FILE || '.env.local';
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });

const prisma = new PrismaClient();
const MAX_SAMPLE = Number(process.env.CLEANUP_SAMPLE_SIZE || 20);

const blankStringCondition = (field) => ({
  OR: [{ [field]: null }, { [field]: '' }],
});

const zeroOrNullCondition = (field) => ({
  OR: [{ [field]: null }, { [field]: 0 }],
});

const placeholderWhere = {
  deletedAt: null,
  shipmentCode: '-',
  AND: [
    blankStringCondition('orderDate'),
    blankStringCondition('customers'),
    blankStringCondition('productCode'),
    blankStringCondition('invoiceDate'),
    blankStringCondition('packedDate'),
    blankStringCondition('notes'),
    blankStringCondition('orderStatus'),
    zeroOrNullCondition('quantity'),
    zeroOrNullCondition('unitPrice'),
    zeroOrNullCondition('discount'),
    zeroOrNullCondition('adjustment'),
    zeroOrNullCondition('lineTotal'),
  ],
};

async function main() {
  console.log('🧹 Placeholder cleanup starting...');
  console.log(`Environment file: ${envFile}`);
  console.log(`Mode: ${applyChanges ? 'APPLY' : 'DRY-RUN'}`);

  const totalPlaceholders = await prisma.transaction.count({
    where: placeholderWhere,
  });

  if (totalPlaceholders === 0) {
    console.log('✅ No placeholder transactions detected.');
    return;
  }

  console.log(
    `Found ${totalPlaceholders.toLocaleString()} placeholder transactions.`
  );

  const sample = await prisma.transaction.findMany({
    where: placeholderWhere,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      id: 'asc',
    },
    take: MAX_SAMPLE,
  });

  if (sample.length) {
    console.log(
      'Sample IDs to be deleted:',
      sample.map((row) => row.id).join(', ')
    );
  }

  if (!applyChanges) {
    console.log('Dry-run complete. Re-run with --apply to delete these rows.');
    return;
  }

  const result = await prisma.transaction.deleteMany({
    where: placeholderWhere,
  });
  console.log(
    `🗑️ Deleted ${result.count.toLocaleString()} placeholder transactions.`
  );
}

main()
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
