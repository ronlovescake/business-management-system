#!/usr/bin/env node

/**
 * Schema Drift Check
 *
 * Compares the Prisma schema model definitions against the actual database
 * to detect missing columns or tables that would cause runtime query failures.
 *
 * This catches the gap where `prisma db push` (used in tests) syncs from
 * schema.prisma directly, but `prisma migrate deploy` (used in production)
 * only applies migration files. If a schema change has no matching migration,
 * tests pass but production breaks.
 *
 * Usage:
 *   node scripts/check-schema-drift.js                    # uses DATABASE_URL from .env
 *   DATABASE_URL=postgresql://... node scripts/check-schema-drift.js
 *   node scripts/check-schema-drift.js --docker production # uses docker exec against named stack
 *   node scripts/check-schema-drift.js --docker dev        # uses dev stack
 *
 * Exit codes:
 *   0 = no drift
 *   1 = drift detected (missing columns or tables)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const dockerIdx = args.indexOf('--docker');
const dockerStack = dockerIdx >= 0 ? (args[dockerIdx + 1] || 'production') : null;
const quiet = args.includes('--quiet');

const log = quiet ? () => {} : (...a) => console.log(...a);
const logErr = (...a) => console.error(...a);

// ---------------------------------------------------------------------------
// 1. Parse schema.prisma
// ---------------------------------------------------------------------------
const SCALAR_TYPES = new Set([
  'String', 'Int', 'Float', 'Decimal', 'Boolean',
  'DateTime', 'BigInt', 'Bytes', 'Json',
]);

function parseSchema(schemaPath) {
  const content = fs.readFileSync(schemaPath, 'utf8');
  const lines = content.split('\n');
  const models = {};
  let cur = null;

  for (const line of lines) {
    const modelMatch = line.match(/^model\s+(\w+)\s*\{/);
    if (modelMatch) {
      cur = modelMatch[1];
      models[cur] = { columns: [], schema: 'public', table: null };
    } else if (cur && line.trim() === '}') {
      if (!models[cur].table) models[cur].table = cur;
      cur = null;
    } else if (cur) {
      const mapMatch = line.match(/@@map\(["']([^"']+)["']\)/);
      if (mapMatch) {
        models[cur].table = mapMatch[1];
      } else {
        const schemaMatch = line.match(/@@schema\(["']([^"']+)["']\)/);
        if (schemaMatch) {
          models[cur].schema = schemaMatch[1];
        } else {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('@@') || trimmed.startsWith('//')) {
            // skip
          } else {
            const fieldMatch = trimmed.match(/^(\w+)\s+(\w+[\[\]?]*)/);
            if (fieldMatch) {
              const [, fieldName, rawType] = fieldMatch;
              const baseType = rawType.replace('?', '').replace('[]', '');

              // Skip relation arrays (e.g. posts Post[])
              if (rawType.endsWith('[]') && !SCALAR_TYPES.has(baseType)) {
                // skip
              }
              // Skip relation fields (e.g. author User @relation(...))
              else if (
                !SCALAR_TYPES.has(baseType) &&
                baseType[0] === baseType[0].toUpperCase() &&
                trimmed.includes('@relation')
              ) {
                // skip
              }
              // Scalar or enum field — resolve DB column name via @map()
              else if (
                SCALAR_TYPES.has(baseType) ||
                (!SCALAR_TYPES.has(baseType) && baseType[0] === baseType[0].toUpperCase())
              ) {
                const colMap = trimmed.match(/@map\(["']([^"']+)["']\)/);
                models[cur].columns.push(colMap ? colMap[1] : fieldName);
              }
            }
          }
        }
      }
    }
  }

  // Build { "schema.table": { model, columns } }
  const result = {};
  for (const [model, info] of Object.entries(models)) {
    result[`${info.schema}.${info.table}`] = { model, columns: info.columns };
  }
  return result;
}

// ---------------------------------------------------------------------------
// 2. Query actual DB columns
// ---------------------------------------------------------------------------
function queryDbColumns(dockerStack) {
  const sql = `
    SELECT table_schema || '.' || table_name || '::' || column_name
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'general_merchandise')
      AND table_name NOT LIKE '_prisma%'
    ORDER BY table_schema, table_name, ordinal_position;
  `.trim();

  let stdout;
  if (dockerStack) {
    const explicitContainer = process.env.BMS_DOCKER_DB_CONTAINER;
    const containerCandidates = {
      production: [
        'business-management-production-db-1',
        'business-management-system-dev-db-1',
      ],
      dev: ['business-management-system-dev-db-1'],
      test: ['business-management-development-test-postgres-test-1'],
    };
    const runningContainers = new Set(
      execSync("docker ps --format '{{.Names}}'", {
        encoding: 'utf8',
        timeout: 30000,
      })
        .split('\n')
        .map((name) => name.trim())
        .filter(Boolean)
    );
    const candidates = explicitContainer
      ? [explicitContainer]
      : containerCandidates[dockerStack] || [dockerStack];
    const container =
      candidates.find((name) => runningContainers.has(name)) || candidates[0];
    stdout = execSync(
      `docker exec ${container} psql -U postgres -d business_management -t -A -c "${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', timeout: 30000 }
    );
  } else {
    // Use DATABASE_URL from environment or .env
    if (!process.env.DATABASE_URL) {
      try {
        const dotenv = require('dotenv');
        dotenv.config();
      } catch {
        // dotenv not available, DATABASE_URL must be in env
      }
    }

    if (!process.env.DATABASE_URL) {
      logErr('Error: DATABASE_URL not set. Use --docker <stack> or set DATABASE_URL.');
      process.exit(1);
    }

    // Extract connection details from DATABASE_URL
    const url = new URL(process.env.DATABASE_URL);
    const host = url.hostname;
    const port = url.port || '5432';
    const user = url.username;
    const db = url.pathname.replace('/', '');
    const pgPassword = url.password ? `PGPASSWORD=${url.password}` : '';

    stdout = execSync(
      `${pgPassword} psql -h ${host} -p ${port} -U ${user} -d ${db} -t -A -c "${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', timeout: 30000 }
    );
  }

  const dbColumns = {};
  const dbTables = new Set();
  for (const line of stdout.trim().split('\n')) {
    const [tableKey, col] = line.split('::');
    if (tableKey && col) {
      dbTables.add(tableKey);
      if (!dbColumns[tableKey]) dbColumns[tableKey] = new Set();
      dbColumns[tableKey].add(col);
    }
  }
  return { dbColumns, dbTables };
}

// ---------------------------------------------------------------------------
// 3. Compare and report
// ---------------------------------------------------------------------------
function compare(schemaModels, dbColumns, dbTables) {
  const missingTables = [];
  const missingColumns = [];

  for (const [tableKey, info] of Object.entries(schemaModels)) {
    if (!dbTables.has(tableKey)) {
      missingTables.push({ table: tableKey, model: info.model });
    } else {
      const cols = dbColumns[tableKey] || new Set();
      for (const col of info.columns) {
        if (!cols.has(col)) {
          missingColumns.push({ table: tableKey, model: info.model, column: col });
        }
      }
    }
  }

  return { missingTables, missingColumns };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const schemaPath = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');
log('Parsing schema:', schemaPath);
const schemaModels = parseSchema(schemaPath);
const tableCount = Object.keys(schemaModels).length;
log(`Found ${tableCount} models in schema.prisma`);

log(`Querying database columns (${dockerStack ? 'docker:' + dockerStack : 'DATABASE_URL'})...`);
const { dbColumns, dbTables } = queryDbColumns(dockerStack);
log(`Found ${dbTables.size} tables in database\n`);

const { missingTables, missingColumns } = compare(schemaModels, dbColumns, dbTables);

if (missingTables.length === 0 && missingColumns.length === 0) {
  log('✓ No schema drift detected across all ' + tableCount + ' models.');
  process.exit(0);
}

// Report drift
logErr('Schema drift detected!\n');

if (missingColumns.length > 0) {
  logErr('MISSING COLUMNS (in schema.prisma but not in database):');
  for (const m of missingColumns) {
    logErr(`  ✗ ${m.table} (${m.model}): "${m.column}"`);
  }
  logErr('');
}

if (missingTables.length > 0) {
  logErr('MISSING TABLES (in schema.prisma but not in database):');
  for (const t of missingTables) {
    logErr(`  ✗ ${t.table} (${t.model})`);
  }
  logErr('');
}

logErr(
  `Total: ${missingColumns.length} missing column(s), ` +
  `${missingTables.length} missing table(s).`
);
logErr('Fix: Create a migration to add these columns/tables, then run prisma migrate deploy.');
process.exit(1);
