import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';
import type * as NextAuth from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { getServerSession as getRootSession } from 'next-auth';
import { prisma } from '@/lib/db';
import { PUT, POST, DELETE } from '@/app/api/payroll/route';
import { getTestApiUrl } from '@/core/testing/test-helpers';

vi.mock('next-auth/next', () => ({ getServerSession: vi.fn() }));
vi.mock('next-auth', async (importOriginal) => ({
  ...(await importOriginal<typeof NextAuth>()),
  getServerSession: vi.fn(),
}));

let failure: 'expense' | 'deduction' | 'thirteenth' | null = null;
let paymentBarrier: {
  id: string;
  reads: number;
  ready: Promise<void>;
  release: () => void;
} | null = null;

prisma.$use(async (parameters, next) => {
  if (
    failure === 'expense' &&
    parameters.model === 'Expense' &&
    parameters.action === 'upsert'
  ) {
    throw new Error('INJECTED_PAYROLL_EXPENSE_FAILURE');
  }
  if (
    failure === 'deduction' &&
    parameters.model === 'CashAdvanceDeduction' &&
    parameters.action === 'createMany'
  ) {
    throw new Error('INJECTED_PAYROLL_DEDUCTION_FAILURE');
  }
  if (
    failure === 'thirteenth' &&
    parameters.model === 'ThirteenthMonthPayRecord' &&
    parameters.action === 'update'
  ) {
    throw new Error('INJECTED_PAYROLL_THIRTEENTH_FAILURE');
  }
  const result = await next(parameters);
  const barrier = paymentBarrier;
  if (
    barrier &&
    parameters.model === 'Payroll' &&
    ['findUnique', 'findFirst'].includes(parameters.action) &&
    parameters.args.where.id === barrier.id
  ) {
    barrier.reads++;
    if (barrier.reads === 2) {
      barrier.release();
    }
    await barrier.ready;
  }
  return result;
});

beforeEach(() => {
  failure = null;
  paymentBarrier = null;
  const session = {
    user: {
      id: 'integration-admin',
      name: 'Integration Admin',
      email: 'integration@example.test',
      role: 'ADMIN',
    },
    expires: '2099-01-01T00:00:00.000Z',
  };
  vi.mocked(getServerSession).mockResolvedValue(session);
  vi.mocked(getRootSession).mockResolvedValue(session);
});

async function createFixture(withThirteenth = false) {
  const employeeId = `P-${randomUUID().slice(0, 12)}`;
  const employee = await prisma.employee.create({
    data: {
      employeeId,
      firstName: 'Payroll',
      lastName: 'Fixture',
      name: employeeId,
      contact: 'test-only',
      department: 'Test',
      position: 'Test',
      jobTitle: 'Test',
      status: 'active',
      hireDate: '2026-01-01',
      basicSalary: 26000,
      sssMonthlyContribution: 0,
      philHealthMonthlyContribution: 0,
      pagibigMonthlyContribution: 0,
      taxMonthlyContribution: 0,
    },
  });
  const payroll = await prisma.payroll.create({
    data: {
      employeeId,
      employeeName: employee.name,
      payPeriod: '2026-10-01 to 2026-10-15',
      periodStart: '2026-10-01',
      periodEnd: '2026-10-15',
      basicSalary: 13000,
      thirteenthMonth: withThirteenth ? 1000 : 0,
      grossPay: withThirteenth ? 14000 : 13000,
      netPay: withThirteenth ? 14000 : 13000,
      status: 'approved',
      bankGcash: 'fixture-only',
    },
  });
  const advance = await prisma.cashAdvanceRecord.create({
    data: {
      employeeId,
      employeeName: employee.name,
      amount: 3000,
      remainingBalance: 3000,
      settledAmount: 0,
      monthlyPayment: 500,
      status: 'approved',
      deductionCycle: 'FIRST_HALF',
      nextDeductionDate: new Date('2026-10-15T00:00:00Z'),
    },
  });
  const thirteenth = withThirteenth
    ? await prisma.thirteenthMonthPayRecord.create({
        data: {
          recordId: `${employeeId.toLowerCase()}-2026`,
          employeeId,
          employeeName: employee.name,
          year: 2026,
          status: 'approved',
          thirteenthMonthPay: 1000,
        },
      })
    : null;
  return { employee, payroll, advance, thirteenth };
}

const pay = (id: string) =>
  PUT(
    new NextRequest(getTestApiUrl('/api/payroll'), {
      method: 'PUT',
      body: JSON.stringify({ id, status: 'paid', paidDate: '2026-10-15' }),
    })
  );

async function expectUnpaid(
  fixture: Awaited<ReturnType<typeof createFixture>>
) {
  const payroll = await prisma.payroll.findUniqueOrThrow({
    where: { id: fixture.payroll.id },
  });
  expect(payroll.status).toBe('approved');
  expect(payroll.cashAdvance).toBe(0);
  expect(payroll.paidDate).toBeNull();
  const advance = await prisma.cashAdvanceRecord.findUniqueOrThrow({
    where: { id: fixture.advance.id },
  });
  expect(Number(advance.remainingBalance)).toBe(3000);
  expect(Number(advance.settledAmount)).toBe(0);
  expect(advance.lastDeductedDate).toBeNull();
  expect(advance.nextDeductionDate).toEqual(fixture.advance.nextDeductionDate);
  expect(
    await prisma.cashAdvanceDeduction.count({
      where: { payrollId: fixture.payroll.id },
    })
  ).toBe(0);
  expect(
    await prisma.expense.count({
      where: { sourceType: 'PAYROLL', sourceId: fixture.payroll.id },
    })
  ).toBe(0);
  if (fixture.thirteenth) {
    expect(
      (
        await prisma.thirteenthMonthPayRecord.findUniqueOrThrow({
          where: { id: fixture.thirteenth.id },
        })
      ).status
    ).toBe('approved');
  }
}

