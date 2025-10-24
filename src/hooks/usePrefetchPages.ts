import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Aggressively prefetches all navigation pages to eliminate
 * the 4-second delay on first visit after page refresh.
 *
 * This hook prefetches pages in the background when the app loads,
 * so subsequent navigation is instant.
 */
export function usePrefetchPages(
  pages: string[],
  options?: {
    delay?: number; // Delay before starting prefetch (ms)
    sequential?: boolean; // Prefetch one at a time vs all at once
  }
) {
  const router = useRouter();

  useEffect(() => {
    const delay = options?.delay ?? 100; // Small delay to not block initial render
    const sequential = options?.sequential ?? false;

    const prefetchPages = async () => {
      if (sequential) {
        // Prefetch one page at a time (lower memory usage)
        for (const page of pages) {
          router.prefetch(page);
          // Small delay between prefetches
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      } else {
        // Prefetch all pages at once (faster but more memory)
        pages.forEach((page) => router.prefetch(page));
      }
    };

    const timeoutId = setTimeout(prefetchPages, delay);

    return () => clearTimeout(timeoutId);
  }, [router, pages, options?.delay, options?.sequential]);
}

/**
 * Hook specifically for prefetching operations pages
 */
export function usePrefetchOperationsPages(
  business: 'clothing' | 'trucking' | null
) {
  const pages = business
    ? [
        `/${business}/operations/dashboard`,
        `/${business}/operations/transactions`,
        `/${business}/operations/customers`,
        `/${business}/operations/products`,
        `/${business}/operations/prices`,
        `/${business}/operations/shipments`,
        `/${business}/operations/sorting-distribution`,
        `/${business}/operations/due-dates`,
        `/${business}/operations/settings`,
      ]
    : [];

  usePrefetchPages(pages, { delay: 500, sequential: false });
}

/**
 * Hook specifically for prefetching employee pages
 */
export function usePrefetchEmployeePages(
  business: 'clothing' | 'trucking' | null
) {
  const pages = business
    ? [
        `/${business}/employees/dashboard`,
        `/${business}/employees/team`,
        `/${business}/employees/attendance`,
        `/${business}/employees/payroll`,
        `/${business}/employees/expenses`,
        `/${business}/employees/schedules`,
        `/${business}/employees/leave-tracker`,
        `/${business}/employees/cash-advance`,
        `/${business}/employees/employee-loans`,
        `/${business}/employees/thirteenth-month-pay`,
        `/${business}/employees/settings`,
      ]
    : [];

  usePrefetchPages(pages, { delay: 500, sequential: false });
}
