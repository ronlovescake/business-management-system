import { useMemo } from 'react';
import type { TransactionData } from '../types/transaction.types';

export function useTransactionCustomerTabs(
  transactions: TransactionData[],
  cappedFilteredTransactions: TransactionData[]
) {
  const onhandEligibleTransactions = useMemo(() => {
    const warehouseCustomers = new Set(
      transactions
        .filter((transaction) => transaction['Order Status'] === 'Warehouse')
        .map((transaction) => transaction.Customers)
        .filter((customer): customer is string => Boolean(customer))
    );

    if (warehouseCustomers.size === 0) {
      return [];
    }

    const eligibleStatuses = new Set(['Warehouse', 'Prepared', 'On-Hold']);
    const collator = new Intl.Collator(undefined, {
      sensitivity: 'base',
      ignorePunctuation: true,
    });

    return transactions
      .map((transaction, index) => ({ transaction, index }))
      .filter(({ transaction }) => {
        if (!transaction.Customers) {
          return false;
        }
        if (!warehouseCustomers.has(transaction.Customers)) {
          return false;
        }
        const status = transaction['Order Status'];
        if (!status) {
          return false;
        }
        return eligibleStatuses.has(status);
      })
      .sort((a, b) => {
        const customerA = a.transaction.Customers ?? '';
        const customerB = b.transaction.Customers ?? '';
        const comparison = collator.compare(customerA, customerB);
        if (comparison !== 0) {
          return comparison;
        }
        return a.index - b.index;
      })
      .map(({ transaction }) => transaction);
  }, [transactions]);

  const onhandEligibleFilteredTransactions = useMemo(() => {
    if (onhandEligibleTransactions.length === 0) {
      return [];
    }

    const orderMap = new Map(
      onhandEligibleTransactions.map((transaction, orderIndex) => [
        transaction.id,
        orderIndex,
      ])
    );

    return cappedFilteredTransactions
      .filter((transaction) => orderMap.has(transaction.id))
      .sort((a, b) => {
        const orderA = orderMap.get(a.id) ?? 0;
        const orderB = orderMap.get(b.id) ?? 0;
        return orderA - orderB;
      });
  }, [cappedFilteredTransactions, onhandEligibleTransactions]);

  const warehousePreparedTransactions = useMemo(() => {
    if (transactions.length === 0) {
      return [];
    }

    const customerStatusMap = new Map<
      string,
      { hasWarehouse: boolean; hasPrepared: boolean; hasOnHold: boolean }
    >();

    transactions.forEach((transaction) => {
      const customer = transaction.Customers;
      if (!customer) {
        return;
      }

      const status = transaction['Order Status'];
      if (
        !status ||
        (status !== 'Warehouse' &&
          status !== 'Prepared' &&
          status !== 'On-Hold')
      ) {
        return;
      }

      const statusFlags = customerStatusMap.get(customer) ?? {
        hasWarehouse: false,
        hasPrepared: false,
        hasOnHold: false,
      };

      if (status === 'Warehouse') {
        statusFlags.hasWarehouse = true;
      } else if (status === 'Prepared') {
        statusFlags.hasPrepared = true;
      } else {
        statusFlags.hasOnHold = true;
      }

      customerStatusMap.set(customer, statusFlags);
    });

    const eligibleCustomers = new Set(
      Array.from(customerStatusMap.entries())
        .filter(
          ([, flags]) =>
            flags.hasWarehouse && (flags.hasPrepared || flags.hasOnHold)
        )
        .map(([customer]) => customer)
    );

    if (eligibleCustomers.size === 0) {
      return [];
    }

    const eligibleStatuses = new Set(['Warehouse', 'Prepared', 'On-Hold']);
    const collator = new Intl.Collator(undefined, {
      sensitivity: 'base',
      ignorePunctuation: true,
    });

    return transactions
      .map((transaction, index) => ({ transaction, index }))
      .filter(({ transaction }) => {
        if (!transaction.Customers) {
          return false;
        }
        if (!eligibleCustomers.has(transaction.Customers)) {
          return false;
        }
        const status = transaction['Order Status'];
        if (!status) {
          return false;
        }
        return eligibleStatuses.has(status);
      })
      .sort((a, b) => {
        const customerA = a.transaction.Customers ?? '';
        const customerB = b.transaction.Customers ?? '';
        const comparison = collator.compare(customerA, customerB);
        if (comparison !== 0) {
          return comparison;
        }
        return a.index - b.index;
      })
      .map(({ transaction }) => transaction);
  }, [transactions]);

  const warehousePreparedFilteredTransactions = useMemo(() => {
    if (warehousePreparedTransactions.length === 0) {
      return [];
    }

    const orderMap = new Map(
      warehousePreparedTransactions.map((transaction, orderIndex) => [
        transaction.id,
        orderIndex,
      ])
    );

    return cappedFilteredTransactions
      .filter((transaction) => orderMap.has(transaction.id))
      .sort((a, b) => {
        const orderA = orderMap.get(a.id) ?? 0;
        const orderB = orderMap.get(b.id) ?? 0;
        return orderA - orderB;
      });
  }, [cappedFilteredTransactions, warehousePreparedTransactions]);

  return {
    onhandEligibleTransactions,
    onhandEligibleFilteredTransactions,
    warehousePreparedTransactions,
    warehousePreparedFilteredTransactions,
  };
}
