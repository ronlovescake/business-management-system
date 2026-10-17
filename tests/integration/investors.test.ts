import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { buildInvestmentSchedule } from '@/lib/investors/schedule';
import {
  investorPostingLines,
  postInvestorPrincipal,
} from '@/lib/investors/accounting';

const prisma = new PrismaClient();
const rollback = new Error('Investor test rollback');

afterAll(() => prisma.$disconnect());

describe('investor persistence', () => {
  it('persists separate tranches with exact decimal amounts and bank adjustments', async () => {
    await expect(
      prisma.$transaction(async (transaction) => {
        const investor = await transaction.clothingInvestor.create({
          data: { name: 'Integration-only investor' },
        });
        const reference = `test-${investor.id}`;
        await transaction.clothingInvestmentAgreement.createMany({
          data: [
            {
              investorId: investor.id,
              reference: `${reference}-1`,
              effectiveDate: '2026-01-25',
              principal: '100000.10',
            },
            {
              investorId: investor.id,
              reference: `${reference}-2`,
              effectiveDate: '2026-02-28',
              principal: '20000.25',
            },
          ],
        });
        const saved = await transaction.clothingInvestor.findUniqueOrThrow({
          where: { id: investor.id },
          include: { agreements: { orderBy: { effectiveDate: 'asc' } } },
        });
        expect(saved.agreements).toHaveLength(2);
        expect(saved.agreements[0].principal.toFixed(2)).toBe('100000.10');
        const fundingInput = {
          agreementId: saved.agreements[0].id,
          kind: 'funding' as const,
          date: '2026-01-25',
        };
        const cutover = new Date('2026-01-17T00:00:00Z');
        await postInvestorPrincipal(transaction, fundingInput, cutover);
        await expect(
          postInvestorPrincipal(transaction, fundingInput, cutover)
        ).rejects.toThrow('already been recorded');
        await expect(
          postInvestorPrincipal(
            transaction,
            { ...fundingInput, kind: 'repayment', date: '2026-01-26' },
            cutover
          )
        ).rejects.toThrow('maturity');
        const closure = await transaction.clothingInvestorBankClosure.upsert({
          where: { date: '2026-04-27' },
          create: { date: '2026-04-27', name: 'Test closure' },
          update: { deletedAt: null },
        });
        const closures = await transaction.clothingInvestorBankClosure.findMany(
          { where: { deletedAt: null } }
        );
        const schedule = buildInvestmentSchedule(
          {
            effectiveDate: saved.agreements[0].effectiveDate,
            principalCents: saved.agreements[0].principal.mul(100).toNumber(),
            monthlyRateBps: saved.agreements[0].monthlyRateBps,
          },
          closures.map((item) => item.date)
        );
        expect(schedule.payouts[2].dueDate).toBe('2026-04-28');
        expect(schedule.monthlyReturnCents).toBe(500001);
        const payment = await transaction.clothingInvestmentPayment.create({
          data: {
            agreementId: saved.agreements[0].id,
            month: 3,
            amount: '5000.01',
            paidDate: '2026-10-17',
          },
        });
        await transaction.clothingAccountingJournalLine.createMany({
          data: investorPostingLines({
            kind: 'return',
            agreementId: saved.agreements[0].id,
            reference: saved.agreements[0].reference,
            sourceId: payment.id,
            amount: payment.amount,
            date: payment.paidDate,
            cutover,
          }),
        });
        const lines = await transaction.clothingAccountingJournalLine.findMany({
          where: {
            sourceId: { in: [saved.agreements[0].id, payment.id] },
            deletedAt: null,
          },
        });
        expect(lines).toHaveLength(4);
        expect(
          lines.reduce((sum, line) => sum + line.debit - line.credit, 0)
        ).toBeCloseTo(0, 2);
        expect(
          lines
            .filter((line) => line.account === 'Cash')
            .reduce((sum, line) => sum + line.debit - line.credit, 0)
        ).toBeCloseTo(95000.09, 2);
        const paidAgreement =
          await transaction.clothingInvestmentAgreement.findUniqueOrThrow({
            where: { id: saved.agreements[0].id },
            include: { payments: true },
          });
        expect(paidAgreement.payments).toHaveLength(1);
        expect(paidAgreement.payments[0].amount.toFixed(2)).toBe('5000.01');
        expect(paidAgreement.payments[0].paidDate).toBe('2026-10-17');
        await transaction.clothingInvestorBankClosure.update({
          where: { id: closure.id },
          data: { deletedAt: new Date() },
        });
        expect(
          await transaction.clothingInvestorBankClosure.count({
            where: { id: closure.id, deletedAt: null },
          })
        ).toBe(0);
        throw rollback;
      })
    ).rejects.toBe(rollback);
  });

  it('rejects agreements referring to an absent investor', async () => {
    await expect(
      prisma.clothingInvestmentAgreement.create({
        data: {
          investorId: 'nonexistent-investor-test',
          reference: 'nonexistent-investor-test',
          effectiveDate: '2026-01-25',
          principal: '1000',
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('clears funded principal at maturity and rejects unlinked or duplicate repayment', async () => {
    await expect(
      prisma.$transaction(async (transaction) => {
        const investor = await transaction.clothingInvestor.create({
          data: { name: 'Principal repayment test' },
        });
        const agreement = await transaction.clothingInvestmentAgreement.create({
          data: {
            investorId: investor.id,
            reference: `repayment-${investor.id}`,
            principal: '1000000',
            effectiveDate: '2023-01-25',
          },
        });
        const cutover = new Date('2026-01-17T00:00:00Z');
        const repayment = {
          agreementId: agreement.id,
          kind: 'repayment' as const,
          date: '2026-02-25',
        };
        await expect(
          postInvestorPrincipal(transaction, repayment, cutover)
        ).rejects.toThrow('reconcile investor funding');
        await postInvestorPrincipal(
          transaction,
          { ...repayment, kind: 'funding', date: '2026-01-25' },
          cutover
        );
        await expect(
          postInvestorPrincipal(
            transaction,
            { ...repayment, date: '2026-01-24' },
            cutover
          )
        ).rejects.toThrow('cannot precede funding');
        await postInvestorPrincipal(transaction, repayment, cutover);
        await expect(
          postInvestorPrincipal(transaction, repayment, cutover)
        ).rejects.toThrow('already been repaid');
        const lines = await transaction.clothingAccountingJournalLine.findMany({
          where: { sourceId: agreement.id },
        });
        expect(lines).toHaveLength(4);
        for (const account of [
          'Cash',
          `Loan Payable - Investor ${agreement.id}`,
        ]) {
          expect(
            lines
              .filter((line) => line.account === account)
              .reduce((total, line) => total + line.debit - line.credit, 0)
          ).toBe(0);
        }
        expect(
          lines.filter((line) => line.sourceType === 'INVESTOR_REPAYMENT')
        ).toHaveLength(2);
        throw rollback;
      })
    ).rejects.toBe(rollback);
  });

  it('rolls back payment creation if its journal posting fails', async () => {
    let paymentId = '';
    await expect(
      prisma.$transaction(async (transaction) => {
        const investor = await transaction.clothingInvestor.create({
          data: { name: 'Rollback test' },
        });
        const agreement = await transaction.clothingInvestmentAgreement.create({
          data: {
            investorId: investor.id,
            reference: `rollback-${investor.id}`,
            principal: '1000',
            effectiveDate: '2026-01-25',
          },
        });
        const payment = await transaction.clothingInvestmentPayment.create({
          data: {
            agreementId: agreement.id,
            month: 3,
            amount: '50',
            paidDate: '2026-04-28',
          },
        });
        paymentId = payment.id;
        const lines = investorPostingLines({
          kind: 'return',
          agreementId: agreement.id,
          reference: agreement.reference,
          sourceId: payment.id,
          amount: payment.amount,
          date: payment.paidDate,
          cutover: new Date('2026-01-17T00:00:00Z'),
        });
        await transaction.clothingAccountingJournalLine.createMany({
          data: [lines[0], lines[0]],
        });
      })
    ).rejects.toMatchObject({ code: 'P2002' });
    expect(
      await prisma.clothingInvestmentPayment.findUnique({
        where: { id: paymentId },
      })
    ).toBeNull();
    expect(
      await prisma.clothingAccountingJournalLine.count({
        where: { sourceId: paymentId },
      })
    ).toBe(0);
  });
});
