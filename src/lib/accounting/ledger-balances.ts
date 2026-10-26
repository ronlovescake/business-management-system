import { Prisma } from '@prisma/client';

type LedgerLine = {
  date: string;
  account: string;
  debit: number;
  credit: number;
};

export function buildLedgerPeriod<TLine extends LedgerLine>(
  lines: TLine[],
  from: Date,
  to: Date | null
) {
  const balances = new Map<string, Prisma.Decimal>();
  const openingBalances: Record<string, number> = {};
  const entries: Array<TLine & { balance: number }> = [];
  let debits = new Prisma.Decimal(0);
  let credits = new Prisma.Decimal(0);
  for (const line of [...lines].sort(
    (left, right) => Date.parse(left.date) - Date.parse(right.date)
  )) {
    const timestamp = Date.parse(line.date);
    if (!Number.isFinite(timestamp) || (to && timestamp > to.getTime())) {
      continue;
    }
    const balance = (balances.get(line.account) ?? new Prisma.Decimal(0))
      .plus(line.debit)
      .minus(line.credit);
    balances.set(line.account, balance);
    if (timestamp < from.getTime()) {
      openingBalances[line.account] = balance.toNumber();
    } else {
      entries.push({ ...line, balance: balance.toNumber() });
      debits = debits.plus(line.debit);
      credits = credits.plus(line.credit);
    }
  }
  return {
    entries,
    openingBalances,
    closingBalances: Object.fromEntries(
      Array.from(balances, ([account, balance]) => [
        account,
        balance.toNumber(),
      ])
    ),
    totalDebits: debits.toNumber(),
    totalCredits: credits.toNumber(),
    netChange: debits.minus(credits).toNumber(),
    accounts: new Set(entries.map((entry) => entry.account)).size,
  };
}
