'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { statusColors } from '../data/fleetRegistryData';
import type { FleetRegistryRecord } from '../types/fleetRegistry.types';

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export type VehicleDetailsSectionId =
  | 'identification'
  | 'registration'
  | 'performance'
  | 'notes';

export interface VehicleDetailsSection {
  id: VehicleDetailsSectionId;
  title: string;
  items: Array<{ label: string; value: string }>;
}

export function useFleetVehicleDetails(vehicleId: string) {
  const [vehicle, setVehicle] = useState<FleetRegistryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVehicle = useCallback(async () => {
    const normalizedId = vehicleId?.trim();
    if (!normalizedId) {
      setVehicle(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/trucking/fleet-vehicles/${encodeURIComponent(normalizedId)}`,
        { cache: 'no-store' }
      );

      if (response.status === 404) {
        setVehicle(null);
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to load vehicle details');
      }

      const payload = (await response.json()) as {
        data?: FleetRegistryRecord | null;
      };

      setVehicle(payload.data ?? null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId]);

  useEffect(() => {
    void fetchVehicle();
  }, [fetchVehicle]);

  const quickStats = useMemo(() => {
    if (!vehicle) {
      return [];
    }

    return [
      { label: 'Capacity', value: vehicle.capacity || 'N/A' },
      {
        label: 'Passenger Capacity',
        value: vehicle.passengerCapacity || 'N/A',
      },
      { label: 'Gross Weight', value: vehicle.grossWeight || 'N/A' },
      { label: 'Net Weight', value: vehicle.netWeight || 'N/A' },
      { label: 'Fuel Type', value: vehicle.fuelType || 'N/A' },
    ];
  }, [vehicle]);

  const sections: VehicleDetailsSection[] = useMemo(() => {
    if (!vehicle) {
      return [];
    }

    const base: VehicleDetailsSection[] = [
      {
        id: 'identification',
        title: 'Vehicle Identification',
        items: [
          { label: 'Vehicle ID', value: vehicle.truckId },
          { label: 'Maker', value: vehicle.maker },
          { label: 'Model', value: vehicle.model },
          { label: 'Series', value: vehicle.series || 'N/A' },
          { label: 'Body Type', value: vehicle.bodyType || 'N/A' },
          { label: 'Year', value: String(vehicle.year) },
          { label: 'Body Number', value: vehicle.bodyNo || 'N/A' },
          { label: 'Chassis Number', value: vehicle.chassisNo || 'N/A' },
          { label: 'Engine Number', value: vehicle.engineNo || 'N/A' },
        ],
      },
      {
        id: 'registration',
        title: 'Route History',
        items: [
          { label: 'Plate Number', value: vehicle.plateNo || 'N/A' },
          { label: 'OR/CR Info', value: vehicle.orCrInfo || 'N/A' },
          {
            label: 'LTO Register Date',
            value: formatDate(vehicle.ltoRegisterDate),
          },
          { label: 'Classification', value: vehicle.classification || 'N/A' },
          { label: 'Vehicle Type', value: vehicle.vehicleType || 'N/A' },
          {
            label: 'Status',
            value:
              vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1),
          },
        ],
      },
      {
        id: 'performance',
        title: 'Fuel Consumption',
        items: [
          { label: 'Capacity', value: vehicle.capacity || 'N/A' },
          {
            label: 'Passenger Capacity',
            value: vehicle.passengerCapacity || 'N/A',
          },
          { label: 'Gross Weight', value: vehicle.grossWeight || 'N/A' },
          { label: 'Net Weight', value: vehicle.netWeight || 'N/A' },
          { label: 'Fuel Type', value: vehicle.fuelType || 'N/A' },
        ],
      },
    ];

    if (vehicle.remarks) {
      base.push({
        id: 'notes',
        title: 'Maintenance & Repairs History',
        items: [{ label: 'Remarks', value: vehicle.remarks }],
      });
    }

    return base;
  }, [vehicle]);

  return {
    vehicle,
    quickStats,
    sections,
    statusColor: vehicle ? statusColors[vehicle.status] : 'gray',
    isLoading,
    error,
    refresh: fetchVehicle,
  };
}
