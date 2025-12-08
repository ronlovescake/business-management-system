import { useState } from 'react';
import {
  Avatar,
  Badge,
  Box,
  Center,
  FileButton,
  Group,
  Loader,
  Overlay,
  Paper,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconCamera } from '@tabler/icons-react';
import type { Employee } from '../types';

interface TruckingEmployeeProfileSummaryCardProps {
  employee: Employee;
  onAvatarChange: (file: File | null) => Promise<void> | void;
  isPhotoUploading: boolean;
  getStatusColor: (status: Employee['status']) => string;
}

export function TruckingEmployeeProfileSummaryCard({
  employee,
  onAvatarChange,
  isPhotoUploading,
  getStatusColor,
}: TruckingEmployeeProfileSummaryCardProps) {
  const [isAvatarHovered, setIsAvatarHovered] = useState(false);

  return (
    <Paper withBorder p="xl">
      <Group align="center" gap="lg" justify="space-between">
        <Group align="center" gap="lg">
          <Box
            pos="relative"
            onMouseEnter={() => setIsAvatarHovered(true)}
            onMouseLeave={() => setIsAvatarHovered(false)}
            style={{ borderRadius: 'var(--mantine-radius-md)' }}
          >
            <FileButton
              onChange={onAvatarChange}
              accept="image/png,image/jpeg,image/webp"
            >
              {(fileButtonProps) => (
                <Tooltip label="Upload profile photo" position="right">
                  <UnstyledButton
                    {...fileButtonProps}
                    style={{ display: 'block', borderRadius: 'inherit' }}
                  >
                    <Avatar
                      size={100}
                      radius="md"
                      color="blue"
                      style={{ fontSize: '2.5rem' }}
                      src={employee.profilePhoto || undefined}
                    >
                      {employee.firstName?.[0]?.toUpperCase() ||
                        employee.name?.split(' ')[0]?.[0]?.toUpperCase() ||
                        ''}
                      {employee.lastName?.[0]?.toUpperCase() ||
                        employee.name?.split(' ')[1]?.[0]?.toUpperCase() ||
                        ''}
                    </Avatar>
                  </UnstyledButton>
                </Tooltip>
              )}
            </FileButton>

            {(isAvatarHovered || isPhotoUploading) && (
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

          <div>
            <Title order={2}>
              {employee.firstName && employee.lastName
                ? `${employee.firstName} ${employee.middleName ? employee.middleName + ' ' : ''}${employee.lastName}`
                : employee.name}
            </Title>
            <Text size="lg" c="dimmed" mt={4}>
              {employee.position || employee.jobTitle}
            </Text>
            <Text size="sm" c="dimmed">
              {employee.department} • {employee.employeeId}
            </Text>
          </div>
        </Group>
        <Badge
          size="lg"
          color={getStatusColor(employee.status)}
          variant="light"
        >
          {employee.status === 'on-leave'
            ? 'ON LEAVE'
            : employee.status.toUpperCase()}
        </Badge>
      </Group>
    </Paper>
  );
}
