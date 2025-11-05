'use client';

import dynamic from 'next/dynamic';
import { PageLayout } from '../../../../components/layout/PageLayout';
import { Center, Loader } from '@mantine/core';

// Lazy load BiDashboard to reduce initial bundle size (heavy recharts dependency)
const BiDashboard = dynamic(
  () =>
    import('./components/BiDashboard').then((mod) => ({
      default: mod.BiDashboard,
    })),
  {
    ssr: false,
    loading: () => (
      <Center h={400}>
        <Loader size="lg" />
      </Center>
    ),
  }
);

// ============================================================================
// BUSINESS INTELLIGENCE PAGE
// ============================================================================

/**
 * Business Intelligence Dashboard Page
 *
 * Features:
 * - Real-time metrics (YTD, MTD, COGS, shipments)
 * - Interactive date filtering (YTD, MTD, last 7/30 days, 3/6 months, all)
 * - Monthly trends visualization with Line, Area, Bar, and Composed charts
 * - Top performers analysis (products, customers)
 * - Comprehensive data tables and statistics
 * - Recharts integration for advanced visualizations
 *
 * Data Sources:
 * - Transactions API (/api/clothing/operations/transactions)
 * - Products API (/api/clothing/operations/products)
 * - Shipments API (/api/clothing/operations/shipments)
 *
 * Modular Architecture:
 * - types.ts: TypeScript interfaces for all data models
 * - hooks/useBusinessIntelligence.ts: Business logic, data fetching, calculations
 * - components/StatCard.tsx: Reusable metric card component
 * - components/BiDashboard.tsx: Main dashboard orchestrator with all visualizations
 * - constants.ts: Shared constants (chart colors)
 */

export default function BusinessIntelligencePage() {
  return (
    <PageLayout title="Business Intelligence">
      <BiDashboard />
    </PageLayout>
  );
}
