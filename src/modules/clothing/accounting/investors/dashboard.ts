import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { buildInvestmentSchedule } from '@/lib/investors/schedule';
import type { InvestorAccountingState } from './InvestorAccounting';

dayjs.extend(utc);

type Schedule = ReturnType<typeof buildInvestmentSchedule>;
export type DashboardPayout = Schedule['payouts'][number] & {
  payment: { amount: string; paidDate: string } | null;
  agreementId: string;
  reference: string;
  investorName: string;
};
export interface DashboardInvestor {
  id: string;
  name: string;
  agreements: {
    id: string;
    reference: string;
    principal: string;
    accounting: InvestorAccountingState;
    schedule: Omit<Schedule, 'payouts'> & {
      payouts: (Schedule['payouts'][number] & {
        payment: DashboardPayout['payment'];
      })[];
    };
  }[];
}

export function buildInvestorDashboard(
  investors: DashboardInvestor[],
  today: string
) {
  const until = (days: number) =>
    dayjs.utc(today).add(days, 'day').format('YYYY-MM-DD');
  const agreements = investors.flatMap((investor) =>
    investor.agreements.map((agreement) => ({
      ...agreement,
      investorId: investor.id,
      investorName: investor.name,
      principalCents: Math.round(Number(agreement.principal) * 100),
    }))
  );
  const funded = agreements.filter(
    (agreement) =>
      agreement.accounting.fundedDate && !agreement.accounting.repaidDate
  );
  const payouts: DashboardPayout[] = agreements.flatMap((agreement) =>
    agreement.schedule.payouts.map((payout) => ({
      ...payout,
      agreementId: agreement.id,
      reference: agreement.reference,
      investorName: agreement.investorName,
    }))
  );
  const unpaid = payouts
    .filter(
      (payout): payout is DashboardPayout & { dueDate: string } =>
        payout.status === 'scheduled' &&
        payout.dueDate !== null &&
        !payout.payment
    )
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const due = unpaid.filter((payout) => payout.dueDate <= today);
  const upcoming = unpaid.filter(
    (payout) => payout.dueDate > today && payout.dueDate <= until(90)
  );
  const maturities = [...funded].sort((left, right) =>
    left.schedule.maturityDate.localeCompare(right.schedule.maturityDate)
  );
  const sumReturns = (rows: DashboardPayout[]) =>
    rows.reduce((total, row) => total + row.amountCents, 0);
  const sumPrincipal = (rows: typeof funded) =>
    rows.reduce((total, row) => total + row.principalCents, 0);
  const forecast = [30, 60, 90].map((days) => {
    const returns = sumReturns(
      unpaid.filter((payout) => payout.dueDate <= until(days))
    );
    const principal = sumPrincipal(
      funded.filter(
        (agreement) =>
          agreement.schedule.principalRepaymentDeadline <= until(days)
      )
    );
    return { days, returns, principal, total: returns + principal };
  });
  const cashByMonth = [
    { month: 'Overdue', returns: 0, principal: 0 },
    ...Array.from({ length: 12 }, (_, index) => ({
      month: dayjs.utc(today).add(index, 'month').format('YYYY-MM'),
      returns: 0,
      principal: 0,
    })),
  ];
  for (const payout of unpaid) {
    const month =
      payout.dueDate < today ? 'Overdue' : payout.dueDate.slice(0, 7);
    const bucket = cashByMonth.find((row) => row.month === month);
    if (bucket) {
      bucket.returns += payout.amountCents;
    }
  }
  const principalByMaturity = new Map<string, number>();
  for (const agreement of funded) {
    const deadline = agreement.schedule.principalRepaymentDeadline;
    const month = deadline < today ? 'Overdue' : deadline.slice(0, 7);
    const bucket = cashByMonth.find((row) => row.month === month);
    if (bucket) {
      bucket.principal += agreement.principalCents;
    }
    const maturityMonth = agreement.schedule.maturityDate.slice(0, 7);
    principalByMaturity.set(
      maturityMonth,
      (principalByMaturity.get(maturityMonth) ?? 0) + agreement.principalCents
    );
  }
  const activity = agreements
    .flatMap((agreement) => {
      const common = {
        investorName: agreement.investorName,
        reference: agreement.reference,
        investorId: agreement.investorId,
        agreementId: agreement.id,
      };
      return [
        ...(agreement.accounting.fundedDate
          ? [
              {
                ...common,
                id: `funding-${agreement.id}`,
                date: agreement.accounting.fundedDate,
                kind: 'Funding received',
                cents: agreement.principalCents,
              },
            ]
          : []),
        ...(agreement.accounting.repaidDate
          ? [
              {
                ...common,
                id: `repayment-${agreement.id}`,
                date: agreement.accounting.repaidDate,
                kind: 'Principal repaid',
                cents: agreement.principalCents,
              },
            ]
          : []),
        ...agreement.schedule.payouts.flatMap((payout) =>
          payout.payment
            ? [
                {
                  ...common,
                  id: `return-${agreement.id}-${payout.month}`,
                  date: payout.payment.paidDate,
                  kind: 'Return paid',
                  cents: Math.round(Number(payout.payment.amount) * 100),
                },
              ]
            : []
        ),
      ];
    })
    .sort(
      (left, right) =>
        right.date.localeCompare(left.date) || left.id.localeCompare(right.id)
    );
  return {
    outstanding: sumPrincipal(funded),
    dueTotal: sumReturns(due),
    next30: sumReturns(
      upcoming.filter((payout) => payout.dueDate <= until(30))
    ),
    maturing90: sumPrincipal(
      funded.filter(
        (agreement) =>
          agreement.schedule.maturityDate >= today &&
          agreement.schedule.maturityDate <= until(90)
      )
    ),
    due,
    upcoming,
    maturities,
    forecast,
    cashByMonth,
    principalByMaturity: Array.from(
      principalByMaturity,
      ([month, principal]) => ({ month, principal })
    ).sort((left, right) => left.month.localeCompare(right.month)),
    activity: activity.slice(0, 15),
    calendarYears: Array.from(
      new Set([today.slice(0, 4), until(90).slice(0, 4)])
    ),
    warnings: {
      unlinked: agreements.filter(
        (agreement) => !agreement.accounting.fundedDate
      ),
      unposted: agreements.filter(
        (agreement) => agreement.accounting.unpostedPayments > 0
      ),
      matured: funded.filter(
        (agreement) => agreement.schedule.maturityDate <= today
      ),
    },
    investors: investors.map((investor) => {
      const investorAgreements = agreements.filter(
        (agreement) => agreement.investorId === investor.id
      );
      const ids = new Set(investorAgreements.map((agreement) => agreement.id));
      return {
        id: investor.id,
        name: investor.name,
        agreements: investorAgreements.length,
        references: investorAgreements.map((agreement) => agreement.reference),
        outstanding: sumPrincipal(
          funded.filter((agreement) => ids.has(agreement.id))
        ),
        nextPayout:
          unpaid.find((payout) => ids.has(payout.agreementId))?.dueDate ?? null,
        maturity:
          maturities.find((agreement) => ids.has(agreement.id))?.schedule
            .maturityDate ?? null,
      };
    }),
  };
}
