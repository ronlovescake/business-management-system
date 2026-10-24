export const LOGISTICS_VENDORS = ['Forwarder', 'Courier', 'Packaging'] as const;
export const LOGISTICS_ACTIONS = [
  'accrue',
  'pay',
  'capitalize',
  'adjust-down',
] as const;
export type LogisticsVendor = (typeof LOGISTICS_VENDORS)[number];
export type LogisticsAction = (typeof LOGISTICS_ACTIONS)[number];

export type LogisticsJournalLine = {
  sourceType: string;
  sourceLineKey: string;
  debit: number;
  credit: number;
};

export function logisticsLineKey(
  shipmentId: number,
  vendor: LogisticsVendor,
  action: LogisticsAction,
  side: 'debit' | 'credit'
) {
  return `shipment:${shipmentId}:${vendor}:${action}:${side}`;
}

export function parseLogisticsLineKey(value: string) {
  const [prefix, shipmentId, vendor, action, side, extra] = value.split(':');
  if (
    prefix !== 'shipment' ||
    !/^\d+$/.test(shipmentId) ||
    extra !== undefined ||
    !LOGISTICS_VENDORS.includes(vendor as LogisticsVendor) ||
    !LOGISTICS_ACTIONS.includes(action as LogisticsAction) ||
    (side !== 'debit' && side !== 'credit')
  ) {
    return null;
  }
  return {
    shipmentId: Number(shipmentId),
    vendor: vendor as LogisticsVendor,
    action: action as LogisticsAction,
    side,
  };
}

export function getLogisticsBalances(
  lines: LogisticsJournalLine[],
  vendor: LogisticsVendor
) {
  const cents: Record<LogisticsAction, number> = {
    accrue: 0,
    pay: 0,
    capitalize: 0,
    'adjust-down': 0,
  };
  for (const line of lines) {
    const identity = parseLogisticsLineKey(line.sourceLineKey);
    if (
      line.sourceType !== 'SHIPMENT_LOGISTICS' ||
      identity?.vendor !== vendor ||
      identity.side !== 'debit'
    ) {
      continue;
    }
    cents[identity.action] += Math.round(line.debit * 100);
  }
  const actual = cents.accrue - cents['adjust-down'];
  return {
    actual: actual / 100,
    paid: cents.pay / 100,
    capitalized: cents.capitalize / 100,
    payable: (actual - cents.pay) / 100,
    clearing: (actual - cents.capitalize) / 100,
  };
}

export function logisticsAmountLimit(
  action: LogisticsAction,
  balances: ReturnType<typeof getLogisticsBalances>
): number {
  switch (action) {
    case 'accrue':
      return Infinity;
    case 'pay':
      return Math.max(0, balances.payable);
    case 'capitalize':
      return Math.max(0, balances.clearing);
    case 'adjust-down':
      return Math.max(0, Math.min(balances.payable, balances.clearing));
  }
}
