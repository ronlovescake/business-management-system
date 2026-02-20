import type { Prisma, TruckingPayroll } from '@prisma/client';

interface ThirteenthMonthCandidate {
  payroll: TruckingPayroll;
  start: Date | null;
  end: Date | null;
}

export const mergeCashAdvanceUpdate = (
  store: Map<string, Prisma.TruckingCashAdvanceRecordUpdateInput>,
  id: string,
  update: Prisma.TruckingCashAdvanceRecordUpdateInput
) => {
  const existing = store.get(id);
  if (existing) {
    store.set(id, { ...existing, ...update });
    return;
  }
  store.set(id, update);
};

export const selectThirteenthMonthTarget = (
  candidates: ThirteenthMonthCandidate[],
  _approvedDate: Date | null,
  _paidDate: Date | null
) => {
  if (candidates.length === 0) {
    return null;
  }

  const latest = candidates.reduce((latestCandidate, candidate) => {
    if (!latestCandidate.end) {
      return candidate;
    }
    if (!candidate.end) {
      return latestCandidate;
    }
    return candidate.end > latestCandidate.end ? candidate : latestCandidate;
  }, candidates[0]);

  return latest;
};
