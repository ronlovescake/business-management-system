import { parseDate } from '@/lib/accounting/date-utils';

type LedgerEntryRecord = {
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description: string;
};

const COMMON_LEDGER_ACCOUNTS = [
  'Cash',
  'Accounts Receivable',
  'Stock on Hand',
  'Inventory in Transit',
  'Landed Cost Clearing',
  'Accounts Payable',
  'Forwarder Payable',
  'Courier Payable',
  'Credit Card Payable',
  'Loan Payable',
  'Opening Equity',
  'Owner Contribution',
  'Owner Draw',
  'Sales Revenue',
  'Sales Returns',
  'COGS',
  'Inventory Shrinkage',
  'Interest Expense',
] as const;

export const getEntryTimestamp = (value: string) =>
  parseDate(value)?.getTime() ?? 0;

export const computeRunningBalances = <TEntry extends LedgerEntryRecord>(
  entries: TEntry[]
): Array<TEntry & { balance: number }> => {
  const balances = new Map<string, number>();
  const byDate = [...entries].sort(
    (a, b) => getEntryTimestamp(a.date) - getEntryTimestamp(b.date)
  );

  return byDate.map((entry) => {
    const current = balances.get(entry.account) ?? 0;
    const next = current + entry.debit - entry.credit;
    balances.set(entry.account, next);
    return { ...entry, balance: next };
  });
};

export const filterAndSortLedgerEntries = <TEntry extends LedgerEntryRecord>(
  entries: TEntry[],
  searchQuery: string,
  filterAccount: string | null
) => {
  const search = searchQuery.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    const matchesSearch =
      search === '' ||
      entry.account.toLowerCase().includes(search) ||
      entry.ref.toLowerCase().includes(search) ||
      entry.description.toLowerCase().includes(search);

    const matchesAccount = !filterAccount || entry.account === filterAccount;

    return matchesSearch && matchesAccount;
  });

  const withBalances = computeRunningBalances(filtered);

  return withBalances.sort(
    (a, b) => getEntryTimestamp(b.date) - getEntryTimestamp(a.date)
  );
};

export const buildLedgerAccounts = <TEntry extends { account: string }>(
  entries: TEntry[]
) => {
  const set = new Set<string>();
  entries.forEach((entry) => set.add(entry.account));
  COMMON_LEDGER_ACCOUNTS.forEach((account) => set.add(account));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};
