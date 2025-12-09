'use client';

import { useParams } from 'next/navigation';
import { VehicleDetailsPage as FleetVehicleDetailsPage } from '@/modules/trucking/operations/fleet-registry/components/VehicleDetailsPage';

export default function FleetRegistryVehicleDetailsRoute() {
  const params = useParams();
  const rawId = params?.id;
  const vehicleId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!vehicleId) {
    throw new Error('Vehicle id is required to view details.');
  }

  return <FleetVehicleDetailsPage vehicleId={vehicleId} />;
}
