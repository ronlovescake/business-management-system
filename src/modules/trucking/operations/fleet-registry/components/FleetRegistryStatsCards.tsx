import { memo, useMemo } from 'react';
import {
  IconTruck,
  IconTools,
  IconCertificate,
  IconArchive,
} from '@tabler/icons-react';
import { StatsCardGrid, type StatCard } from '@/components/ui';

interface FleetRegistryStatsCardsProps {
  activeUnits: number;
  inMaintenance: number;
  registeredThisYear: number;
  retiredUnits: number;
}

export const FleetRegistryStatsCards = memo(function FleetRegistryStatsCards({
  activeUnits,
  inMaintenance,
  registeredThisYear,
  retiredUnits,
}: FleetRegistryStatsCardsProps) {
  const cards: StatCard[] = useMemo(
    () => [
      {
        title: 'Active Units',
        value: activeUnits.toString(),
        icon: <IconTruck size={24} stroke={1.6} />,
        color: 'green',
        backgroundColor:
          'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(16,185,129,0.95))',
      },
      {
        title: 'In Maintenance',
        value: inMaintenance.toString(),
        icon: <IconTools size={24} stroke={1.6} />,
        color: 'yellow',
        backgroundColor:
          'linear-gradient(135deg, rgba(234,179,8,0.95), rgba(250,204,21,0.95))',
      },
      {
        title: 'Registered This Year',
        value: registeredThisYear.toString(),
        icon: <IconCertificate size={24} stroke={1.6} />,
        color: 'blue',
        backgroundColor:
          'linear-gradient(135deg, rgba(37,99,235,0.95), rgba(59,130,246,0.95))',
      },
      {
        title: 'Retired Units',
        value: retiredUnits.toString(),
        icon: <IconArchive size={24} stroke={1.6} />,
        color: 'red',
        backgroundColor:
          'linear-gradient(135deg, rgba(239,68,68,0.95), rgba(248,113,113,0.95))',
      },
    ],
    [activeUnits, inMaintenance, registeredThisYear, retiredUnits]
  );

  return (
    <StatsCardGrid
      cards={cards}
      variant="vibrant"
      minCardWidth={240}
      spacing="md"
    />
  );
});
