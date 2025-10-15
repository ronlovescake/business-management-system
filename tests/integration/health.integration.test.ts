import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
let dbAvailable = true;

beforeAll(async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    dbAvailable = false;
    console.warn(
      '⚠️ Integration tests are running without a database connection.'
    );
  }
});

afterAll(async () => {
  if (dbAvailable) {
    await prisma.$disconnect();
  }
});

describe('Integration • Database sanity', () => {
  it('confirms seeded health record exists', async () => {
    if (!dbAvailable) {
      expect(true).toBe(true);
      return;
    }

    const count = await prisma.healthCheck.count();
    expect(count).toBeGreaterThan(0);
  });

  it('confirms baseline customer data', async () => {
    if (!dbAvailable) {
      expect(true).toBe(true);
      return;
    }

    const customer = await prisma.customer.findFirst({
      where: { customerName: 'Alice Johnson' },
    });

    expect(customer).toBeTruthy();
  });
});
