import {
  isTaggableAccountParent,
  toTaggableSelection,
} from '@/lib/accounting/account-tagging';

export type OpeningEntryFormState = {
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  debitAccount: string;
  creditAccount: string;
  debitAccountTag: string;
  creditAccountTag: string;
  amount: number;
  description: string;
};

export type OpeningEntryField =
  | 'date'
  | 'ref'
  | 'account'
  | 'debit'
  | 'credit'
  | 'debitAccount'
  | 'creditAccount'
  | 'debitAccountTag'
  | 'creditAccountTag'
  | 'amount'
  | 'description';

export type OpeningBalanceEntryLike = {
  id: string;
  date: string;
  ref: string;
  account: string;
  debit: number;
  credit: number;
  description?: string;
};

export function createOpeningEntryFormState(
  cutoverDate: string
): OpeningEntryFormState {
  return {
    date: cutoverDate,
    ref: 'OPENING',
    account: '',
    debit: 0,
    credit: 0,
    debitAccount: '',
    creditAccount: '',
    debitAccountTag: '',
    creditAccountTag: '',
    amount: 0,
    description: '',
  };
}

export function applyOpeningEntryFieldChange(
  previous: OpeningEntryFormState,
  field: OpeningEntryField,
  value: string | number | null
): OpeningEntryFormState {
  if (field === 'debit') {
    return {
      ...previous,
      debit: Number(value ?? 0),
      credit: 0,
    };
  }

  if (field === 'credit') {
    return {
      ...previous,
      credit: Number(value ?? 0),
      debit: 0,
    };
  }

  if (field === 'amount') {
    return {
      ...previous,
      amount: Number(value ?? 0),
    };
  }

  if (field === 'debitAccount') {
    const nextDebit = String(value ?? '');
    return {
      ...previous,
      debitAccount: nextDebit,
      debitAccountTag: isTaggableAccountParent(nextDebit)
        ? previous.debitAccountTag
        : '',
    };
  }

  if (field === 'creditAccount') {
    const nextCredit = String(value ?? '');
    return {
      ...previous,
      creditAccount: nextCredit,
      creditAccountTag: isTaggableAccountParent(nextCredit)
        ? previous.creditAccountTag
        : '',
    };
  }

  return {
    ...previous,
    [field]: typeof value === 'number' ? value : (value ?? ''),
  };
}

function findOpeningEntryCounterpart(
  entry: OpeningBalanceEntryLike,
  allEntries: OpeningBalanceEntryLike[]
): OpeningBalanceEntryLike | undefined {
  const dateKey = entry.date.slice(0, 10);
  const refKey = entry.ref;
  const descKey = (entry.description ?? '').trim();
  const amount = entry.debit > 0 ? entry.debit : entry.credit;
  const side: 'debit' | 'credit' = entry.debit > 0 ? 'debit' : 'credit';

  const isSameAmount = (value: number) =>
    Math.abs(Number(value ?? 0) - amount) < 0.00001;

  return allEntries.find((candidate) => {
    if (candidate.id === entry.id) {
      return false;
    }
    if (candidate.date.slice(0, 10) !== dateKey) {
      return false;
    }
    if (candidate.ref !== refKey) {
      return false;
    }
    if ((candidate.description ?? '').trim() !== descKey) {
      return false;
    }

    return side === 'debit'
      ? candidate.credit > 0 && isSameAmount(candidate.credit)
      : candidate.debit > 0 && isSameAmount(candidate.debit);
  });
}

export function buildOpeningEntryEditState(
  entry: OpeningBalanceEntryLike,
  allEntries: OpeningBalanceEntryLike[]
) {
  const counterpart = findOpeningEntryCounterpart(entry, allEntries);
  const dateKey = entry.date.slice(0, 10);
  const refKey = entry.ref;
  const amount = entry.debit > 0 ? entry.debit : entry.credit;
  const side: 'debit' | 'credit' = entry.debit > 0 ? 'debit' : 'credit';

  if (counterpart) {
    const debitLine = side === 'debit' ? entry : counterpart;
    const creditLine = side === 'debit' ? counterpart : entry;

    const debitSelection = toTaggableSelection(debitLine.account);
    const creditSelection = toTaggableSelection(creditLine.account);

    return {
      side,
      debitId: debitLine.id,
      creditId: creditLine.id,
      form: {
        date: dateKey,
        ref: refKey,
        account: entry.account,
        debit: entry.debit,
        credit: entry.credit,
        debitAccount: debitSelection.account,
        creditAccount: creditSelection.account,
        debitAccountTag: debitSelection.tag,
        creditAccountTag: creditSelection.tag,
        amount,
        description: entry.description ?? '',
      } satisfies OpeningEntryFormState,
    };
  }

  const singleSelection = toTaggableSelection(entry.account);

  return {
    side,
    debitId: side === 'debit' ? entry.id : null,
    creditId: side === 'credit' ? entry.id : null,
    form: {
      date: dateKey,
      ref: refKey,
      account: entry.account,
      debit: entry.debit,
      credit: entry.credit,
      debitAccount: side === 'debit' ? singleSelection.account : '',
      creditAccount: side === 'credit' ? singleSelection.account : '',
      debitAccountTag: side === 'debit' ? singleSelection.tag : '',
      creditAccountTag: side === 'credit' ? singleSelection.tag : '',
      amount,
      description: entry.description ?? '',
    } satisfies OpeningEntryFormState,
  };
}

export function buildOpeningEntryDeleteIds(
  id: string,
  allEntries: OpeningBalanceEntryLike[]
): string[] {
  const entry = allEntries.find((candidate) => candidate.id === id);
  const idsToDelete = new Set<string>([id]);

  if (!entry) {
    return [id];
  }

  const strictMatch = findOpeningEntryCounterpart(entry, allEntries);
  if (strictMatch) {
    idsToDelete.add(strictMatch.id);
    return Array.from(idsToDelete);
  }

  const dateKey = entry.date.slice(0, 10);
  const refKey = entry.ref;
  const entryAccount = entry.account.trim();
  const amount = entry.debit > 0 ? entry.debit : entry.credit;
  const side: 'debit' | 'credit' = entry.debit > 0 ? 'debit' : 'credit';

  const isSameAmount = (value: number) =>
    Math.abs(Number(value ?? 0) - amount) < 0.00001;

  const fallbackMatch = allEntries.find((candidate) => {
    if (candidate.id === entry.id) {
      return false;
    }
    if (candidate.date.slice(0, 10) !== dateKey) {
      return false;
    }
    if (candidate.ref !== refKey) {
      return false;
    }

    const candidateAccount = candidate.account.trim();
    if (entryAccount === 'Opening Equity') {
      if (candidateAccount === 'Opening Equity') {
        return false;
      }
    } else if (candidateAccount !== 'Opening Equity') {
      return false;
    }

    return side === 'debit'
      ? candidate.credit > 0 && isSameAmount(candidate.credit)
      : candidate.debit > 0 && isSameAmount(candidate.debit);
  });

  if (fallbackMatch) {
    idsToDelete.add(fallbackMatch.id);
  }

  return Array.from(idsToDelete);
}
