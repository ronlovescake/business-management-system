import { useEffect, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import type { TripRecord } from '../components/TripsTable';
import type {
  CustomerLite,
  FleetVehicle,
  TeamMember,
  TripCustomer,
  VehicleAssignment,
} from './tripsDashboardTypes';
import {
  applyCustomerNamesToTrips,
  buildEmployeeName,
  isActiveStatus,
  normalizeJobTitle,
  normalizeTripRecord,
} from './tripsDashboardUtils';

export function useTripsDashboardData() {
  const [trips, setTrips] = useState<TripRecord[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [helpers, setHelpers] = useState<string[]>([]);
  const [fleetVehicles, setFleetVehicles] = useState<string[]>([]);
  const [customers, setCustomers] = useState<TripCustomer[]>([]);
  const [assignments, setAssignments] = useState<VehicleAssignment[]>([]);

  useEffect(() => {
    setTrips((previous) => applyCustomerNamesToTrips(previous, customers));
  }, [customers]);

  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const response = await fetch('/api/trucking/trips', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Failed to load trips');
        }

        const data = (await response.json()) as TripRecord[];
        if (!Array.isArray(data)) {
          throw new Error('Unexpected trips response');
        }

        setTrips(data.map(normalizeTripRecord));
      } catch (error) {
        showNotification({
          title: 'Trips unavailable',
          message:
            error instanceof Error ? error.message : 'Could not load trips',
          color: 'orange',
        });
        setTrips([]);
      }
    };

    const fetchCustomers = async () => {
      try {
        const response = await fetch('/api/customers?status=active', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Failed to load customers');
        }

        const payload = (await response.json()) as
          | CustomerLite[]
          | { data?: CustomerLite[] };
        const data = Array.isArray(payload) ? payload : (payload.data ?? []);

        const mapped = data
          .map((item) => ({
            id: Number(item.id ?? 0),
            name: (item.customerName ?? item.name ?? '').trim(),
          }))
          .filter((item) => item.id && item.name.length > 0);

        const deduped = Array.from(
          new Map(mapped.map((item) => [item.id, item.name]))
        ).map(([id, name]) => ({ id: Number(id), name: String(name) }));

        setCustomers(
          deduped.sort((left, right) => left.name.localeCompare(right.name))
        );
      } catch (error) {
        showNotification({
          title: 'Customers unavailable',
          message:
            error instanceof Error ? error.message : 'Could not load customers',
          color: 'orange',
        });
      }
    };

    const fetchVehicles = async () => {
      try {
        const response = await fetch('/api/trucking/fleet-vehicles', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Failed to load vehicles');
        }

        const payload = (await response.json()) as
          | FleetVehicle[]
          | { data?: FleetVehicle[] };
        const vehicles = Array.isArray(payload)
          ? payload
          : (payload.data ?? []);
        const options = Array.from(
          new Set(
            vehicles
              .map((item) => item.truckId?.trim() || item.plateNo?.trim() || '')
              .filter((value): value is string => Boolean(value))
          )
        ).sort();

        setFleetVehicles(options);
      } catch (error) {
        showNotification({
          title: 'Vehicles unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Could not load fleet vehicles',
          color: 'orange',
        });
      }
    };

    const fetchAssignments = async () => {
      try {
        const response = await fetch('/api/trucking/vehicle-assignments', {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Failed to load vehicle assignments');
        }

        const payload = (await response.json()) as {
          data?: VehicleAssignment[];
        };
        const data = Array.isArray(payload.data) ? payload.data : [];

        const normalized = data
          .map((row) => ({
            vehicleId: (row.vehicleId || '').trim(),
            driver: (row.driver || '').trim(),
            helper: (row.helper || '').trim(),
            startDate: row.startDate,
            endDate: row.endDate,
            status: row.status,
          }))
          .filter((row) => row.vehicleId && row.startDate && row.endDate);

        setAssignments(normalized);
      } catch (error) {
        showNotification({
          title: 'Assignments unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Could not load vehicle assignments',
          color: 'orange',
        });
        setAssignments([]);
      }
    };

    const fetchTeam = async () => {
      try {
        const response = await fetch('/api/trucking/employees?status=active', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Failed to load team');
        }

        const payload = (await response.json()) as
          | TeamMember[]
          | { data?: TeamMember[] };
        const data = Array.isArray(payload) ? payload : (payload.data ?? []);

        const driverNames = new Set<string>();
        const helperNames = new Set<string>();

        data.forEach((member) => {
          if (!isActiveStatus(member.status)) {
            return;
          }

          const name = buildEmployeeName(member);
          if (!name) {
            return;
          }

          const job = normalizeJobTitle(member.jobTitle);
          if (job.includes('driver')) {
            driverNames.add(name);
          }
          if (job.includes('helper')) {
            helperNames.add(name);
          }
        });

        setDrivers(Array.from(driverNames).sort());
        setHelpers(Array.from(helperNames).sort());
      } catch (error) {
        showNotification({
          title: 'Team list unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Could not load team members',
          color: 'orange',
        });
      }
    };

    void fetchTrips();
    void fetchCustomers();
    void fetchVehicles();
    void fetchTeam();
    void fetchAssignments();
  }, []);

  return {
    trips,
    setTrips,
    drivers,
    helpers,
    fleetVehicles,
    customers,
    assignments,
  };
}
