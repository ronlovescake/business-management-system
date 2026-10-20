import { prisma } from '@/lib/db';
import type { DateFilterType } from '@/lib/analytics/periodComparison';
import {
  buildHouseholdDashboardSummary,
  type DashboardAccountInput,
  type DashboardExpenseInput,
  type DashboardIncomeInput,
  type DashboardRecurringPaymentInput,
} from './aggregations';

export class HouseholdDashboardService {
  async getSummary(range: DateFilterType, now: Date = new Date()) {
    const [
      expenses,
      rejectedRecurringExpenses,
      income,
      accounts,
      recurringPayments,
    ] = await Promise.all([
      prisma.householdExpense.findMany({
        where: { status: { not: 'rejected' } },
        select: {
          amount: true,
          category: true,
          date: true,
          status: true,
          sourceType: true,
          sourceId: true,
          sourceLineKey: true,
        },
      }),
      prisma.householdExpense.findMany({
        where: { status: 'rejected', sourceType: 'RECURRING' },
        select: {
          amount: true,
          category: true,
          date: true,
          status: true,
          sourceType: true,
          sourceId: true,
          sourceLineKey: true,
        },
      }),
      prisma.householdIncome.findMany({
        select: { amount: true, date: true },
      }),
      prisma.householdAccount.findMany({
        select: {
          id: true,
          name: true,
          type: true,
          balance: true,
          isActive: true,
        },
      }),
      prisma.householdRecurringPayment.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          category: true,
          amount: true,
          startDate: true,
          monthsCount: true,
          isActive: true,
          accountRef: { select: { name: true } },
        },
      }),
    ]);

    return buildHouseholdDashboardSummary(
      {
        expenses: [
          ...expenses,
          ...rejectedRecurringExpenses,
        ] as DashboardExpenseInput[],
        income: income as DashboardIncomeInput[],
        accounts: accounts as DashboardAccountInput[],
        recurringPayments: recurringPayments.map((payment) => ({
          id: payment.id,
          name: payment.name,
          category: payment.category,
          amount: payment.amount,
          startDate: payment.startDate,
          monthsCount: payment.monthsCount,
          isActive: payment.isActive,
          accountName: payment.accountRef?.name ?? null,
        })) as DashboardRecurringPaymentInput[],
      },
      range,
      now
    );
  }
}

export const householdDashboardService = new HouseholdDashboardService();
