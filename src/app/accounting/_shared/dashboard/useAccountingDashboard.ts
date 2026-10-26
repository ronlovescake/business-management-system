import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { buildApiPath } from '@/lib/api/paths';
import { cachePolicy, queryKeys } from '@/lib/queryKeys';
import type { PeriodOption } from '@/lib/accounting/constants';
import { buildPeriodSearchParams } from '@/lib/accounting/query';
import { getAccountingLoadErrorMessage } from '@/lib/accounting/load-error';
import type {
  ProfitLossDetailRow,
  ProfitLossRow,
  ProfitLossStats,
} from '@/app/clothing/accounting/profit-loss/hooks/useProfitLoss';
import type {
  BalanceSheetRow,
  BalanceSheetStats,
} from '@/app/clothing/accounting/balance-sheet/hooks/useBalanceSheet';
import {
  buildExpenseSlices,
  buildMonthlyTrend,
  buildProfitSnapshot,
  getBalanceSheetAsOf,
  getComparisonRange,
  getTrendRange,
  percentChange,
  summarizeBalanceSheet,
  type DateRangeIso,
} from './accountingDashboardMetrics';

type ProfitLossResponse = { rows: ProfitLossRow[]; stats: ProfitLossStats };
type ProfitLossDetailsResponse = { rows: ProfitLossDetailRow[] };
type BalanceSheetResponse = {
  rows: BalanceSheetRow[];
  stats: BalanceSheetStats;
};

const withQuery = (endpoint: string, params: URLSearchParams) => {
  const qs = params.toString();
  return qs ? `${endpoint}?${qs}` : endpoint;
};

const rangeParams = (range: DateRangeIso) =>
  new URLSearchParams({ from: range.from, to: range.to });

export function useAccountingDashboard(apiBasePath?: string) {
  const [period, setPeriod] = useState<PeriodOption>('This Year');
  // Pinned per mount so query keys stay stable across renders.
  const now = useMemo(() => new Date(), []);
  const baseKey = queryKeys.analytics.accountingDashboard(apiBasePath);
  const profitLossEndpoint = buildApiPath(
    apiBasePath,
    '/accounting/profit-loss'
  );

  const comparisonRange = useMemo(
    () => getComparisonRange(period, now),
    [period, now]
  );
  const trendRange = useMemo(() => getTrendRange(now), [now]);
  const asOf = useMemo(() => getBalanceSheetAsOf(period, now), [period, now]);

  const currentQuery = useQuery({
    queryKey: [...baseKey, 'profit-loss', period],
    queryFn: () =>
      api.get<ProfitLossResponse>(
        withQuery(profitLossEndpoint, buildPeriodSearchParams(period))
      ),
    ...cachePolicy.dashboards,
    retry: false,
  });

  const previousQuery = useQuery({
    queryKey: [...baseKey, 'profit-loss-previous', comparisonRange],
    queryFn: () => {
      if (!comparisonRange) {
        throw new Error('No comparison period for this selection');
      }
      return api.get<ProfitLossResponse>(
        withQuery(profitLossEndpoint, rangeParams(comparisonRange))
      );
    },
    enabled: comparisonRange !== null,
    ...cachePolicy.dashboards,
    retry: false,
  });

  const trendQuery = useQuery({
    queryKey: [...baseKey, 'profit-loss-trend', trendRange],
    queryFn: () =>
      api.get<ProfitLossDetailsResponse>(
        withQuery(
          buildApiPath(apiBasePath, '/accounting/profit-loss/details'),
          rangeParams(trendRange)
        )
      ),
    ...cachePolicy.dashboards,
    retry: false,
  });

  const balanceQuery = useQuery({
    queryKey: [...baseKey, 'balance-sheet', asOf],
    queryFn: () =>
      api.get<BalanceSheetResponse>(
        withQuery(
          buildApiPath(apiBasePath, '/accounting/balance-sheet'),
          new URLSearchParams({ asOf })
        )
      ),
    ...cachePolicy.dashboards,
    retry: false,
  });

  const snapshot = useMemo(
    () =>
      currentQuery.data ? buildProfitSnapshot(currentQuery.data.stats) : null,
    [currentQuery.data]
  );
  const previousSnapshot = useMemo(
    () =>
      comparisonRange && previousQuery.data
        ? buildProfitSnapshot(previousQuery.data.stats)
        : null,
    [comparisonRange, previousQuery.data]
  );

  const deltas = useMemo(
    () => ({
      revenue: snapshot
        ? percentChange(snapshot.revenue, previousSnapshot?.revenue)
        : null,
      grossProfit: snapshot
        ? percentChange(snapshot.grossProfit, previousSnapshot?.grossProfit)
        : null,
      netProfit: snapshot
        ? percentChange(snapshot.netProfit, previousSnapshot?.netProfit)
        : null,
      operatingExpenses: snapshot
        ? percentChange(
            snapshot.operatingExpenses,
            previousSnapshot?.operatingExpenses
          )
        : null,
    }),
    [snapshot, previousSnapshot]
  );

  const monthlyTrend = useMemo(
    () => buildMonthlyTrend(trendQuery.data?.rows ?? [], now),
    [trendQuery.data, now]
  );
  const expenseSlices = useMemo(
    () => buildExpenseSlices(currentQuery.data?.rows ?? []),
    [currentQuery.data]
  );
  const balanceSummary = useMemo(
    () => summarizeBalanceSheet(balanceQuery.data?.rows ?? []),
    [balanceQuery.data]
  );

  const loadError =
    [currentQuery, trendQuery, balanceQuery]
      .map((query) =>
        query.error
          ? getAccountingLoadErrorMessage(
              query.error,
              'Some accounting data failed to load. Check the server logs for details.'
            )
          : null
      )
      .find((message) => message !== null) ?? null;

  return {
    period,
    setPeriod,
    periodLabel: currentQuery.data?.stats.period ?? period,
    asOf,
    hasComparison: comparisonRange !== null,
    snapshot,
    valuation: currentQuery.data?.stats.valuation,
    deltas,
    monthlyTrend,
    expenseSlices,
    balanceStats: balanceQuery.data?.stats ?? null,
    balanceSummary,
    loadError,
    isLoading: {
      profitLoss: currentQuery.isLoading,
      trend: trendQuery.isLoading,
      balanceSheet: balanceQuery.isLoading,
    },
  };
}
