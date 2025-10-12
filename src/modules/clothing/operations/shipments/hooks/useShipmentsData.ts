'use client';

/**
 * Shipments Module - Data Management Hook
 *
 * This hook manages:
 * - Shipments data fetching and state
 * - CRUD operations with optimistic updates
 * - CSV import functionality
 * - Search and filtering
 * - Memoized statistics calculation
 */

import { useState, useEffect, useMemo } from 'react';
import { notifications } from '@mantine/notifications';
import { useDataTable } from '@/hooks/useDataTable';
import { ShipmentService } from '../services/ShipmentService';
import type {
  ShipmentData,
  ShipmentFormData,
  ShipmentStatistics,
} from '../types/shipment.types';
import { SEARCH_FIELDS } from '../types/shipment.types';

/**
 * Hook for managing shipments data and operations
 */
export function useShipmentsData() {
  // ==========================================================================
  // STATE
  // ==========================================================================

  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // ==========================================================================
  // DATA TABLE INTEGRATION
  // ==========================================================================

  const { searchQuery, filteredData, handleSearch, getCellContent } =
    useDataTable({
      data: shipments,
      searchFields: SEARCH_FIELDS,
    });

  // ==========================================================================
  // LOAD DATA
  // ==========================================================================

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    try {
      setLoading(true);
      const data = await ShipmentService.loadShipments();
      setShipments(data);
    } catch (error) {
      console.error('Failed to load shipments:', error);
      notifications.show({
        title: 'Error',
        message: 'Failed to load shipments data',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // ==========================================================================
  // MEMOIZED STATISTICS
  // ==========================================================================

  const statistics: ShipmentStatistics = useMemo(() => {
    return ShipmentService.calculateStatistics(filteredData);
  }, [filteredData]);

  // ==========================================================================
  // CRUD OPERATIONS
  // ==========================================================================

  /**
   * Add new shipment with optimistic update
   */
  const addShipment = async (formData: ShipmentFormData): Promise<boolean> => {
    try {
      const createdShipment = await ShipmentService.addShipment(formData);

      // Optimistic update
      setShipments((prev) => [...prev, createdShipment]);

      return true;
    } catch (error) {
      console.error('Error adding shipment:', error);
      notifications.show({
        title: '❌ Error',
        message: 'Failed to add shipment. Please try again.',
        color: 'red',
      });
      return false;
    }
  };

  /**
   * Update existing shipment with optimistic update
   */
  const updateShipment = async (
    id: number,
    formData: ShipmentFormData,
    existingShipment: ShipmentData
  ): Promise<boolean> => {
    try {
      const updatedShipment = await ShipmentService.updateShipment(
        id,
        formData,
        existingShipment
      );

      // Optimistic update
      setShipments((prev) =>
        prev.map((s) => (s.id === id ? updatedShipment : s))
      );

      return true;
    } catch (error) {
      console.error('Error updating shipment:', error);
      notifications.show({
        title: '❌ Error',
        message: 'Failed to update shipment. Please try again.',
        color: 'red',
      });
      return false;
    }
  };

  /**
   * Import shipments from CSV file
   */
  const handleCSVImport = async (file: File): Promise<boolean> => {
    try {
      // Parse CSV file
      const importedShipments = await ShipmentService.parseCSVFile(file);

      // Bulk import to API
      await ShipmentService.bulkImportShipments(importedShipments);

      // Optimistic update
      setShipments((prev) => [...prev, ...importedShipments]);

      // Clear file
      setCsvFile(null);

      return true;
    } catch (error) {
      console.error('Import error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      notifications.show({
        title: '❌ Import Failed',
        message: `Failed to import CSV: ${errorMessage}`,
        color: 'red',
        autoClose: 6000,
      });
      return false;
    }
  };

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Data
    shipments,
    filteredData,
    loading,

    // Statistics
    statistics,

    // Search
    searchQuery,
    handleSearch,
    getCellContent,

    // CSV Import
    csvFile,
    setCsvFile,
    handleCSVImport,

    // CRUD Operations
    addShipment,
    updateShipment,

    // Reload
    loadShipments,
  };
}
