'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';
import type { TransactionData } from '../types/transaction.types';

type Patch = { id: number; data: Partial<TransactionData> };
type Waiter = {
  resolve: (rows: TransactionData[]) => void;
  reject: (error: Error) => void;
};
type Job = {
  patches: Patch[];
  bulk: boolean;
  waiters: Waiter[];
  revision: number;
};
interface Options {
  scope?: string;
  transactions: TransactionData[];
  patch: (
    id: number,
    data: Partial<TransactionData>
  ) => Promise<TransactionData>;
  bulk: (rows: TransactionData[]) => Promise<{ count: number }>;
  refresh: () => Promise<TransactionData[]>;
}

export function useTransactionGridSaveQueue(options: Options) {
  const [, render] = useState(0);
  const session = useMemo(
    () => ({
      drafts: new Map<number, { row: TransactionData; revision: number }>(),
      canonical: new Map<number, TransactionData>(),
      jobs: [] as Job[],
      revision: 0,
      running: false,
      validating: 0,
      error: null as string | null,
    }),
    [options.scope]
  );
  const current = useRef(session);
  current.current = session;
  const latest = useRef(options);
  latest.current = options;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      session.jobs.forEach((job) =>
        job.waiters.forEach(({ reject }) =>
          reject(new Error('Transaction workspace changed.'))
        )
      );
    },
    [session]
  );
  const active = () => mounted.current && current.current === session;
  const publish = () => {
    if (active()) {
      render((version) => version + 1);
    }
  };
  const getTransaction = (id: number) =>
    session.drafts.get(id)?.row ??
    session.canonical.get(id) ??
    latest.current.transactions.find((row) => row.id === id);
  const replaceCanonical = (rows: TransactionData[]) => {
    session.canonical.clear();
    rows.forEach((row) => {
      if (row.id) {
        session.canonical.set(row.id, row);
      }
    });
  };

  const drain = async () => {
    if (session.running || session.error || !active()) {
      return;
    }
    session.running = true;
    publish();
    const transport = latest.current;
    try {
      while (active() && session.drafts.size > 0) {
        const job = session.jobs[0];
        if (job) {
          const rows = job.patches.map(({ id, data }) => {
            const baseline =
              session.canonical.get(id) ??
              latest.current.transactions.find((row) => row.id === id);
            if (!baseline) {
              throw new Error(
                `Transaction ${id} no longer exists. Discard its draft.`
              );
            }
            return { ...baseline, ...data, id };
          });
          let saved: TransactionData[];
          if (job.bulk) {
            const result = await transport.bulk(rows);
            if (result.count !== rows.length) {
              throw new Error(
                'Incomplete transaction acknowledgement. Review saved values before retrying.'
              );
            }
            saved = rows;
          } else {
            const patch = job.patches[0];
            const row = await transport.patch(patch.id, { ...patch.data });
            if (row.id !== patch.id) {
              throw new Error('Invalid transaction acknowledgement.');
            }
            saved = [row];
          }
          if (!active()) {
            job.waiters.forEach(({ reject }) =>
              reject(new Error('Transaction workspace changed.'))
            );
            return;
          }
          saved.forEach((row) => {
            if (row.id) {
              session.canonical.set(row.id, row);
            }
          });
          session.jobs.shift();
          job.waiters.forEach(({ resolve }) => resolve(saved));
          continue;
        }
        const revision = session.revision;
        const rows = await transport.refresh();
        if (!active()) {
          return;
        }
        replaceCanonical(rows);
        if (session.revision === revision) {
          session.drafts.clear();
          session.canonical.clear();
        }
      }
    } catch (error) {
      if (active()) {
        const failure =
          error instanceof Error ? error : new Error('Transaction save failed');
        session.error = failure.message;
        session.jobs.forEach((job) => {
          job.waiters.forEach(({ reject }) => reject(failure));
          job.waiters = [];
        });
      }
    } finally {
      session.running = false;
      publish();
    }
  };

  const enqueue = (
    patches: Patch[],
    bulk = false
  ): Promise<TransactionData[]> => {
    if (!active()) {
      return Promise.reject(new Error('Transaction workspace changed.'));
    }
    const revision = ++session.revision;
    for (const { id, data } of patches) {
      const row = getTransaction(id);
      if (!row) {
        return Promise.reject(new Error(`Transaction ${id} is missing.`));
      }
      session.drafts.set(id, { row: { ...row, ...data, id }, revision });
    }
    const promise = new Promise<TransactionData[]>((resolve, reject) => {
      const last = session.jobs[session.jobs.length - 1];
      const canMerge =
        !bulk &&
        last &&
        !last.bulk &&
        !(session.running && session.jobs.length === 1) &&
        last.patches[0].id === patches[0]?.id &&
        !('Order Status' in patches[0].data) &&
        !('Order Status' in last.patches[0].data);
      if (canMerge) {
        last.patches[0] = {
          id: patches[0].id,
          data: { ...last.patches[0].data, ...patches[0].data },
        };
        last.revision = revision;
        last.waiters.push({ resolve, reject });
      } else {
        session.jobs.push({
          patches: patches.map(({ id, data }) => ({ id, data: { ...data } })),
          bulk,
          revision,
          waiters: [{ resolve, reject }],
        });
      }
      if (session.error) {
        reject(new Error(session.error));
        session.jobs.forEach((job) => {
          job.waiters = [];
        });
      }
    });
    publish();
    void drain();
    return promise;
  };

  const recover = async (discard: boolean) => {
    if (session.running || !active()) {
      return;
    }
    session.running = true;
    const revision = session.revision;
    const drafts = new Map(session.drafts);
    publish();
    try {
      const rows = await latest.current.refresh();
      if (!active()) {
        return;
      }
      replaceCanonical(rows);
      if (discard) {
        session.jobs = session.jobs.filter((job) => job.revision > revision);
        drafts.forEach((draft, id) => {
          if (session.drafts.get(id)?.revision === draft.revision) {
            session.drafts.delete(id);
          }
        });
      } else if (
        Array.from(session.drafts.keys()).some(
          (id) => !session.canonical.has(id)
        )
      ) {
        throw new Error(
          'A pending transaction no longer exists. Discard the draft instead of recreating it.'
        );
      }
      session.error = null;
    } catch (error) {
      if (active()) {
        session.error =
          error instanceof Error
            ? error.message
            : 'Unable to refresh transactions';
      }
    } finally {
      session.running = false;
      publish();
    }
    await drain();
  };

  const hasPendingChanges = session.drafts.size > 0 || session.validating > 0;
  useEffect(() => {
    if (!hasPendingChanges) {
      return;
    }
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest('a[href]') &&
        !window.confirm(
          'Transaction changes are not fully saved. Leave this page?'
        )
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate, true);
    };
  }, [hasPendingChanges]);

  const merged = options.transactions.map((row) =>
    row.id ? (session.drafts.get(row.id)?.row ?? row) : row
  );
  session.drafts.forEach(({ row }, id) => {
    if (!options.transactions.some((transaction) => transaction.id === id)) {
      merged.push(row);
    }
  });
  const visible = useRef<TransactionData[]>([]);
  if (
    merged.length !== visible.current.length ||
    merged.some((row, index) => row !== visible.current[index])
  ) {
    visible.current = merged;
  }
  return {
    transactions: visible.current,
    getTransaction,
    enqueue,
    enqueueBulk: async (patches: Patch[]) => {
      const saves: Promise<TransactionData[]>[] = [];
      for (let offset = 0; offset < patches.length; offset += MAX_QUERY_LIMIT) {
        saves.push(
          enqueue(patches.slice(offset, offset + MAX_QUERY_LIMIT), true)
        );
      }
      await Promise.all(saves);
      return { count: patches.length };
    },
    retry: () => recover(false),
    discard: () => recover(true),
    hasPendingChanges,
    isBusy: () =>
      session.drafts.size > 0 || session.running || session.validating > 0,
    isSaving: session.running,
    error: session.error,
    beginValidation: () => {
      session.validating += 1;
      publish();
      return () => {
        session.validating -= 1;
        publish();
      };
    },
  };
}
