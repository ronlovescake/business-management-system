/**
 * Dashboard Service Tests
 *
 * Comprehensive unit tests for DashboardService:
 * - Statistics generation
 * - Goal calculations
 * - Utility functions (change formatting, time ago)
 * - Data aggregation
 *
 * @group unit
 * @group dashboard
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DashboardService } from '../DashboardService';
import type { DashboardMetrics } from '../../types/dashboard.types';

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    service = new DashboardService();
  });

  // ==========================================================================
  // STATISTICS GENERATION TESTS
  // ==========================================================================

  describe('generateStatistics', () => {
    it('should generate statistics with correct values', () => {
      const metrics: DashboardMetrics = {
        totalRevenue: 10000,
        activeOrders: 100,
        totalCustomers: 500,
        totalProducts: 250,
        revenueChange: 15.5,
        ordersChange: -5.2,
        customersChange: 10.0,
        productsChange: 3.3,
      };

      const result = service.generateStatistics(metrics);

      expect(result).toHaveLength(4);
      expect(result[0].title).toBe('Total Revenue');
      expect(result[1].title).toBe('Active Orders');
      expect(result[2].title).toBe('Customers');
      expect(result[3].title).toBe('Products');
    });

    it('should format currency for revenue', () => {
      const metrics: DashboardMetrics = {
        totalRevenue: 12345.67,
        activeOrders: 0,
        totalCustomers: 0,
        totalProducts: 0,
        revenueChange: 0,
        ordersChange: 0,
        customersChange: 0,
        productsChange: 0,
      };

      const result = service.generateStatistics(metrics);

      expect(result[0].value).toContain('12,345.67');
    });

    it('should format numbers without decimals for counts', () => {
      const metrics: DashboardMetrics = {
        totalRevenue: 0,
        activeOrders: 123,
        totalCustomers: 456,
        totalProducts: 789,
        revenueChange: 0,
        ordersChange: 0,
        customersChange: 0,
        productsChange: 0,
      };

      const result = service.generateStatistics(metrics);

      expect(result[1].value).toBe('123');
      expect(result[2].value).toBe('456');
      expect(result[3].value).toBe('789');
    });

    it('should set green color for positive changes', () => {
      const metrics: DashboardMetrics = {
        totalRevenue: 1000,
        activeOrders: 100,
        totalCustomers: 100,
        totalProducts: 100,
        revenueChange: 10.0,
        ordersChange: 5.5,
        customersChange: 2.3,
        productsChange: 1.1,
      };

      const result = service.generateStatistics(metrics);

      expect(result[0].color).toBe('green'); // Revenue positive
      expect(result[1].color).toBe('blue'); // Orders positive (uses blue)
      expect(result[2].color).toBe('violet'); // Customers positive (uses violet)
      expect(result[3].color).toBe('orange'); // Products positive (uses orange)
    });

    it('should set red color for negative changes', () => {
      const metrics: DashboardMetrics = {
        totalRevenue: 1000,
        activeOrders: 100,
        totalCustomers: 100,
        totalProducts: 100,
        revenueChange: -10.0,
        ordersChange: -5.5,
        customersChange: -2.3,
        productsChange: -1.1,
      };

      const result = service.generateStatistics(metrics);

      expect(result[0].color).toBe('red');
      expect(result[1].color).toBe('red');
      expect(result[2].color).toBe('red');
      expect(result[3].color).toBe('red');
    });

    it('should include change percentages', () => {
      const metrics: DashboardMetrics = {
        totalRevenue: 1000,
        activeOrders: 100,
        totalCustomers: 100,
        totalProducts: 100,
        revenueChange: 15.5,
        ordersChange: -3.2,
        customersChange: 0,
        productsChange: 8.9,
      };

      const result = service.generateStatistics(metrics);

      expect(result[0].change).toBe('+15.5%');
      expect(result[1].change).toBe('-3.2%');
      expect(result[2].change).toBe('+0.0%');
      expect(result[3].change).toBe('+8.9%');
    });

    it('should include icons for each statistic', () => {
      const metrics: DashboardMetrics = {
        totalRevenue: 1000,
        activeOrders: 100,
        totalCustomers: 100,
        totalProducts: 100,
        revenueChange: 0,
        ordersChange: 0,
        customersChange: 0,
        productsChange: 0,
      };

      const result = service.generateStatistics(metrics);

      expect(result[0].icon).toBeDefined();
      expect(result[1].icon).toBeDefined();
      expect(result[2].icon).toBeDefined();
      expect(result[3].icon).toBeDefined();
    });
  });

  // ==========================================================================
  // GOAL CALCULATIONS TESTS
  // ==========================================================================

  describe('calculateMonthlyGoal', () => {
    it('should calculate percentage correctly', () => {
      const result = service.calculateMonthlyGoal(50000, 100000);

      expect(result.current).toBe(50000);
      expect(result.target).toBe(100000);
      expect(result.percentage).toBe(50);
    });

    it('should cap percentage at 100%', () => {
      const result = service.calculateMonthlyGoal(150000, 100000);

      expect(result.percentage).toBe(100);
    });

    it('should handle 0% progress', () => {
      const result = service.calculateMonthlyGoal(0, 100000);

      expect(result.percentage).toBe(0);
    });

    it('should handle 100% exact progress', () => {
      const result = service.calculateMonthlyGoal(100000, 100000);

      expect(result.percentage).toBe(100);
    });

    it('should handle zero target gracefully', () => {
      const result = service.calculateMonthlyGoal(50000, 0);

      expect(result.percentage).toBe(0);
    });

    it('should round percentage to nearest integer', () => {
      const result = service.calculateMonthlyGoal(33333, 100000);

      expect(result.percentage).toBe(33); // 33.333 rounds to 33
    });
  });

  // ==========================================================================
  // UTILITY FUNCTIONS TESTS
  // ==========================================================================

  describe('formatChange', () => {
    it('should format positive change with + sign', () => {
      const result = service.formatChange(12.5);
      expect(result).toBe('+12.5%');
    });

    it('should format negative change with - sign', () => {
      const result = service.formatChange(-5.3);
      expect(result).toBe('-5.3%');
    });

    it('should format zero with + sign', () => {
      const result = service.formatChange(0);
      expect(result).toBe('+0.0%');
    });

    it('should round to 1 decimal place', () => {
      const result = service.formatChange(12.567);
      expect(result).toBe('+12.6%');
    });

    it('should handle very small numbers', () => {
      const result = service.formatChange(0.01);
      expect(result).toBe('+0.0%');
    });
  });

  describe('formatTimeAgo', () => {
    it('should return "Just now" for times under 60 seconds', () => {
      const date = new Date(Date.now() - 30 * 1000); // 30 seconds ago
      const result = service.formatTimeAgo(date);
      expect(result).toBe('Just now');
    });

    it('should return minutes for times under 1 hour', () => {
      const date = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      const result = service.formatTimeAgo(date);
      expect(result).toBe('5 minutes ago');
    });

    it('should use singular "minute" for 1 minute', () => {
      const date = new Date(Date.now() - 1 * 60 * 1000); // 1 minute ago
      const result = service.formatTimeAgo(date);
      expect(result).toBe('1 minute ago');
    });

    it('should return hours for times under 24 hours', () => {
      const date = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
      const result = service.formatTimeAgo(date);
      expect(result).toBe('3 hours ago');
    });

    it('should use singular "hour" for 1 hour', () => {
      const date = new Date(Date.now() - 1 * 60 * 60 * 1000); // 1 hour ago
      const result = service.formatTimeAgo(date);
      expect(result).toBe('1 hour ago');
    });

    it('should return days for times 24+ hours', () => {
      const date = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const result = service.formatTimeAgo(date);
      expect(result).toBe('2 days ago');
    });

    it('should use singular "day" for 1 day', () => {
      const date = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const result = service.formatTimeAgo(date);
      expect(result).toBe('1 day ago');
    });

    it('should handle future dates as "Just now"', () => {
      const date = new Date(Date.now() + 1000); // 1 second in future
      const result = service.formatTimeAgo(date);
      expect(result).toBe('Just now');
    });
  });

  // ==========================================================================
  // DATA AGGREGATION TESTS
  // ==========================================================================

  describe('aggregateDashboardData', () => {
    it('should return dashboard data with all required fields', async () => {
      const result = await service.aggregateDashboardData();

      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('todayActivity');
      expect(result).toHaveProperty('monthlyGoal');
      expect(result).toHaveProperty('recentActivities');
    });

    it('should return metrics with all required values', async () => {
      const result = await service.aggregateDashboardData();

      expect(result.metrics).toHaveProperty('totalRevenue');
      expect(result.metrics).toHaveProperty('activeOrders');
      expect(result.metrics).toHaveProperty('totalCustomers');
      expect(result.metrics).toHaveProperty('totalProducts');
      expect(result.metrics).toHaveProperty('revenueChange');
      expect(result.metrics).toHaveProperty('ordersChange');
      expect(result.metrics).toHaveProperty('customersChange');
      expect(result.metrics).toHaveProperty('productsChange');
    });

    it('should return today activity with counts', async () => {
      const result = await service.aggregateDashboardData();

      expect(result.todayActivity).toHaveProperty('newOrders');
      expect(result.todayActivity).toHaveProperty('pendingShipments');
      expect(result.todayActivity).toHaveProperty('lowStockItems');
    });

    it('should return monthly goal with current, target, and percentage', async () => {
      const result = await service.aggregateDashboardData();

      expect(result.monthlyGoal).toHaveProperty('current');
      expect(result.monthlyGoal).toHaveProperty('target');
      expect(result.monthlyGoal).toHaveProperty('percentage');
    });

    it('should return array of recent activities', async () => {
      const result = await service.aggregateDashboardData();

      expect(Array.isArray(result.recentActivities)).toBe(true);
      expect(result.recentActivities.length).toBeGreaterThan(0);
    });

    it('should return recent activities with required fields', async () => {
      const result = await service.aggregateDashboardData();

      result.recentActivities.forEach((activity) => {
        expect(activity).toHaveProperty('action');
        expect(activity).toHaveProperty('time');
        expect(activity).toHaveProperty('color');
      });
    });

    it('should calculate monthly goal percentage correctly', async () => {
      const result = await service.aggregateDashboardData();

      // Based on mock data: current 45231, target 75000
      expect(result.monthlyGoal.percentage).toBe(60); // Math.round(45231/75000*100)
    });
  });
});
