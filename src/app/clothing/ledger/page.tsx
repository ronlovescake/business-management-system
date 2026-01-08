import { redirect } from 'next/navigation';

export default function LegacyLedgerRedirect() {
  return redirect('/clothing/accounting');
}
