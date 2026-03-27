'use client';

import { useState } from 'react';
import { showNotification } from '@mantine/notifications';
import { showCustomAlert } from '@/lib/alerts';
import type { TripRecord } from '../components/TripsTable';
import { useTripsDashboardData } from './useTripsDashboardData';
import type { NewTripPayload } from './tripsDashboardTypes';
import { buildTripsCsv, normalizeTripRecord } from './tripsDashboardUtils';
import { useTripsDashboardViewModel } from './useTripsDashboardViewModel';

export type { NewTripPayload } from './tripsDashboardTypes';

export function useTripsDashboard() {
  const {
    trips,
    setTrips,
    drivers,
    helpers,
    fleetVehicles,
    customers,
    assignments,
  } = useTripsDashboardData();
  const {
    filteredTrips,
    stats,
    summary,
    filters,
    collections,
    findExpectedCrew,
    formatCurrency,
  } = useTripsDashboardViewModel({
    trips,
    drivers,
    helpers,
    fleetVehicles,
    customers,
    assignments,
  });
  const [isImporting, setIsImporting] = useState(false);
  const [isLogTripOpen, setIsLogTripOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripRecord | null>(null);

  const handleImportTrips = async (file: File | null) => {
    if (!file) {
      return;
    }

    setIsImporting(true);
    try {
      await file.text();
      showNotification({
        title: 'Import queued',
        message: `${file.name} uploaded for processing`,
        color: 'blue',
      });
    } catch (error) {
      showNotification({
        title: 'Import failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportTrips = () => {
    const csv = buildTripsCsv(filteredTrips);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trips-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification({
      title: 'Export ready',
      message: 'Filtered trips CSV generated successfully.',
      color: 'green',
    });
  };

  const openLogTrip = () => {
    setEditingTrip(null);
    setIsLogTripOpen(true);
  };
  const openEditTrip = (trip: TripRecord) => {
    setEditingTrip(trip);
    setIsLogTripOpen(true);
  };
  const closeLogTrip = () => {
    setEditingTrip(null);
    setIsLogTripOpen(false);
  };

  const handleCreateOrUpdateTrip = async (
    payload: NewTripPayload,
    existingId?: string
  ) => {
    try {
      const response = await fetch(
        existingId
          ? `/api/trucking/trips/${existingId}`
          : '/api/trucking/trips',
        {
          method: existingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to save trip');
      }

      const created = (await response.json()) as TripRecord;
      const createdWithCustomer = {
        ...created,
        customerName:
          customers.find((c) => c.id === created.customerId)?.name ??
          created.customerName ??
          null,
      };
      setTrips((prev) => {
        if (!existingId) {
          return [normalizeTripRecord(createdWithCustomer), ...prev];
        }
        return prev.map((trip) =>
          trip.id === existingId
            ? normalizeTripRecord(createdWithCustomer)
            : trip
        );
      });

      showNotification({
        title: existingId ? 'Trip updated' : 'Trip logged',
        message: `${created.truckId} • ${
          created.actualDriver || created.driver
        } • ${created.date}`,
        color: 'green',
      });
    } catch (error) {
      const totalExpenses =
        payload.fuelCost +
        payload.maintenance +
        payload.tollFees +
        payload.miscExpenses;

      const customerName = customers.find(
        (customer) => customer.id === (payload.customerId ?? null)
      )?.name;

      const fallbackTrip: TripRecord = {
        ...payload,
        totalExpenses,
        id: existingId || `trip-${Date.now()}`,
        status: 'draft',
        completedAt: null,
        customerId: payload.customerId ?? null,
        customerName: customerName ?? null,
        invoiceId: null,
        actualDriver: payload.actualDriver ?? payload.driver,
        actualHelper: payload.actualHelper ?? payload.helper,
        crewOverrideReason: payload.crewOverrideReason ?? null,
        attendanceStatus: payload.attendanceStatus ?? 'UNCONFIRMED',
      };

      setTrips((prev) => {
        if (!existingId) {
          return [normalizeTripRecord(fallbackTrip), ...prev];
        }
        return prev.map((trip) =>
          trip.id === existingId ? normalizeTripRecord(fallbackTrip) : trip
        );
      });

      showNotification({
        title: existingId ? 'Update saved locally' : 'Saved offline',
        message:
          error instanceof Error
            ? error.message
            : 'Trip stored locally; will not persist to server',
        color: 'orange',
      });
    } finally {
      closeLogTrip();
    }
  };

  const confirmDeleteTrip = async (trip: TripRecord) => {
    if (typeof window === 'undefined') {
      return true;
    }

    const firstStep = await showCustomAlert({
      title: 'Delete this trip?',
      text: `${trip.truckId} • ${trip.driver || '—'} • ${trip.date}`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Continue',
      cancelButtonText: 'Cancel',
      focusCancel: true,
      confirmButtonColor: '#e03131',
    });

    if (!firstStep.isConfirmed) {
      return false;
    }

    const secondStep = await showCustomAlert({
      title: 'Confirm permanent delete',
      text: 'This cannot be undone.',
      icon: 'error',
      showCancelButton: true,
      confirmButtonText: 'Delete trip',
      cancelButtonText: 'Go back',
      confirmButtonColor: '#c92a2a',
      cancelButtonColor: '#6b7280',
      focusCancel: true,
    });

    return secondStep.isConfirmed;
  };

  const handleDeleteTrip = async (trip: TripRecord) => {
    const confirmed = await confirmDeleteTrip(trip);
    if (!confirmed) {
      return;
    }

    setTrips((prev) => prev.filter((item) => item.id !== trip.id));

    try {
      await fetch(`/api/trucking/trips/${trip.id}`, { method: 'DELETE' });
      showNotification({
        title: 'Trip deleted',
        message: `${trip.truckId} • ${trip.date}`,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Deletion failed',
        message:
          error instanceof Error
            ? error.message
            : 'Trip removed locally; not synced to server',
        color: 'orange',
      });
    }
  };

  const handleFinalizeTrip = async (trip: TripRecord) => {
    try {
      const response = await fetch(`/api/trucking/trips/${trip.id}/finalize`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to finalize trip');
      }

      const updated = normalizeTripRecord(
        ((await response.json()) as TripRecord) || trip
      );

      setTrips((prev) =>
        prev.map((item) => (item.id === trip.id ? updated : item))
      );

      showNotification({
        title: 'Trip finalized',
        message: `${trip.truckId} • expenses posted`,
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'Finalize failed',
        message:
          error instanceof Error
            ? error.message
            : 'Trip not finalized; no expenses posted',
        color: 'red',
      });
    }
  };

  return {
    trips,
    filteredTrips,
    stats,
    summary: {
      ...summary,
    },
    filters: {
      ...filters,
      isImporting,
    },
    collections,
    actions: {
      handleImportTrips,
      handleExportTrips,
      handleLogTrip: openLogTrip,
      handleCreateOrUpdateTrip,
      handleEditTrip: openEditTrip,
      handleDeleteTrip,
      handleFinalizeTrip,
      closeLogTrip,
    },
    modals: {
      logTrip: {
        opened: isLogTripOpen,
        onClose: closeLogTrip,
        onSubmit: handleCreateOrUpdateTrip,
        initialTrip: editingTrip,
        getExpectedCrew: findExpectedCrew,
      },
    },
    formatCurrency,
  };
}
