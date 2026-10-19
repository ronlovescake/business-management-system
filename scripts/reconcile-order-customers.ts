import { parseArgs } from 'node:util';
import { config as loadEnv } from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';

type Domain = 'clothing' | 'general-merchandise';
interface ReconciliationOptions {
  domain: Domain;
  from?: string;
  customerId?: number;
  canonicalCustomerId?: number;
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

  if (
    options.canonicalCustomerId !== undefined &&
    options.domain !== 'general-merchandise'
  ) {
    throw new Error(
      '--canonical-customer-id is only valid for general-merchandise'
    );
  }

  if (
    options.from === undefined &&
    options.customerId === undefined &&
    options.canonicalCustomerId === undefined
  ) {
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

  const hasDomainCustomerId = options.customerId !== undefined;
  const hasCanonicalCustomerId = options.canonicalCustomerId !== undefined;
  if (
    !options.from?.trim() ||
    hasDomainCustomerId === hasCanonicalCustomerId ||
    (options.customerId !== undefined &&
      (!Number.isSafeInteger(options.customerId) || options.customerId <= 0)) ||
    (options.canonicalCustomerId !== undefined &&
      (!Number.isSafeInteger(options.canonicalCustomerId) ||
        options.canonicalCustomerId <= 0))
  ) {
    throw new Error(
      'Mapping requires --from and exactly one positive --customer-id or --canonical-customer-id'
    );
  }

  if (hasCanonicalCustomerId) {
    await client.$executeRaw(Prisma.sql`
      LOCK TABLE public."Customer", general_merchandise.customers,
        general_merchandise.transactions IN SHARE ROW EXCLUSIVE MODE
    `);
  } else {
    await client.$executeRaw(
      Prisma.sql`LOCK TABLE ${customers}, ${orders} IN SHARE ROW EXCLUSIVE MODE`
    );
  }

  let customerId = options.customerId ?? null;
  let customerName = '';
  let clothingCustomer: Awaited<ReturnType<typeof client.customer.findUnique>> =
    null;
  let gmCustomer: Awaited<
    ReturnType<typeof client.generalMerchandiseCustomer.findUnique>
  > = null;

  if (hasCanonicalCustomerId) {
    clothingCustomer = await client.customer.findUnique({
      where: { id: options.canonicalCustomerId },
    });
    if (!clothingCustomer || clothingCustomer.deletedAt) {
      throw new Error('Canonical Clothing customer must exist and be active');
    }
    customerName = clothingCustomer.customerName;

    gmCustomer = await client.generalMerchandiseCustomer.findUnique({
      where: { clothingCustomerId: clothingCustomer.id },
    });
    if (!gmCustomer) {
      const sameNameCustomers =
        await client.generalMerchandiseCustomer.findMany({
          where: { customerName: clothingCustomer.customerName },
        });
      if (sameNameCustomers.length > 1) {
        throw new Error(
          'Multiple GM customer records match the canonical name'
        );
      }
      gmCustomer = sameNameCustomers[0] ?? null;
      if (
        gmCustomer?.clothingCustomerId !== null &&
        gmCustomer?.clothingCustomerId !== undefined &&
        gmCustomer.clothingCustomerId !== clothingCustomer.id
      ) {
        throw new Error('GM customer is linked to another Clothing customer');
      }
    }
    customerId = gmCustomer?.id ?? null;
  } else {
    const [customer] = await client.$queryRaw<
      { id: number; customerName: string; deletedAt: Date | null }[]
    >(Prisma.sql`
      SELECT id, "customerName", "deletedAt" FROM ${customers} WHERE id = ${options.customerId}
    `);
    if (!customer || customer.deletedAt) {
      throw new Error('Target customer must exist and must not be deleted');
    }
    customerId = customer.id;
    customerName = customer.customerName;
  }

  const [conflicts] = await client.$queryRaw<{ count: number }[]>(Prisma.sql`
    SELECT (
      (SELECT COUNT(*) FROM ${customers} WHERE "customerName" = ${options.from} AND id <> ${customerId ?? -1}) +
      (SELECT COUNT(*) FROM ${orders} WHERE customers = ${options.from}
        AND "customerId" IS NOT NULL AND "customerId" <> ${customerId ?? -1})
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
  let resolvedCustomerId = customerId;
  if (options.apply) {
    if (hasCanonicalCustomerId && resolvedCustomerId === null) {
      if (!clothingCustomer) {
        throw new Error('Canonical Clothing customer could not be resolved');
      }
      const customerData = {
        date: clothingCustomer.date,
        customerName: clothingCustomer.customerName,
        phoneNumber: clothingCustomer.phoneNumber,
        address: clothingCustomer.address,
        facebook: clothingCustomer.facebook,
        emailAddress: clothingCustomer.emailAddress,
        businessName: clothingCustomer.businessName,
        taxNumber: clothingCustomer.taxNumber,
        businessAddress: clothingCustomer.businessAddress,
        businessContactNumber: clothingCustomer.businessContactNumber,
        customerStatus: clothingCustomer.customerStatus,
      };
      const linkedCustomer = gmCustomer
        ? await client.generalMerchandiseCustomer.update({
            where: { id: gmCustomer.id },
            data: {
              ...customerData,
              clothingCustomer: { connect: { id: clothingCustomer.id } },
              deletedAt: null,
            },
          })
        : await client.generalMerchandiseCustomer.create({
            data: {
              ...customerData,
              clothingCustomer: { connect: { id: clothingCustomer.id } },
            },
          });
      resolvedCustomerId = linkedCustomer.id;
    }

    if (resolvedCustomerId === null) {
      throw new Error('Target customer could not be resolved');
    }
    const updatedOrders = await client.$queryRaw<{ id: number }[]>(Prisma.sql`
      UPDATE ${orders} SET "customerId" = ${resolvedCustomerId}, "updatedAt" = CURRENT_TIMESTAMP
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
          targetId: String(resolvedCustomerId),
          before: { customerId: null, customers: options.from },
          after: {
            customerId: resolvedCustomerId,
            customers: customerName,
            orderIds: updatedOrders.map((order) => order.id),
            source: 'reconcile-order-customers',
            ...(hasCanonicalCustomerId
              ? { canonicalCustomerId: options.canonicalCustomerId }
              : {}),
          },
        },
      });
    }
  }
  return {
    customerId: resolvedCustomerId,
    customerName,
    ...(hasCanonicalCustomerId
      ? { canonicalCustomerId: options.canonicalCustomerId }
      : {}),
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
      'canonical-customer-id': { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
  });
  if (
    !values.env ||
    !['clothing', 'general-merchandise'].includes(values.domain ?? '')
  ) {
    throw new Error(
      'Usage: npx tsx scripts/reconcile-order-customers.ts --env <file> --domain <clothing|general-merchandise> [--from <old name> (--customer-id <id>|--canonical-customer-id <id>)] [--apply]'
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
          canonicalCustomerId:
            values['canonical-customer-id'] === undefined
              ? undefined
              : Number(values['canonical-customer-id']),
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
