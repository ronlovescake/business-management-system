import { prisma } from '@/lib/db';

type DuplicateCode = { code: string; productIds: number[] };
type UnlinkedRows = { source: string; count: bigint };

async function main() {
  const duplicates = await prisma.$queryRaw<DuplicateCode[]>`
    SELECT lower(btrim("productCode")) AS code, array_agg(id ORDER BY id) AS "productIds"
    FROM public.products
    WHERE "deletedAt" IS NULL AND nullif(btrim("productCode"), '') IS NOT NULL
    GROUP BY lower(btrim("productCode")) HAVING count(*) > 1
    ORDER BY code
  `;

  const unlinked = await prisma.$queryRaw<UnlinkedRows[]>`
    SELECT 'prices' AS source, count(*) AS count FROM public.prices WHERE "productId" IS NULL
    UNION ALL SELECT 'transactions', count(*) FROM public.transactions WHERE "productId" IS NULL AND "productCode" IS NOT NULL
    UNION ALL SELECT 'inventory_movements', count(*) FROM public.inventory_movements WHERE "productId" IS NULL
    UNION ALL SELECT 'sorting_distributions', count(*) FROM public.sorting_distributions WHERE "productId" IS NULL
    UNION ALL SELECT 'bundle_batch_components', count(*) FROM public.bundle_batch_components WHERE "productId" IS NULL
    UNION ALL SELECT 'split_batch_components', count(*) FROM public.split_batch_components WHERE "productId" IS NULL
    UNION ALL SELECT 'clothing_inventory_reclass_entries', count(*) FROM public.clothing_inventory_reclass_entries WHERE "productId" IS NULL
    ORDER BY source
  `;

  console.log(
    JSON.stringify(
      {
        duplicateActiveCodes: duplicates,
        unlinkedRows: unlinked.map((row) => ({
          source: row.source,
          count: Number(row.count),
        })),
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
