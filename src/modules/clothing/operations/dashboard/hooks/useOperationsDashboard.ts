'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDashboardData } from './useDashboardData';
import type { ShipmentUpdate, TrendRange } from '../types/dashboard.types';

interface InventorySummary {
  high: number;
  medium: number;
  low: number;
}

export function useOperationsDashboard() {
  const {
    statistics,
    todayActivity,
    monthlyGoal,
    recentActivities,
    salesTrends,
    orderFunnel,
    inventoryAlerts,
    shipmentUpdates,
    isLoading,
    error,
  } = useDashboardData();

  const [trendRange, setTrendRange] = useState<TrendRange>('30d');
  const [activeStage, setActiveStage] = useState<string>(
    orderFunnel[0]?.label ?? ''
  );
  const [shipmentFilter, setShipmentFilter] = useState<
    ShipmentUpdate['status'] | 'all'
  >('all');

  useEffect(() => {
    if (!orderFunnel.length) {
      setActiveStage('');
      return;
    }

    if (!orderFunnel.some((stage) => stage.label === activeStage)) {
      setActiveStage(orderFunnel[0].label);
    }
  }, [orderFunnel, activeStage]);

  useEffect(() => {
    if (!salesTrends.length) {
      setTrendRange('30d');
      return;
    }

    if (!salesTrends.some((dataset) => dataset.range === trendRange)) {
      setTrendRange(salesTrends[0].range);
    }
  }, [salesTrends, trendRange]);

  const trendDataset = useMemo(() => {
    if (!salesTrends.length) {
      return null;
    }

    return (
      salesTrends.find((dataset) => dataset.range === trendRange) ??
      salesTrends[0]
    );
  }, [salesTrends, trendRange]);

  const trendSummary = useMemo(() => {
    if (!trendDataset || trendDataset.points.length === 0) {
      return {
        totalRevenue: 0,
        avgOrders: 0,
        fulfillmentRate: 0,
      };
    }

    const totals = trendDataset.points.reduce(
      (acc, point) => {
        acc.totalRevenue += point.revenue;
        acc.totalOrders += point.orders;
        acc.fulfillmentRate += point.fulfillmentRate;
        return acc;
      },
      { totalRevenue: 0, totalOrders: 0, fulfillmentRate: 0 }
    );

    return {
      totalRevenue: totals.totalRevenue,
      avgOrders: totals.totalOrders / trendDataset.points.length,
      fulfillmentRate: Math.round(
        totals.fulfillmentRate / trendDataset.points.length
      ),
    };
  }, [trendDataset]);

  const selectedStage = useMemo(
    () => orderFunnel.find((stage) => stage.label === activeStage),
    [orderFunnel, activeStage]
  );

  const inventorySummary = useMemo<InventorySummary>(() => {
    if (!inventoryAlerts.length) {
      return { high: 0, medium: 0, low: 0 };
    }

    return inventoryAlerts.reduce(
      (acc, alert) => ({
        ...acc,
        [alert.severity]: acc[alert.severity] + 1,
      }),
      { high: 0, medium: 0, low: 0 } as InventorySummary
    );
  }, [inventoryAlerts]);

  const filteredShipments = useMemo(() => {
    if (shipmentFilter === 'all') {
      return shipmentUpdates;
    }

    return shipmentUpdates.filter(
      (shipment) => shipment.status === shipmentFilter
    );
  }, [shipmentFilter, shipmentUpdates]);

  return {
    statistics,
    todayActivity,
    monthlyGoal,
    recentActivities,
    salesTrends,
    orderFunnel,
    inventoryAlerts,
    shipmentUpdates,
    isLoading,
    error,
    trendRange,
    setTrendRange,
    activeStage,
    setActiveStage,
    shipmentFilter,
    setShipmentFilter,
    trendDataset,
    trendSummary,
    selectedStage,
    inventorySummary,
    filteredShipments,
  };
}
