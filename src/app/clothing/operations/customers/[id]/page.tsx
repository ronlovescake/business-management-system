'use client';

import { CustomerDetailsRoutePage } from '@/app/operations/customers/_shared/CustomerDetailsRoutePage';

// ============================================================================
// CUSTOMER DETAILS PAGE
// ============================================================================

/**
 * Customer Details Page
 *
 * Dynamic route page that displays comprehensive customer information,
 * including orders, transactions, analytics, and edit functionality.
 *
 * Features:
 * - Customer profile with contact and business information
 * - Key metrics: total transactions, completion rate, cancellation rate, avg value
 * - Customer analytics: order status breakdown, performance metrics, financial summary
 * - Orders and Transactions tabs with detailed tables
 * - Edit customer modal with form validation
 * - Responsive layout with stat cards and charts
 *
 * Data Sources:
 * - Customer API: /api/customers/[id]
 * - Orders API: /api/customers/[id]/orders
 * - Transactions API: /api/customers/[id]/transactions
 *
 * Modular Architecture:
 * - types.ts: TypeScript interfaces for all data models
 * - hooks/useCustomerDetails.ts: Business logic, data fetching, computed stats
 * - components/CustomerStatsCards.tsx: Key metrics display
 * - components/CustomerAnalytics.tsx: Analytics dashboard
 * - components/CustomerInfoCard.tsx: Contact information display
 * - components/OrdersAndTransactions.tsx: Tabbed data tables
 * - components/EditCustomerModal.tsx: Edit form modal
 * - components/CustomerDetailsView.tsx: Main orchestrator component
 * - utils.tsx: Helper functions (status colors, formatting, etc.)
 */

export default function CustomerDetailsPage() {
  return <CustomerDetailsRoutePage />;
}
