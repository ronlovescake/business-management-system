'use client';

import React from 'react';
import { Alert, Select, Stack } from '@mantine/core';
import { InventoryCostCorrections } from '@/components/accounting/InventoryCostCorrections';
import { InventoryValuationNotice } from '@/components/accounting/InventoryValuationNotice';
import { AccountingLoadErrorAlert } from '@/app/accounting/_shared/AccountingLoadErrorAlert';
import {
  PROFIT_LOSS_PERIOD_OPTIONS,
  useProfitLoss,
} from '@/app/clothing/accounting/profit-loss/hooks/useProfitLoss';

export function InventoryCostReview({ apiBasePath }: { apiBasePath?: string }) {
  const { stats, period, setPeriod, refresh, loadError } = useProfitLoss({
    apiBasePath,
  });
  const isClothing = apiBasePath !== '/api/general-merchandise';

  return (
    <Stack gap="md">
      <Select
        label="Cost review period"
        data={PROFIT_LOSS_PERIOD_OPTIONS}
        value={period}
        allowDeselect={false}
        onChange={(value) => {
          const option = PROFIT_LOSS_PERIOD_OPTIONS.find(
            (item) => item === value
          );
          if (option) {
            setPeriod(option);
          }
        }}
        maw={240}
      />
      <AccountingLoadErrorAlert message={loadError} />
      {isClothing && <InventoryCostCorrections onSaved={refresh} />}
      {stats.valuation && !stats.valuation.complete ? (
        <InventoryValuationNotice
          valuation={stats.valuation}
          canConfirm={isClothing}
          onConfirmed={refresh}
          defaultDetailsOpened
        />
      ) : stats.valuation?.complete ? (
        <Alert color="green" title="Valuation complete">
          All movement costs in this period are confirmed.
        </Alert>
      ) : (
        <Alert color="gray" title="Valuation unavailable">
          Cost review data is not available for this period.
        </Alert>
      )}
    </Stack>
  );
}
