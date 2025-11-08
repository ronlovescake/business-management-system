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

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { showNotification } from '@mantine/notifications';
import { useDataTable } from '@/hooks/useDataTable';
import { queryKeys } from '@/lib/queryKeys';
import { logger } from '@/lib/logger';
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
  const queryClient = useQueryClient();

  // ==========================================================================
  // STATE
  // ==========================================================================

  const [csvFile, setCsvFile] = useState<File | null>(null);

  // ==========================================================================
  // LOAD DATA using React Query
  // ==========================================================================

  const {
    data: shipments = [],
    isLoading: loading,
    refetch: loadShipments,
  } = useQuery({
    queryKey: queryKeys.shipments.lists(),
    queryFn: async () => {
      try {
        return await ShipmentService.loadShipments();
      } catch (error) {
        logger.error('Failed to load shipments:', error);
        showNotification({
          title: 'Error',
          message: 'Failed to load shipments data',
          color: 'red',
        });
        return [];
      }
    },
    staleTime: 30 * 1000,
  });

  // ==========================================================================
  // DATA TABLE INTEGRATION
  // ==========================================================================

  const { searchQuery, filteredData, handleSearch, getCellContent } =
    useDataTable({
      data: shipments,
      searchFields: SEARCH_FIELDS,
    });

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
   * Add shipment mutation
   */
  const addShipmentMutation = useMutation({
    mutationFn: async (formData: ShipmentFormData) => {
      return await ShipmentService.addShipment(formData);
    },
    onMutate: async (formData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.shipments.lists(),
      });

      // Snapshot previous value
      const previousShipments = queryClient.getQueryData<ShipmentData[]>(
        queryKeys.shipments.lists()
      );

      // Create temporary shipment for optimistic update
      // Note: We use a placeholder since we don't know the real ID yet
      // The real data will be fetched after successful mutation
      const tempShipment = {
        id: Date.now(), // Temporary ID
        'Shipment Code': formData.shipmentCode,
        'CV Number': formData.cvNumber,
        'No. Of Sacks': formData.noOfSacks,
        'Total CBM': formData.totalCBM,
        Weight: formData.weight,
        Fee: formData.fee,
        'Shipment Status': formData.shipmentStatus,
        'Date Created': formData.dateCreated?.toISOString() || '',
        'Date Delivered': formData.dateDelivered?.toISOString() || '',
        Duration: '', // Will be calculated after refetch
        Notes: formData.notes,
      } as ShipmentData;

      // Optimistically update
      if (previousShipments) {
        queryClient.setQueryData<ShipmentData[]>(queryKeys.shipments.lists(), [
          ...previousShipments,
          tempShipment,
        ]);
      }

      return { previousShipments };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousShipments) {
        queryClient.setQueryData(
          queryKeys.shipments.lists(),
          context.previousShipments
        );
      }
      logger.error('Error adding shipment:', _error);
      showNotification({
        title: '❌ Error',
        message: 'Failed to add shipment. Please try again.',
        color: 'red',
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.shipments.lists() });
    },
  });

  /**
   * Update shipment mutation
   */
  const updateShipmentMutation = useMutation({
    mutationFn: async ({
      id,
      formData,
      existingShipment,
    }: {
      id: number;
      formData: ShipmentFormData;
      existingShipment: ShipmentData;
    }) => {
      return await ShipmentService.updateShipment(
        id,
        formData,
        existingShipment
      );
    },
    onMutate: async ({ id, formData }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.shipments.lists(),
      });

      // Snapshot previous value
      const previousShipments = queryClient.getQueryData<ShipmentData[]>(
        queryKeys.shipments.lists()
      );

      // Optimistically update
      if (previousShipments) {
        queryClient.setQueryData<ShipmentData[]>(
          queryKeys.shipments.lists(),
          previousShipments.map((s) =>
            s.id === id ? { ...s, ...formData } : s
          )
        );
      }

      return { previousShipments };
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousShipments) {
        queryClient.setQueryData(
          queryKeys.shipments.lists(),
          context.previousShipments
        );
      }
      logger.error('Error updating shipment:', _error);
      showNotification({
        title: '❌ Error',
        message: 'Failed to update shipment. Please try again.',
        color: 'red',
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.shipments.lists() });
    },
  });

  /**
   * CSV import mutation
   */
  const csvImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const importedShipments = await ShipmentService.parseCSVFile(file);
      await ShipmentService.bulkImportShipments(importedShipments);
      return importedShipments;
    },
    onMutate: async () => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.shipments.lists(),
      });

      // Snapshot previous value
      const previousShipments = queryClient.getQueryData<ShipmentData[]>(
        queryKeys.shipments.lists()
      );

      return { previousShipments };
    },
    onSuccess: () => {
      // Clear file
      setCsvFile(null);
    },
    onError: (_error, _variables, context) => {
      // Rollback on error
      if (context?.previousShipments) {
        queryClient.setQueryData(
          queryKeys.shipments.lists(),
          context.previousShipments
        );
      }
      const errorMessage =
        _error instanceof Error ? _error.message : 'Unknown error occurred';
      logger.error('CSV import error:', _error);
      showNotification({
        title: '❌ Import Failed',
        message: `Failed to import CSV: ${errorMessage}`,
        color: 'red',
        autoClose: 6000,
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.shipments.lists() });
    },
  });

  // Wrapper functions to maintain API compatibility
  const addShipment = async (formData: ShipmentFormData): Promise<boolean> => {
    try {
      await addShipmentMutation.mutateAsync(formData);
      return true;
    } catch {
      return false;
    }
  };

  const updateShipment = async (
    id: number,
    formData: ShipmentFormData,
    existingShipment: ShipmentData
  ): Promise<boolean> => {
    try {
      await updateShipmentMutation.mutateAsync({
        id,
        formData,
        existingShipment,
      });
      return true;
    } catch {
      return false;
    }
  };

  const handleCSVImport = async (file: File): Promise<boolean> => {
    try {
      await csvImportMutation.mutateAsync(file);
      return true;
    } catch {
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
