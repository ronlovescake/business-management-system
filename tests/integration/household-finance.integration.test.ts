import { describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { householdRecurringPaymentService } from '@/modules/household/recurringPayments/api';

const uniqueSuffix = () => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

describe('Integration • Household Finance', () => {
  it('generates a recurring paid expense once and leaves the source idempotent on rerun', async () => {
    const suffix = uniqueSuffix();
    const account = await prisma.householdAccount.create({
      data: {
        name: `HF Recurring Account ${suffix}`,
        type: 'CASH',
        balance: 1000,
        isActive: true,
      },
    });

    const template = await prisma.householdRecurringPayment.create({
      data: {
        name: `HF Internet ${suffix}`,
        amount: 120,
        category: 'Utilities - Internet',
        startDate: '2026-01-31',
        monthsCount: null,
        isActive: true,
        deductOnGenerate: true,
        accountId: account.id,
      },
    });

    try {
      const first = await householdRecurringPaymentService.generateForMonth({
        month: '2026-02',
      });

      const generated = await prisma.householdExpense.findFirst({
        where: {
          sourceType: 'RECURRING',
          sourceId: template.id,
          sourceLineKey: '2026-02',
        },
      });

      const refreshedAccount = await prisma.householdAccount.findUnique({
        where: { id: account.id },
      });

      expect(first.month).toBe('2026-02');
      expect(first.created).toBeGreaterThanOrEqual(1);
      expect(generated).toMatchObject({
        date: '2026-02-28',
        status: 'paid',
        accountId: account.id,
        sourceType: 'RECURRING',
        sourceId: template.id,
        sourceLineKey: '2026-02',
      });
      expect(Number(generated?.amount)).toBe(120);
      expect(Number(refreshedAccount?.balance)).toBe(880);

      const second = await householdRecurringPaymentService.generateForMonth({
        month: '2026-02',
      });
      const generatedCount = await prisma.householdExpense.count({
        where: {
          sourceType: 'RECURRING',
          sourceId: template.id,
          sourceLineKey: '2026-02',
        },
      });

      expect(second.month).toBe('2026-02');
      expect(generatedCount).toBe(1);
    } finally {
      await prisma.householdExpense.deleteMany({
        where: { sourceId: template.id },
      });
      await prisma.householdRecurringPayment.deleteMany({
        where: { id: template.id },
      });
      await prisma.householdAccount.deleteMany({
        where: { id: account.id },
      });
    }
  });

  it('creates a pending recurring expense without decrementing the linked account balance', async () => {
    const suffix = uniqueSuffix();
    const account = await prisma.householdAccount.create({
      data: {
        name: `HF Pending Account ${suffix}`,
        type: 'BANK',
        balance: 2500,
        isActive: true,
      },
    });

    const template = await prisma.householdRecurringPayment.create({
      data: {
        name: `HF Water ${suffix}`,
        amount: 80,
        category: 'Utilities - Water',
        startDate: '2026-03-15',
        monthsCount: 6,
        isActive: true,
        deductOnGenerate: false,
        accountId: account.id,
      },
    });

    try {
      const result = await householdRecurringPaymentService.generateForMonth({
        month: '2026-03',
      });

      const generated = await prisma.householdExpense.findFirst({
        where: {
          sourceType: 'RECURRING',
          sourceId: template.id,
          sourceLineKey: '2026-03',
        },
      });

      const refreshedAccount = await prisma.householdAccount.findUnique({
        where: { id: account.id },
      });

      expect(result.month).toBe('2026-03');
      expect(result.created).toBeGreaterThanOrEqual(1);
      expect(generated).toMatchObject({
        status: 'pending',
        accountId: account.id,
        sourceType: 'RECURRING',
        sourceId: template.id,
        sourceLineKey: '2026-03',
      });
      expect(Number(refreshedAccount?.balance)).toBe(2500);
    } finally {
      await prisma.householdExpense.deleteMany({
        where: { sourceId: template.id },
      });
      await prisma.householdRecurringPayment.deleteMany({
        where: { id: template.id },
      });
      await prisma.householdAccount.deleteMany({
        where: { id: account.id },
      });
    }
  });
});
