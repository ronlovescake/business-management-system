import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';

type Domain = 'clothing' | 'general-merchandise';
interface ReconciliationOptions {
  domain: Domain;
  from?: string;
  customerId?: number;
  apply?: boolean;
}

export async function reconcileOrderCustomers(
  client: Prisma.TransactionClient,
  options: ReconciliationOptions
) {
  if (!['clothing', 'general-merchandise'].includes(options.domain)) {
    throw new Error('Choose clothing or general-merchandise');
  }
  const customers = Prisma.raw(
    options.domain === 'clothing'
      ? 'public."Customer"'
      : 'general_merchandise.customers'
  );
  const orders = Prisma.raw(
    options.domain === 'clothing'
      ? 'public.transactions'
      : 'general_merchandise.transactions'
  );

  if (options.from === undefined && options.customerId === undefined) {
    if (options.apply) {
      throw new Error('Applying requires --from and --customer-id');
    }
    return client.$queryRaw(Prisma.sql`
      SELECT orders.customers AS name, COUNT(*)::int AS orders,
        ARRAY(SELECT customer.id FROM ${customers} customer
          WHERE customer."customerName" = orders.customers ORDER BY customer.id) AS "candidateIds"
      FROM ${orders} orders WHERE orders."customerId" IS NULL
      GROUP BY orders.customers ORDER BY COUNT(*) DESC, orders.customers
    `);
  }

  if (
    !options.from?.trim() ||
    options.customerId === undefined ||
    !Number.isSafeInteger(options.customerId) ||
    options.customerId <= 0
  ) {
    throw new Error(
      'Mapping requires a nonblank --from and a positive --customer-id'
    );
  }

  await client.$executeRaw(
    Prisma.sql`LOCK TABLE ${customers}, ${orders} IN SHARE ROW EXCLUSIVE MODE`
  );
  const [customer] = await client.$queryRaw<
    { id: number; customerName: string; deletedAt: Date | null }[]
  >(Prisma.sql`
    SELECT id, "customerName", "deletedAt" FROM ${customers} WHERE id = ${options.customerId}
  `);
  if (!customer || customer.deletedAt) {
    throw new Error('Target customer must exist and must not be deleted');
  }

  const [conflicts] = await client.$queryRaw<{ count: number }[]>(Prisma.sql`
    SELECT (
      (SELECT COUNT(*) FROM ${customers} WHERE "customerName" = ${options.from} AND id <> ${customer.id}) +
      (SELECT COUNT(*) FROM ${orders} WHERE customers = ${options.from}
        AND "customerId" IS NOT NULL AND "customerId" <> ${customer.id})
    )::int AS count
  `);
  if (conflicts.count > 0) {
    throw new Error(
      'Source name belongs to another customer; review individual order IDs instead'
    );
  }

  const statuses = await client.$queryRaw<
    { status: string | null; orders: number }[]
  >(Prisma.sql`
    SELECT "orderStatus" AS status, COUNT(*)::int AS orders FROM ${orders}
    WHERE "customerId" IS NULL AND customers = ${options.from}
    GROUP BY "orderStatus" ORDER BY "orderStatus"
  `);
  const count = statuses.reduce((total, status) => total + status.orders, 0);
  let updated = 0;
  if (options.apply) {
    const updatedOrders = await client.$queryRaw<{ id: number }[]>(Prisma.sql`
      UPDATE ${orders} SET "customerId" = ${customer.id}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "customerId" IS NULL AND customers = ${options.from}
      RETURNING id
    `);
    updated = updatedOrders.length;
    if (updated > 0) {
      await client.auditLog.create({
        data: {
          model:
            options.domain === 'clothing'
              ? 'Transaction'
              : 'GeneralMerchandiseTransaction',
          action: 'RECONCILE_CUSTOMER',
          targetId: String(customer.id),
          before: { customerId: null, customers: options.from },
          after: {
            customerId: customer.id,
            customers: customer.customerName,
            orderIds: updatedOrders.map((order) => order.id),
            source: 'reconcile-order-customers',
          },
        },
      });
    }
  }
  return {
    customerId: customer.id,
    customerName: customer.customerName,
    sourceName: options.from,
    orders: count,
    statuses,
    applied: Boolean(options.apply),
    updated,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      env: { type: 'string' },
      domain: { type: 'string' },
      from: { type: 'string' },
      'customer-id': { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
  });
  if (
    !values.env ||
    !['clothing', 'general-merchandise'].includes(values.domain ?? '')
  ) {
    throw new Error(
      'Usage: npx tsx scripts/reconcile-order-customers.ts --env <file> --domain <clothing|general-merchandise> [--from <old name> --customer-id <id>] [--apply]'
    );
  }
  const environment = loadEnv({ path: values.env });
  const databaseUrl = environment.parsed?.DATABASE_URL;
  if (environment.error || !databaseUrl) {
    throw new Error('The explicit environment file must contain DATABASE_URL');
  }
  const target = new URL(databaseUrl);
  console.info(
    `Target: ${target.hostname}:${target.port || '5432'}${target.pathname}; ${values.apply ? 'APPLY' : 'DRY RUN'}`
  );
  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  try {
    const result = await client.$transaction(
      (transaction) =>
        reconcileOrderCustomers(transaction, {
          domain: values.domain as Domain,
          from: values.from,
          customerId:
            values['customer-id'] === undefined
              ? undefined
              : Number(values['customer-id']),
          apply: values.apply,
        }),
      {
        timeout: 30000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
    console.info(JSON.stringify(result, null, 2));
  } finally {
    await client.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Reconciliation failed'
    );
    process.exitCode = 1;
  });
}
