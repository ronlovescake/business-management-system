import type { FleetStatus } from '../types/fleetRegistry.types';

export const statusColors: Record<FleetStatus, string> = {
  active: 'green',
  maintenance: 'yellow',
  inactive: 'gray',
  retired: 'red',
};
