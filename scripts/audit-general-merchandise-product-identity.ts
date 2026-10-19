import { prisma } from '@/lib/db';

type DuplicateCode = { code: string; productIds: number[] };
type TableIdentityState = { table_name: string };
type IdentityCounts = {
  linked: bigint;
  unlinked: bigint;
  unique_code_match: bigint;
  ambiguous_code: bigint;
  unmatched_code: bigint;
  blank_code: bigint;
};

const productTables = [
  { tableName: 'prices', codeColumn: 'productCode' },
  { tableName: 'transactions', codeColumn: 'productCode' },
  { tableName: 'inventory_movements', codeColumn: 'productCode' },
  { tableName: 'sorting_distributions', codeColumn: 'productCode' },
  { tableName: 'bundle_batch_components', codeColumn: 'componentProductCode' },
  { tableName: 'inventory_reclass_entries', codeColumn: 'productCode' },
] as const;

async function main() {
  const duplicates = await prisma.$queryRaw<DuplicateCode[]>`
    SELECT lower(btrim("productCode")) AS code, array_agg(id ORDER BY id) AS "productIds"
    FROM general_merchandise.products
    WHERE "deletedAt" IS NULL AND nullif(btrim("productCode"), '') IS NOT NULL
    GROUP BY lower(btrim("productCode")) HAVING count(*) > 1
    ORDER BY code
  `;

  const productCounts = await prisma.$queryRaw<
    {
      total: bigint;
      active: bigint;
    }[]
  >`
    SELECT count(*) AS total,
      count(*) FILTER (WHERE "deletedAt" IS NULL) AS active
    FROM general_merchandise.products
  `;

  const identityColumns = await prisma.$queryRaw<TableIdentityState[]>`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'general_merchandise'
      AND column_name = 'productId'
      AND table_name = ANY(${productTables.map(({ tableName }) => tableName)})
  `;
  const linkedTables = new Set(
    identityColumns.map(({ table_name }) => table_name)
  );

  const unlinkedRows = await Promise.all(
    productTables.map(async ({ tableName, codeColumn }) => {
      const hasProductId = linkedTables.has(tableName);
      const linkedPredicate = hasProductId
        ? 'record."productId" IS NOT NULL'
        : 'FALSE';
      const candidatePredicate = hasProductId
        ? 'record."productId" IS NULL'
        : 'TRUE';

      const [counts] = await prisma.$queryRawUnsafe<IdentityCounts[]>(`
        SELECT
          count(*) FILTER (WHERE ${linkedPredicate}) AS linked,
          count(*) FILTER (WHERE ${candidatePredicate}) AS unlinked,
          count(*) FILTER (
            WHERE ${candidatePredicate}
              AND nullif(btrim(record."${codeColumn}"), '') IS NOT NULL
              AND matches.match_count = 1
          ) AS unique_code_match,
          count(*) FILTER (
            WHERE ${candidatePredicate}
              AND nullif(btrim(record."${codeColumn}"), '') IS NOT NULL
              AND matches.match_count > 1
          ) AS ambiguous_code,
          count(*) FILTER (
            WHERE ${candidatePredicate}
              AND nullif(btrim(record."${codeColumn}"), '') IS NOT NULL
              AND coalesce(matches.match_count, 0) = 0
          ) AS unmatched_code,
          count(*) FILTER (
            WHERE ${candidatePredicate}
              AND nullif(btrim(record."${codeColumn}"), '') IS NULL
          ) AS blank_code
        FROM general_merchandise."${tableName}" AS record
        LEFT JOIN (
          SELECT lower(btrim("productCode")) AS code, count(*) AS match_count
          FROM general_merchandise.products
          WHERE "deletedAt" IS NULL
            AND nullif(btrim("productCode"), '') IS NOT NULL
          GROUP BY lower(btrim("productCode"))
        ) AS matches
          ON lower(btrim(record."${codeColumn}")) = matches.code
      `);

      return {
        source: tableName,
        productIdColumnExists: hasProductId,
        linked: Number(counts.linked),
        unlinked: Number(counts.unlinked),
        uniqueCodeMatch: Number(counts.unique_code_match),
        ambiguousCode: Number(counts.ambiguous_code),
        unmatchedCode: Number(counts.unmatched_code),
        blankCode: Number(counts.blank_code),
      };
    })
  );

  console.log(
    JSON.stringify(
      {
        activeProducts: Number(productCounts[0]?.active ?? 0),
        totalProducts: Number(productCounts[0]?.total ?? 0),
        duplicateActiveCodes: duplicates,
        productRecords: unlinkedRows,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
