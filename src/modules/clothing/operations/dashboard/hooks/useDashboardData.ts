'use client';

/**
 * useDashboardData Hook
 *
 * Manages data fetching and state for Operations Dashboard
 */

import { useState, useEffect } from 'react';
import { dashboardService } from '../services/DashboardService';
import type {
  DashboardData,
  DashboardStatistic,
} from '../types/dashboard.types';

export function useDashboardData() {
  // ==========================================================================
  // STATE
  // ==========================================================================

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  useEffect(() => {
    let isMounted = true;

    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await dashboardService.aggregateDashboardData();

        if (isMounted) {
          setDashboardData(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err
              : new Error('Failed to fetch dashboard data')
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  // ==========================================================================
  // DERIVED DATA
  // ==========================================================================

  const statistics: DashboardStatistic[] = dashboardData
    ? dashboardService.generateStatistics(dashboardData.metrics)
    : [];

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Raw data
    dashboardData,

    // Derived data
    statistics,
    metrics: dashboardData?.metrics,
    todayActivity: dashboardData?.todayActivity,
    monthlyGoal: dashboardData?.monthlyGoal,
    recentActivities: dashboardData?.recentActivities || [],
    salesTrends: dashboardData?.salesTrends || [],
    orderFunnel: dashboardData?.orderFunnel || [],
    inventoryAlerts: dashboardData?.inventoryAlerts || [],
    shipmentUpdates: dashboardData?.shipmentUpdates || [],

    // Status
    isLoading,
    error,
  };
}
