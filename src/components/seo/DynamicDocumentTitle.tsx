'use client';

import { useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';

const BRAND_TITLE = 'Business Management System';

type PathOverride = {
  pattern: RegExp;
  title: string;
  appendBrand?: boolean;
};

const PATH_OVERRIDES: PathOverride[] = [
  { pattern: /^\/$/, title: BRAND_TITLE, appendBrand: false },
  { pattern: /^\/login/, title: 'Login' },
  { pattern: /^\/forgot-password/, title: 'Forgot Password' },
  { pattern: /^\/reset-password/, title: 'Reset Password' },
];

const SEGMENT_OVERRIDES: Record<string, string> = {
  clothing: 'Clothing',
  trucking: 'Trucking',
  operations: 'Operations',
  employees: 'Employees',
  team: 'Team Member',
  dispatch: 'Dispatch',
  dispatching: 'Dispatching',
  transactions: 'Transactions',
  products: 'Products',
  customers: 'Customers',
  shipments: 'Shipments',
  inventory: 'Inventory',
  settings: 'Settings',
  'change-log': 'Change Log',
  'due-dates': 'Due Dates',
  'message-templates': 'Message Templates',
  'invoice-message': 'Invoice Templates',
  'post-template': 'Post Templates',
  notifications: 'Notifications',
  'checkout-links': 'Checkout Links',
  prices: 'Prices',
  'sorting-distribution': 'Sorting & Distribution',
  'business-intelligence': 'Business Intelligence',
  backup: 'Backup',
  messaging: 'Messaging',
};

const IGNORED_SEGMENTS = new Set(['api']);

function formatSegment(segment: string) {
  return decodeURIComponent(segment)
    .split(/[\-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function buildTitle(pathname: string | null) {
  if (!pathname) {
    return BRAND_TITLE;
  }

  const override = PATH_OVERRIDES.find((entry) => entry.pattern.test(pathname));
  if (override) {
    if (override.appendBrand) {
      return `${override.title} | ${BRAND_TITLE}`;
    }
    return override.title;
  }

  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) {
    return BRAND_TITLE;
  }

  let label: string | undefined;
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const rawSegment = segments[i];
    const normalized = rawSegment.toLowerCase();
    if (!normalized || IGNORED_SEGMENTS.has(normalized)) {
      continue;
    }
    if (/^\d+$/.test(normalized)) {
      continue;
    }
    if (normalized === 'index' || normalized === 'page') {
      continue;
    }

    label = SEGMENT_OVERRIDES[normalized] ?? formatSegment(rawSegment);
    break;
  }

  if (!label) {
    const lastSegment = segments[segments.length - 1];
    if (!/^\d+$/.test(lastSegment)) {
      label = formatSegment(lastSegment);
    }
  }

  if (!label) {
    return BRAND_TITLE;
  }

  return label;
}

export function DynamicDocumentTitle() {
  const pathname = usePathname();
  const computedTitle = useMemo(() => buildTitle(pathname), [pathname]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = computedTitle;
    }
  }, [computedTitle]);

  return null;
}
