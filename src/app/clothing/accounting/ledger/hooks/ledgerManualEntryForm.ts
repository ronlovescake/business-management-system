import { isTaggableAccountParent } from '@/lib/accounting/account-tagging';

export type ManualEntryFormState = {
  date: string;
  ref: string;
  debitAccount: string;
  creditAccount: string;
  debitAccountTag: string;
  creditAccountTag: string;
  amount: number;
  description: string;
};

export type ManualEntryField =
  | 'date'
  | 'ref'
  | 'debitAccount'
  | 'creditAccount'
  | 'debitAccountTag'
  | 'creditAccountTag'
  | 'amount'
  | 'description';

export function applyManualEntryFieldChange(
  previous: ManualEntryFormState,
  field: ManualEntryField,
  value: string | number | null
): ManualEntryFormState {
  const nextValue = value ?? (field === 'amount' ? 0 : '');

  if (field === 'debitAccount') {
    const nextDebit = String(nextValue);
    return {
      ...previous,
      debitAccount: nextDebit,
      debitAccountTag: isTaggableAccountParent(nextDebit)
        ? previous.debitAccountTag
        : '',
    };
  }

  if (field === 'creditAccount') {
    const nextCredit = String(nextValue);
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
    [field]: nextValue,
  };
}
