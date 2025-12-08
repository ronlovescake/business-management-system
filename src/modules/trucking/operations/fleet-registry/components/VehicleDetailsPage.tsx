'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Avatar,
  Badge,
  Box,
  Button,
  Center,
  FileButton,
  Group,
  Loader,
  Overlay,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconCamera,
  IconPencil,
  IconTruck,
} from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import { PageLayout } from '@/components/layout/PageLayout';
import {
  useFleetVehicleDetails,
  type VehicleDetailsSection,
} from '../hooks/useFleetVehicleDetails';
import {
  DetailsHeader,
  DetailsPageTemplate,
  type DetailsTabConfig,
} from '@/modules/shared/details';

interface VehicleDetailsPageProps {
  vehicleId: string;
}

const MAX_VEHICLE_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB

const displayValue = (value: string | number | undefined) =>
  value && String(value).trim().length > 0 ? String(value) : 'N/A';

const convertFileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read file contents.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });

export function VehicleDetailsPage({ vehicleId }: VehicleDetailsPageProps) {
  const router = useRouter();
  const { vehicle, quickStats, sections, statusColor } =
    useFleetVehicleDetails(vehicleId);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [isPhotoHovered, setIsPhotoHovered] = useState(false);

  const handleBack = useCallback(() => {
    router.push('/trucking/operations/fleet-registry');
  }, [router]);

  const handleEdit = useCallback(() => {
    if (!vehicle) {
      return;
    }

    showNotification({
      title: 'Edit vehicle',
      message: `${vehicle.truckId} edit flow coming soon.`,
    });
  }, [vehicle]);

  const handlePhotoChange = useCallback(
    async (file: File | null) => {
      if (!file) {
        return;
      }

      if (file.size > MAX_VEHICLE_PHOTO_SIZE) {
        showNotification({
          color: 'red',
          title: 'File too large',
          message: 'Please select an image that is 2MB or smaller.',
        });
        return;
      }

      setIsPhotoUploading(true);
      try {
        const preview = await convertFileToBase64(file);
        setVehiclePhoto(preview);
        showNotification({
          title: 'Vehicle photo preview updated',
          message: `${vehicle?.truckId ?? 'Fleet unit'} photo stored locally.`,
        });
      } catch (error) {
        showNotification({
          color: 'red',
          title: 'Upload failed',
          message: 'Could not preview the selected vehicle image.',
        });
      } finally {
        setIsPhotoUploading(false);
      }
    },
    [vehicle?.truckId]
  );

  if (!vehicle) {
    return (
      <PageLayout>
        <Paper withBorder p="xl">
          <Stack gap="sm">
            <Title order={3}>Vehicle not found</Title>
            <Text c="dimmed">
              The vehicle you are looking for does not exist or was removed.
            </Text>
            <Button
              leftSection={<IconArrowLeft size={16} />}
              variant="light"
              onClick={handleBack}
              w={{ base: '100%', sm: 'auto' }}
            >
              Back to Fleet Registry
            </Button>
          </Stack>
        </Paper>
      </PageLayout>
    );
  }

  const renderSectionCard = (section?: VehicleDetailsSection) => {
    if (!section) {
      return null;
    }

    return (
      <Paper key={section.id} withBorder p="xl" radius="lg">
        <Stack gap="md">
          <Title order={4}>{section.title}</Title>
          <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
            {section.items.map((item) => (
              <Stack gap={2} key={`${section.id}-${item.label}`}>
                <Text size="sm" c="dimmed">
                  {item.label}
                </Text>
                <Text fw={600}>{displayValue(item.value)}</Text>
              </Stack>
            ))}
          </SimpleGrid>
        </Stack>
      </Paper>
    );
  };

  const registrationSection = sections.find(
    (section) => section.id === 'registration'
  );
  const performanceSection = sections.find(
    (section) => section.id === 'performance'
  );
  const notesSection = sections.find((section) => section.id === 'notes');

  const header = (
    <DetailsHeader
      title="Vehicle Details"
      subtitle="Review fleet asset information"
      backAction={{ label: 'Back to Fleet Registry', onClick: handleBack }}
      primaryAction={{
        label: 'Edit Vehicle',
        onClick: handleEdit,
        icon: <IconPencil size={16} />,
      }}
    />
  );

  const statusLabel =
    vehicle.status.charAt(0).toUpperCase() + vehicle.status.slice(1);

  const heroSection = (
    <Paper withBorder p="xl" radius="md">
      <Stack gap="md">
        <Group align="center" justify="space-between" gap="lg" wrap="wrap">
          <Group align="center" gap="lg">
            <Box
              pos="relative"
              onMouseEnter={() => setIsPhotoHovered(true)}
              onMouseLeave={() => setIsPhotoHovered(false)}
              style={{ borderRadius: 'var(--mantine-radius-md)' }}
            >
              <FileButton
                onChange={handlePhotoChange}
                accept="image/png,image/jpeg,image/webp"
              >
                {(fileButtonProps) => (
                  <Tooltip label="Upload vehicle photo" position="right">
                    <UnstyledButton
                      {...fileButtonProps}
                      style={{ display: 'block', borderRadius: 'inherit' }}
                    >
                      <Avatar
                        size={100}
                        radius="md"
                        color="blue"
                        src={vehiclePhoto || undefined}
                        style={{ fontSize: '2.5rem' }}
                      >
                        {!vehiclePhoto && <IconTruck size={48} />}
                      </Avatar>
                    </UnstyledButton>
                  </Tooltip>
                )}
              </FileButton>

              {(isPhotoHovered || isPhotoUploading) && (
                <Overlay
                  opacity={0.45}
                  color="#000"
                  radius="md"
                  style={{ pointerEvents: 'none' }}
                >
                  <Center style={{ height: '100%' }}>
                    {isPhotoUploading ? (
                      <Loader size="sm" color="white" />
                    ) : (
                      <Group gap={6} align="center">
                        <IconCamera size={18} color="#fff" />
                        <Text size="xs" c="white">
                          Change photo
                        </Text>
                      </Group>
                    )}
                  </Center>
                </Overlay>
              )}
            </Box>

            <Stack gap={4}>
              <Title order={2}>{`${vehicle.maker} ${vehicle.model}`}</Title>
              <Text size="lg" c="dimmed">
                {vehicle.bodyType || 'Fleet asset'}
              </Text>
              <Text size="sm" c="dimmed">
                {vehicle.truckId} • {vehicle.plateNo || 'No plate'}
              </Text>
            </Stack>
          </Group>

          <Badge size="lg" color={statusColor} variant="light">
            {statusLabel}
          </Badge>
        </Group>

        <Group gap="lg" wrap="wrap">
          <Text c="dimmed">Truck ID: {vehicle.truckId}</Text>
          <Text c="dimmed">Plate: {displayValue(vehicle.plateNo)}</Text>
          <Text c="dimmed">Year: {displayValue(vehicle.year)}</Text>
          <Text c="dimmed">Fuel Type: {displayValue(vehicle.fuelType)}</Text>
        </Group>
      </Stack>
    </Paper>
  );

  const overviewContent = (
    <Stack gap="lg">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} spacing="md">
        {quickStats.map((stat) => (
          <Paper key={stat.label} withBorder p="md" radius="md">
            <Text size="sm" c="dimmed">
              {stat.label}
            </Text>
            <Text fw={600}>{displayValue(stat.value)}</Text>
          </Paper>
        ))}
      </SimpleGrid>

      {sections.map((section) => renderSectionCard(section))}
    </Stack>
  );

  const detailsTabs: DetailsTabConfig[] = [
    {
      value: 'overview',
      label: 'Overview',
      content: overviewContent,
    },
  ];

  if (registrationSection) {
    detailsTabs.push({
      value: 'registration',
      label: 'Registration & Classification',
      content: <Stack gap="lg">{renderSectionCard(registrationSection)}</Stack>,
    });
  }

  if (performanceSection) {
    detailsTabs.push({
      value: 'performance',
      label: 'Capacity & Performance',
      content: <Stack gap="lg">{renderSectionCard(performanceSection)}</Stack>,
    });
  }

  if (notesSection) {
    detailsTabs.push({
      value: 'notes',
      label: 'Operational Notes',
      content: <Stack gap="lg">{renderSectionCard(notesSection)}</Stack>,
    });
  }

  return (
    <DetailsPageTemplate
      header={header}
      heroSection={heroSection}
      tabs={detailsTabs}
      defaultTab="overview"
    />
  );
}
