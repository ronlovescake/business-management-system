type PayrollCandidate<TPayroll> = {
  payroll: TPayroll;
  start: Date | null;
  end: Date | null;
};

export const mergeCashAdvanceUpdate = <TUpdate>(
  store: Map<string, TUpdate>,
  id: string,
  update: TUpdate
) => {
  const existing = store.get(id);
  if (existing) {
    store.set(id, { ...existing, ...update });
    return;
  }
  store.set(id, update);
};

export const selectThirteenthMonthTarget = <TPayroll>(
  candidates: PayrollCandidate<TPayroll>[],
  _approvedDate: Date | null,
  _paidDate: Date | null
) => {
  if (candidates.length === 0) {
    return null;
  }

  const latestByPeriodEnd = candidates.reduce((currentLatest, candidate) => {
    if (!currentLatest.end) {
      return candidate;
    }
    if (!candidate.end) {
      return currentLatest;
    }
    return candidate.end > currentLatest.end ? candidate : currentLatest;
  }, candidates[0]);

  return latestByPeriodEnd;
};
