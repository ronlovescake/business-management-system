'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconDatabase,
  IconLifebuoy,
  IconRefresh,
} from '@tabler/icons-react';
import type { PitrStatus } from '../../backup/types';
import {
  formatBackupTimestamp,
  formatFileSize,
  formatRelativeTime,
  parseTimestamp,
} from '../../backup/types';

interface PitrStatusCardProps {
  status: PitrStatus | null;
  loading: boolean;
  creating: boolean;
  onRefresh: () => void;
  onCreateBaseBackup: () => void;
}

export function PitrStatusCard({
  status,
  loading,
  creating,
  onRefresh,
  onCreateBaseBackup,
}: PitrStatusCardProps) {
  const archiveModeActive =
    status?.runtime.archiveMode === 'on' ||
    status?.runtime.archiveMode === 'always';
  const walLevelActive =
    status?.runtime.walLevel === 'replica' ||
    status?.runtime.walLevel === 'logical';
  const pitrHealthy =
    Boolean(status?.enabled) &&
    Boolean(status?.runtime.databaseConnected) &&
    archiveModeActive &&
    walLevelActive;

  const latestBaseDate = parseTimestamp(status?.latestBaseBackup?.createdAt);
  const latestWalDate = parseTimestamp(status?.runtime.lastArchivedAt);
  const latestBaseSchedule = status?.latestBaseBackup?.scheduler;

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" align="flex-start" mb="md">
        <div>
          <Title order={3}>True PITR / WAL</Title>
          <Text size="sm" c="dimmed">
            Physical base backups plus PostgreSQL WAL archiving for
            point-in-time recovery.
          </Text>
        </div>
        <Group gap="xs">
          <Badge color={pitrHealthy ? 'teal' : 'orange'}>
            {pitrHealthy ? 'Ready' : 'Needs attention'}
          </Badge>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconRefresh size={14} />}
            onClick={onRefresh}
            loading={loading}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      {loading && !status ? <Progress value={100} animated mb="md" /> : null}

      {!status ? (
        <Alert color="gray">PITR status is not available yet.</Alert>
      ) : (
        <Stack gap="md">
          {!status.enabled ? (
            <Alert icon={<IconAlertTriangle size={16} />} color="orange">
              PITR is disabled in the Docker environment. Enable
              <Code>PITR_ENABLED=true</Code> and restart the database service.
            </Alert>
          ) : null}

          {status.enabled && !status.runtime.databaseConnected ? (
            <Alert icon={<IconAlertTriangle size={16} />} color="orange">
              {status.runtime.error ||
                'The app could not read PostgreSQL archiver status.'}
            </Alert>
          ) : null}

          {status.enabled && status.runtime.databaseConnected && !pitrHealthy ? (
            <Alert icon={<IconAlertTriangle size={16} />} color="orange">
              PostgreSQL is reachable, but PITR settings are not fully active
              yet. Confirm <Code>archive_mode=on</Code> and
              <Code>wal_level=replica</Code> after the Docker database restart.
            </Alert>
          ) : null}

          <Alert color={status.schedule.enabled ? 'teal' : 'gray'}>
            <Text size="sm" fw={600} mb={4}>
              Base backup automation
            </Text>
            <Text size="xs">
              {status.schedule.enabled
                ? `Scheduled daily at ${status.schedule.time || '01:00'} ${status.schedule.timeZone || 'Asia/Manila'}. Startup catch-up runs if a scheduled day was missed while the app was down.`
                : 'Manual only right now. Enable PITR_BASE_AUTO_ENABLED to let the scheduler create daily base backups automatically.'}
            </Text>
          </Alert>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Card withBorder padding="sm" radius="md">
              <Stack gap={4}>
                <Group gap="xs">
                  <IconDatabase size={16} />
                  <Text fw={600}>Latest base backup</Text>
                </Group>
                <Text size="sm">
                  {status.latestBaseBackup
                    ? formatBackupTimestamp(status.latestBaseBackup.createdAt)
                    : 'None yet'}
                </Text>
                <Text size="xs" c="dimmed">
                  {status.latestBaseBackup
                    ? `${formatRelativeTime(latestBaseDate)} • ${formatFileSize(status.latestBaseBackup.totalSize)}`
                    : 'Create one after PITR shows ready.'}
                </Text>
                {status.latestBaseBackup ? (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">
                      Folder: {status.latestBaseBackup.folder}
                    </Text>
                    {latestBaseSchedule ? (
                      <Group gap="xs">
                        <Badge
                          size="xs"
                          color={
                            latestBaseSchedule.trigger === 'scheduled'
                              ? latestBaseSchedule.catchUp
                                ? 'orange'
                                : 'teal'
                              : 'gray'
                          }
                          variant="light"
                        >
                          {latestBaseSchedule.trigger === 'scheduled'
                            ? latestBaseSchedule.catchUp
                              ? 'Recovery run'
                              : 'Scheduled'
                            : 'Manual'}
                        </Badge>
                        {latestBaseSchedule.missedDateKeys?.length ? (
                          <Text size="xs" c="dimmed">
                            Recovered: {latestBaseSchedule.missedDateKeys.join(', ')}
                          </Text>
                        ) : null}
                      </Group>
                    ) : null}
                  </Stack>
                ) : null}
              </Stack>
            </Card>

            <Card withBorder padding="sm" radius="md">
              <Stack gap={4}>
                <Group gap="xs">
                  <IconLifebuoy size={16} />
                  <Text fw={600}>Latest archived WAL</Text>
                </Group>
                <Text size="sm">
                  {status.latestArchivedWalFile || 'No WAL archived yet'}
                </Text>
                <Text size="xs" c="dimmed">
                  {latestWalDate
                    ? `${formatRelativeTime(latestWalDate)} • ${formatBackupTimestamp(latestWalDate.toISOString())}`
                    : 'Archive activity will appear after write traffic.'}
                </Text>
                <Text size="xs" c="dimmed">
                  {status.walArchiveFileCount} archived WAL file
                  {status.walArchiveFileCount === 1 ? '' : 's'} •{' '}
                  {formatFileSize(status.walArchiveTotalSize)}
                </Text>
              </Stack>
            </Card>
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, md: 4 }} spacing="md">
            <Card withBorder padding="sm" radius="md">
              <Text size="xs" c="dimmed">
                Archive mode
              </Text>
              <Text size="sm" fw={600}>
                {status.runtime.archiveMode || 'Unknown'}
              </Text>
            </Card>
            <Card withBorder padding="sm" radius="md">
              <Text size="xs" c="dimmed">
                WAL level
              </Text>
              <Text size="sm" fw={600}>
                {status.runtime.walLevel || 'Unknown'}
              </Text>
            </Card>
            <Card withBorder padding="sm" radius="md">
              <Text size="xs" c="dimmed">
                Archived count
              </Text>
              <Text size="sm" fw={600}>
                {status.runtime.archivedCount}
              </Text>
            </Card>
            <Card withBorder padding="sm" radius="md">
              <Text size="xs" c="dimmed">
                Failed archives
              </Text>
              <Text size="sm" fw={600} c={status.runtime.failedCount > 0 ? 'red' : undefined}>
                {status.runtime.failedCount}
              </Text>
            </Card>
          </SimpleGrid>

          <Group justify="space-between" align="flex-start">
            <Stack gap={2}>
              <Text size="sm" fw={600}>
                Recovery window
              </Text>
              <Text size="xs" c="dimmed">
                Start: {status.recoveryWindow.start ? formatBackupTimestamp(status.recoveryWindow.start) : 'No base backup yet'}
              </Text>
              <Text size="xs" c="dimmed">
                End: {status.recoveryWindow.end ? formatBackupTimestamp(status.recoveryWindow.end) : 'No archived WAL yet'}
              </Text>
            </Stack>
            <Button
              leftSection={<IconDatabase size={16} />}
              onClick={onCreateBaseBackup}
              loading={creating}
              disabled={!status.enabled || !status.runtime.databaseConnected}
            >
              {creating ? 'Creating...' : 'Create Base Backup'}
            </Button>
          </Group>

          {status.restoreCommandPreview ? (
            <Alert color="blue">
              <Text size="xs" fw={600} mb={4}>
                Restore command preview
              </Text>
              <Code block>{status.restoreCommandPreview}</Code>
            </Alert>
          ) : null}
        </Stack>
      )}
    </Card>
  );
}