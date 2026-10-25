'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MAX_QUERY_LIMIT } from '@/constants/batch-sizes';
import type { ProductData } from '../types/product.types';

type SaveResult = { skippedDetails: Array<{ index: number; issues: unknown }> };
type Draft = { product: ProductData; revision: number; saved: boolean };

interface QueueOptions {
  scope?: string;
  products: ProductData[];
  save: (products: ProductData[]) => Promise<SaveResult>;
  refresh: () => Promise<ProductData[]>;
}

export function useProductGridSaveQueue(options: QueueOptions) {
  const [, render] = useState(0);
  const session = useMemo(
    () => ({
      scope: options.scope,
      drafts: new Map<number, Draft>(),
      revision: 0,
      running: false,
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

  const isCurrent = () => mounted.current && current.current === session;
  const publish = () => {
    if (isCurrent()) {
      render((version) => version + 1);
    }
  };

  const drain = async () => {
    if (session.running || session.error || !isCurrent()) {
      return;
    }
    session.running = true;
    publish();
    const { save, refresh } = latest.current;
    try {
      while (isCurrent() && session.drafts.size > 0) {
        const pending = Array.from(session.drafts.entries())
          .filter(([, draft]) => !draft.saved)
          .slice(0, MAX_QUERY_LIMIT);
        if (pending.length > 0) {
          const result = await save(
            pending.map(([, draft]) => ({ ...draft.product }))
          );
          if (!isCurrent()) {
            return;
          }
          const skipped = new Set(
            result.skippedDetails.map((row) => row.index)
          );
          pending.forEach(([id, sent], index) => {
            const draft = session.drafts.get(id);
            if (
              !skipped.has(index) &&
              draft &&
              draft.revision === sent.revision
            ) {
              session.drafts.set(id, { ...draft, saved: true });
            }
          });
          if (skipped.size > 0) {
            session.error = `Some rows were not saved: ${result.skippedDetails
              .map((row) => {
                const product = pending[row.index]?.[1].product;
                return `${product?.['Product Code'] || product?.id}: ${JSON.stringify(row.issues)}`;
              })
              .join('; ')}`;
            return;
          }
          continue;
        }

        const revision = session.revision;
        await refresh();
        if (!isCurrent()) {
          return;
        }
        if (session.revision === revision) {
          session.drafts.clear();
        }
      }
    } catch (error) {
      if (isCurrent()) {
        const data = (error as { data?: { error?: string } })?.data;
        session.error =
          data?.error ||
          (error instanceof Error ? error.message : 'Product save failed');
      }
    } finally {
      session.running = false;
      publish();
    }
  };

  const getProduct = (id: number) =>
    session.drafts.get(id)?.product ||
    latest.current.products.find((product) => product.id === id);

  const enqueue = (products: ProductData[]) => {
    products.forEach((product) => {
      if (!product.id || product.id < 0) {
        return;
      }
      session.drafts.set(product.id, {
        product: { ...product },
        revision: ++session.revision,
        saved: false,
      });
    });
    publish();
    void drain();
  };

  const retry = async () => {
    if (session.running || !isCurrent()) {
      return;
    }
    session.running = true;
    publish();
    try {
      const canonical = await latest.current.refresh();
      if (!isCurrent()) {
        return;
      }
      const ids = new Set(canonical.map((product) => product.id));
      if (Array.from(session.drafts.keys()).some((id) => !ids.has(id))) {
        throw new Error(
          'A pending product no longer exists. Discard the draft instead of recreating it.'
        );
      }
      session.error = null;
    } catch (error) {
      session.error =
        error instanceof Error ? error.message : 'Unable to refresh products';
    } finally {
      session.running = false;
      publish();
    }
    await drain();
  };

  const discard = async () => {
    if (session.running || !isCurrent()) {
      return;
    }
    session.running = true;
    publish();
    const discarded = new Map(session.drafts);
    try {
      await latest.current.refresh();
      if (isCurrent()) {
        discarded.forEach((draft, id) => {
          if (session.drafts.get(id)?.revision === draft.revision) {
            session.drafts.delete(id);
          }
        });
        session.error = null;
      }
    } catch (error) {
      session.error =
        error instanceof Error ? error.message : 'Unable to refresh products';
    } finally {
      session.running = false;
      publish();
    }
    await drain();
  };

  const hasPendingChanges = session.drafts.size > 0;
  useEffect(() => {
    if (!hasPendingChanges) {
      return;
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const beforeNavigation = (event: MouseEvent) => {
      const link =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
      if (
        link &&
        !window.confirm('Product changes are not fully saved. Leave this page?')
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', beforeNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', beforeNavigation, true);
    };
  }, [hasPendingChanges]);

  const merged = options.products.map((product) =>
    product.id ? (session.drafts.get(product.id)?.product ?? product) : product
  );
  session.drafts.forEach((draft, id) => {
    if (!options.products.some((product) => product.id === id)) {
      merged.push(draft.product);
    }
  });
  const visibleProducts = useRef<ProductData[]>([]);
  if (
    merged.length !== visibleProducts.current.length ||
    merged.some((product, index) => product !== visibleProducts.current[index])
  ) {
    visibleProducts.current = merged;
  }

  return {
    products: visibleProducts.current,
    getProduct,
    enqueue,
    retry,
    discard,
    hasPendingChanges,
    isBusy: () => session.drafts.size > 0 || session.running,
    isSaving: session.running,
    error: session.error,
  };
}
