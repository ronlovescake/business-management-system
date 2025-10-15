#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

const envFile = process.env.SNAPSHOT_ENV_FILE || '.env.local';
const envPath = path.resolve(process.cwd(), envFile);
dotenv.config({ path: envPath });

const prisma = new PrismaClient();

const metrics = [
  { table: 'transactions', delegate: (client) => client.transaction },
  { table: 'shipments', delegate: (client) => client.shipment },
  { table: 'customers', delegate: (client) => client.customer },
];

async function collect() {
  const snapshot = {
    generatedAt: new Date().toISOString(),
    environment: envFile,
    tables: {},
  };

  for (const { table, delegate } of metrics) {
    const model = delegate(prisma);
    const count = await model.count();
    const latest = await model.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { id: true, updatedAt: true },
    });

    snapshot.tables[table] = {
      count,
      recent: latest,
    };
  }

  const dir = path.resolve(process.cwd(), 'snapshots');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const file = path.join(
    dir,
    `snapshot-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  );
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2));
  console.log(`📸 Snapshot written to ${file}`);
}

collect()
  .catch((error) => {
    console.error('❌ Failed to generate snapshot', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
