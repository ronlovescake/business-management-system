'use client';

import React from 'react';
import { Grid, Stack, Text } from '@mantine/core';
import { PageLayout } from '@/components/layout/PageLayout';
import { useOperationsDashboard } from '../hooks';
import { DashboardHeader } from './sections/DashboardHeader';
import { DashboardStatisticsGrid } from './sections/DashboardStatisticsGrid';
import { SalesPerformanceCard } from './sections/SalesPerformanceCard';
import { SidebarHighlights } from './sections/SidebarHighlights';
import { OrderPipelineCard } from './sections/OrderPipelineCard';
import { ShipmentTimelineCard } from './sections/ShipmentTimelineCard';
import { InventoryHealthCard } from './sections/InventoryHealthCard';
import { RecentActivityCard } from './sections/RecentActivityCard';

export function DashboardPage() {
  const {
    statistics,
    todayActivity,
    monthlyGoal,
    recentActivities,
    orderFunnel,
    inventoryAlerts,
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
  } = useOperationsDashboard();

  if (isLoading) {
    return (
      <PageLayout title="Operations Dashboard">
        <Stack align="center" justify="center" style={{ minHeight: '400px' }}>
          <Text>Loading dashboard data...</Text>
        </Stack>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout title="Operations Dashboard">
        <Stack align="center" justify="center" style={{ minHeight: '400px' }}>
          <Text c="red">Error loading dashboard: {error.message}</Text>
        </Stack>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Operations Dashboard">
      <Stack gap="xl">
        <DashboardHeader />

        <DashboardStatisticsGrid statistics={statistics} />

        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <SalesPerformanceCard
              dataset={trendDataset}
              summary={trendSummary}
              trendRange={trendRange}
              onTrendRangeChange={setTrendRange}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <SidebarHighlights
              monthlyGoal={monthlyGoal}
              todayActivity={todayActivity}
            />
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <OrderPipelineCard
              orderFunnel={orderFunnel}
              activeStage={activeStage}
              onStageChange={setActiveStage}
              selectedStage={selectedStage}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <ShipmentTimelineCard
              shipments={filteredShipments}
              shipmentFilter={shipmentFilter}
              onFilterChange={setShipmentFilter}
            />
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <InventoryHealthCard
              inventoryAlerts={inventoryAlerts}
              inventorySummary={inventorySummary}
            />
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <RecentActivityCard activities={recentActivities} />
          </Grid.Col>
        </Grid>
      </Stack>
    </PageLayout>
  );
}
