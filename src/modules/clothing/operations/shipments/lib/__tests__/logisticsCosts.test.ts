import { describe, expect, it } from 'vitest';
import {
  getLogisticsBalances,
  logisticsAmountLimit,
  logisticsLineKey,
  parseLogisticsLineKey,
  type LogisticsAction,
} from '../logisticsCosts';

const entry = (
  action: LogisticsAction,
  amount: number,
  vendor: 'Forwarder' | 'Courier' = 'Forwarder'
) => ({
  sourceType: 'SHIPMENT_LOGISTICS',
  sourceLineKey: logisticsLineKey(1, vendor, action, 'debit'),
  debit: amount,
  credit: 0,
});

describe('shipment actual logistics balances', () => {
  it('tracks multiple partial payments rather than treating the first as full settlement', () => {
    const balances = getLogisticsBalances(
      [entry('accrue', 5000), entry('pay', 2000), entry('pay', 1000)],
      'Forwarder'
    );
    expect(balances).toEqual({
      actual: 5000,
      paid: 3000,
      capitalized: 0,
      payable: 2000,
      clearing: 5000,
    });
    expect(logisticsAmountLimit('pay', balances)).toBe(2000);
  });

  it('limits corrections to balances that have not been paid or capitalized', () => {
    const balances = getLogisticsBalances(
      [entry('accrue', 5000), entry('pay', 3000), entry('capitalize', 4500)],
      'Forwarder'
    );
    expect(logisticsAmountLimit('adjust-down', balances)).toBe(500);
    expect(logisticsAmountLimit('capitalize', balances)).toBe(500);
  });

  it('uses cents and ignores other vendors, credits, and unstructured historical entries', () => {
    const lines = [
      entry('accrue', 0.3),
      entry('pay', 0.1),
      entry('pay', 0.2),
      entry('accrue', 999, 'Courier'),
      { ...entry('accrue', 999), sourceType: 'MANUAL' },
      { ...entry('accrue', 999), sourceLineKey: 'debit' },
      {
        ...entry('accrue', 999),
        sourceLineKey: logisticsLineKey(1, 'Forwarder', 'accrue', 'credit'),
      },
    ];
    expect(getLogisticsBalances(lines, 'Forwarder').payable).toBe(0);
  });

  it('round-trips structured identity without inspecting descriptions', () => {
    expect(
      parseLogisticsLineKey(
        logisticsLineKey(42, 'Packaging', 'capitalize', 'debit')
      )
    ).toEqual({
      shipmentId: 42,
      vendor: 'Packaging',
      action: 'capitalize',
      side: 'debit',
    });
    expect(parseLogisticsLineKey('shipment:42:Unknown:pay:debit')).toBeNull();
    expect(
      parseLogisticsLineKey('shipment:42:Courier:pay:debit:extra')
    ).toBeNull();
  });
});