describe('Integration - clothing payroll payment lifecycle', () => {
  it.each(['expense', 'deduction', 'thirteenth'] as const)(
    'rolls back a %s failure and safely retries exactly once',
    async (point) => {
      const fixture = await createFixture(true);
      failure = point;
      expect((await pay(fixture.payroll.id)).status).toBe(500);
      failure = null;
      await expectUnpaid(fixture);

      expect((await pay(fixture.payroll.id)).status).toBe(200);
      const committed = await prisma.payroll.findUniqueOrThrow({
        where: { id: fixture.payroll.id },
      });
      expect(committed.status).toBe('paid');
      expect(committed.cashAdvance).toBe(500);
      const advance = await prisma.cashAdvanceRecord.findUniqueOrThrow({
        where: { id: fixture.advance.id },
      });
      expect(Number(advance.remainingBalance)).toBe(2500);
      expect(Number(advance.settledAmount)).toBe(500);
      expect((await pay(fixture.payroll.id)).status).toBe(200);
      expect(
        await prisma.payroll.findUniqueOrThrow({
          where: { id: fixture.payroll.id },
        })
      ).toEqual(committed);
      expect(
        await prisma.cashAdvanceRecord.findUniqueOrThrow({
          where: { id: fixture.advance.id },
        })
      ).toEqual(advance);
      expect(
        await prisma.cashAdvanceDeduction.count({
          where: { payrollId: fixture.payroll.id },
        })
      ).toBe(1);
      const expenses = await prisma.expense.findMany({
        where: { sourceType: 'PAYROLL', sourceId: fixture.payroll.id },
      });
      expect(expenses).toHaveLength(1);
      expect(expenses[0].amount).toBe(committed.netPay);
      if (!fixture.thirteenth) {
        throw new Error('This fixture must include a 13th-month record');
      }
      expect(
        (
          await prisma.thirteenthMonthPayRecord.findUniqueOrThrow({
            where: { id: fixture.thirteenth.id },
          })
        ).status
      ).toBe('paid');
    }
  );

  it('arbitrates concurrent payment requests and preserves deductions on retry', async () => {
    const fixture = await createFixture();
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    paymentBarrier = { id: fixture.payroll.id, reads: 0, ready, release };
    const responses = await Promise.all([
      pay(fixture.payroll.id),
      pay(fixture.payroll.id),
    ]);
    paymentBarrier = null;
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    expect((await pay(fixture.payroll.id)).status).toBe(200);
    expect(
      await prisma.cashAdvanceDeduction.count({
        where: { payrollId: fixture.payroll.id },
      })
    ).toBe(1);
    expect(
      Number(
        (
          await prisma.cashAdvanceRecord.findUniqueOrThrow({
            where: { id: fixture.advance.id },
          })
        ).remainingBalance
      )
    ).toBe(2500);
  });

  it('rejects paid edits and both delete modes without losing expense or deduction history', async () => {
    const fixture = await createFixture();
    expect((await pay(fixture.payroll.id)).status).toBe(200);
    const response = await PUT(
      new NextRequest(getTestApiUrl('/api/payroll'), {
        method: 'PUT',
        body: JSON.stringify({ id: fixture.payroll.id, status: 'pending' }),
      })
    );
    expect(response.status).toBe(409);
    for (const permanent of ['false', 'true']) {
      expect(
        (
          await DELETE(
            new NextRequest(
              getTestApiUrl(
                `/api/payroll?id=${fixture.payroll.id}&permanent=${permanent}`
              ),
              { method: 'DELETE' }
            )
          )
        ).status
      ).toBe(409);
    }
    expect(
      (
        await prisma.payroll.findUniqueOrThrow({
          where: { id: fixture.payroll.id },
        })
      ).deletedAt
    ).toBeNull();
    expect(
      await prisma.cashAdvanceDeduction.count({
        where: { payrollId: fixture.payroll.id },
      })
    ).toBe(1);
    expect(
      await prisma.expense.count({
        where: { sourceType: 'PAYROLL', sourceId: fixture.payroll.id },
      })
    ).toBe(1);
  });

  it.each([false, true])(
    'rolls back paid creation on expense failure (bulk=%s)',
    async (bulk) => {
      const fixture = await createFixture();
      const input = {
        ...fixture.payroll,
        id: undefined,
        payPeriod: '2026-10-16 to 2026-10-31',
        periodStart: '2026-10-16',
        periodEnd: '2026-10-31',
        status: 'paid',
      };
      failure = 'expense';
      const response = await POST(
        new NextRequest(getTestApiUrl('/api/payroll'), {
          method: 'POST',
          body: JSON.stringify(bulk ? [input] : input),
        })
      );
      failure = null;
      expect(response.status).toBe(500);
      expect(
        await prisma.payroll.count({
          where: {
            employeeId: fixture.employee.employeeId,
            periodStart: input.periodStart,
          },
        })
      ).toBe(0);
    }
  );
});
