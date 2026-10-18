import { afterAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import { reconcileOrderCustomers } from '../../scripts/reconcile-order-customers';

const database = new PrismaClient();
const rollback = new Error('Rollback identity test');
const domains = [
  {
    name: 'clothing',
    customers: 'public."Customer"',
    orders: 'public.transactions',
  },
  {
    name: 'general-merchandise',
    customers: 'general_merchandise.customers',
    orders: 'general_merchandise.transactions',
  },
] as const;

async function isolatedTest(
  run: (client: Prisma.TransactionClient) => Promise<void>
) {
  await expect(
    database.$transaction(async (client) => {
      await run(client);
      throw rollback;
    })
  ).rejects.toBe(rollback);
}

async function createCustomer(
  client: Prisma.TransactionClient,
  table: string,
  name: string
) {
  const [customer] = await client.$queryRaw<{ id: number }[]>(Prisma.sql`
    INSERT INTO ${Prisma.raw(table)} (
      "createdAt", "updatedAt", date, "customerName", "phoneNumber", address,
      facebook, "emailAddress", "businessName", "taxNumber", "businessAddress",
      "businessContactNumber", "customerStatus"
    ) VALUES (now(), now(), '2026-10-18', ${name}, '', '', '', '', '', '', '', '', 'Active')
    RETURNING id
  `);
  return customer.id;
}

afterAll(() => database.$disconnect());

describe.each(domains)(
  'Permanent customer identity: $name',
  ({ name: domain, customers, orders }) => {
    it('previews then reconciles a confirmed old name and follows later renames', async () => {
      await isolatedTest(async (client) => {
        const oldName = `Historical ${crypto.randomUUID()}`;
        const customerId = await createCustomer(
          client,
          customers,
          `Current ${crypto.randomUUID()}`
        );
        await client.$executeRaw(Prisma.sql`
        INSERT INTO ${Prisma.raw(orders)} ("createdAt", "updatedAt", customers, "orderStatus")
        VALUES (now(), now(), ${oldName}, 'Shipped')
      `);
        const options = { domain, from: oldName, customerId };
        expect(await reconcileOrderCustomers(client, options)).toMatchObject({
          orders: 1,
          updated: 0,
          applied: false,
        });
        const [previewOrder] = await client.$queryRaw<
          { customerId: number | null; customers: string }[]
        >(Prisma.sql`
        SELECT "customerId", customers FROM ${Prisma.raw(orders)} WHERE customers = ${oldName}
      `);
        expect(previewOrder).toEqual({ customerId: null, customers: oldName });
        expect(
          await reconcileOrderCustomers(client, { ...options, apply: true })
        ).toMatchObject({ orders: 1, updated: 1, applied: true });
        const audit = await client.auditLog.findFirst({
          where: {
            action: 'RECONCILE_CUSTOMER',
            targetId: String(customerId),
          },
        });
        expect(audit?.after).toMatchObject({
          customerId,
          source: 'reconcile-order-customers',
        });
        const newName = `Final ${crypto.randomUUID()}`;
        await client.$executeRaw(Prisma.sql`
        UPDATE ${Prisma.raw(customers)} SET "customerName" = ${newName} WHERE id = ${customerId}
      `);
        const records = await client.$queryRaw<
          { customers: string }[]
        >(Prisma.sql`
        SELECT customers FROM ${Prisma.raw(orders)} WHERE "customerId" = ${customerId}
      `);
        expect(records).toEqual([{ customers: newName }]);
      });
    });

    it('refuses a reconciliation name owned by another customer', async () => {
      await isolatedTest(async (client) => {
        const source = `Other ${crypto.randomUUID()}`;
        await createCustomer(client, customers, source);
        const targetId = await createCustomer(
          client,
          customers,
          `Target ${crypto.randomUUID()}`
        );
        await expect(
          reconcileOrderCustomers(client, {
            domain,
            from: source,
            customerId: targetId,
            apply: true,
          })
        ).rejects.toThrow('Source name belongs to another customer');
      });
    });

    it('links name-only orders and renames every status without changing financial fields', async () => {
      await isolatedTest(async (client) => {
        const oldName = `Identity old ${crypto.randomUUID()}`;
        const newName = `Identity new ${crypto.randomUUID()}`;
        const customerId = await createCustomer(client, customers, oldName);
        const statuses = [
          'Shipped',
          'Cancelled',
          'Prepared',
          'Paid',
          'In Transit',
          'Voided',
        ];
        for (const status of statuses) {
          await client.$executeRaw(Prisma.sql`
          INSERT INTO ${Prisma.raw(orders)} (
            "createdAt", "updatedAt", customers, "orderStatus", quantity,
            "unitPrice", discount, adjustment, "lineTotal", "deletedAt"
          ) VALUES (now(), now(), ${oldName}, ${status}, 3, 100, 5, 2, 298,
            CASE WHEN ${status} = 'Voided' THEN now() ELSE NULL END)
        `);
        }
        await client.$executeRaw(Prisma.sql`
        UPDATE ${Prisma.raw(customers)} SET "customerName" = ${newName} WHERE id = ${customerId}
      `);
        const records = await client.$queryRaw<
          {
            customerId: number;
            customers: string;
            orderStatus: string;
            quantity: number;
            unitPrice: number;
            discount: number;
            adjustment: number;
            lineTotal: number;
          }[]
        >(
          Prisma.sql`SELECT * FROM ${Prisma.raw(orders)} WHERE "customerId" = ${customerId}`
        );
        expect(records).toHaveLength(statuses.length);
        expect(records.map((record) => record.orderStatus).sort()).toEqual(
          [...statuses].sort()
        );
        for (const record of records) {
          expect(record).toMatchObject({
            customerId,
            customers: newName,
            quantity: 3,
            unitPrice: 100,
            discount: 5,
            adjustment: 2,
            lineTotal: 298,
          });
        }
      });
    });

    it('uses an explicit ID as authority and preserves identity through duplicate names', async () => {
      await isolatedTest(async (client) => {
        const name = `Duplicate ${crypto.randomUUID()}`;
        const customerId = await createCustomer(client, customers, name);
        await createCustomer(client, customers, name);
        const [order] = await client.$queryRaw<
          { id: number; customerId: number; customers: string }[]
        >(Prisma.sql`
        INSERT INTO ${Prisma.raw(orders)} ("createdAt", "updatedAt", "customerId", customers)
        VALUES (now(), now(), ${customerId}, 'stale name') RETURNING *
      `);
        expect(order).toMatchObject({ customerId, customers: name });
        const newName = `Renamed ${crypto.randomUUID()}`;
        await client.$executeRaw(Prisma.sql`
        UPDATE ${Prisma.raw(customers)} SET "customerName" = ${newName} WHERE id = ${customerId}
      `);
        const [renamed] = await client.$queryRaw<
          { customerId: number; customers: string }[]
        >(Prisma.sql`
        SELECT * FROM ${Prisma.raw(orders)} WHERE id = ${order.id}
      `);
        expect(renamed).toMatchObject({ customerId, customers: newName });
      });
    });

    it('does not guess unknown or duplicate names', async () => {
      await isolatedTest(async (client) => {
        const name = `Ambiguous ${crypto.randomUUID()}`;
        await createCustomer(client, customers, name);
        await createCustomer(client, customers, name);
        for (const candidate of [name, `Unknown ${crypto.randomUUID()}`]) {
          const [order] = await client.$queryRaw<
            { customerId: number | null; customers: string }[]
          >(Prisma.sql`
          INSERT INTO ${Prisma.raw(orders)} ("createdAt", "updatedAt", customers)
          VALUES (now(), now(), ${candidate}) RETURNING *
        `);
          expect(order).toMatchObject({
            customerId: null,
            customers: candidate,
          });
        }
      });
    });

    it('reassigns an order when a different unique customer is selected', async () => {
      await isolatedTest(async (client) => {
        const firstName = `First ${crypto.randomUUID()}`;
        const secondName = `Second ${crypto.randomUUID()}`;
        const firstId = await createCustomer(client, customers, firstName);
        const secondId = await createCustomer(client, customers, secondName);
        const [order] = await client.$queryRaw<{ id: number }[]>(Prisma.sql`
        INSERT INTO ${Prisma.raw(orders)} ("createdAt", "updatedAt", "customerId")
        VALUES (now(), now(), ${firstId}) RETURNING id
      `);
        const [updated] = await client.$queryRaw<
          { customerId: number; customers: string }[]
        >(Prisma.sql`
        UPDATE ${Prisma.raw(orders)} SET customers = ${secondName} WHERE id = ${order.id} RETURNING *
      `);
        expect(updated).toMatchObject({
          customerId: secondId,
          customers: secondName,
        });
      });
    });

    it('rejects stale names instead of silently breaking a permanent link', async () => {
      await expect(
        database.$transaction(async (client) => {
          const name = `Stale ${crypto.randomUUID()}`;
          const customerId = await createCustomer(client, customers, name);
          const [order] = await client.$queryRaw<{ id: number }[]>(Prisma.sql`
        INSERT INTO ${Prisma.raw(orders)} ("createdAt", "updatedAt", "customerId")
        VALUES (now(), now(), ${customerId}) RETURNING id
      `);
          await client.$executeRaw(Prisma.sql`
        UPDATE ${Prisma.raw(customers)} SET "customerName" = ${`${name} renamed`} WHERE id = ${customerId}
      `);
          await client.$executeRaw(Prisma.sql`
        UPDATE ${Prisma.raw(orders)} SET customers = ${name} WHERE id = ${order.id}
      `);
        })
      ).rejects.toThrow('Customer name is missing or ambiguous');
    });
  }
);
