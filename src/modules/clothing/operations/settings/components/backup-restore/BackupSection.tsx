'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { IconDatabase, IconHistory } from '@tabler/icons-react';
import type { Backup, BackupStrategy } from '../../backup/types';
import { formatBackupTimestamp, formatRelativeTime } from '../../backup/types';
import { BackupListCard } from './BackupListCard';

type StrategyScheduleEntry = {
  key: BackupStrategy;
  meta: {
    label: string;
    color: string;
    cadence: string;
  };
  last: Date | null;
  next: Date | null;
};

interface BackupSectionProps {
  backups: Backup[];
  loading: boolean;
  creating: boolean;
  backupStrategy: BackupStrategy;
  strategyOptions: Array<{ value: string; label: string }>;
  backupFormat: string;
  isLogStrategy: boolean;
  includeSoftDeleted: boolean;
  strategySchedule: StrategyScheduleEntry[];
  onBackupStrategyChange: (value: BackupStrategy) => void;
  onBackupFormatChange: (value: string) => void;
  onIncludeSoftDeletedChange: (checked: boolean) => void;
  onCreateBackup: () => void;
  onRefresh: () => void;
  onPreview: (backup: Backup) => void;
  onDelete: (backup: Backup) => void;
}

export function BackupSection({
  backups,
  loading,
  creating,
  backupStrategy,
  strategyOptions,
  backupFormat,
  isLogStrategy,
  includeSoftDeleted,
  strategySchedule,
  onBackupStrategyChange,
  onBackupFormatChange,
  onIncludeSoftDeletedChange,
  onCreateBackup,
  onRefresh,
  onPreview,
  onDelete,
}: BackupSectionProps) {
  return (
    <Stack gap="lg">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3}>Create Backup</Title>
            <Text size="sm" c="dimmed">
              Use this page for one-off snapshots. Full backups with a
              PostgreSQL dump are the restore-ready option.
            </Text>
          </div>
          <Badge color="blue">Manual</Badge>
        </Group>

        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Select
              label="Backup strategy"
              data={strategyOptions}
              value={backupStrategy}
              onChange={(value) =>
                onBackupStrategyChange((value as BackupStrategy) ?? 'full')
              }
              description="Full baseline, differential snapshot, or log capture"
            />
            <Select
              label="Format"
              data={[
                { value: 'json', label: 'JSON only' },
                { value: 'csv', label: 'CSV only' },
                { value: 'xlsx', label: 'XLSX only' },
                {
                  value: 'dump',
                  label: 'PostgreSQL dump only (restore-ready)',
                },
                {
                  value: 'all',
                  label: 'JSON + CSV + XLSX + PostgreSQL dump',
                },
              ]}
              value={isLogStrategy ? 'json' : backupFormat}
              onChange={(value) =>
                !isLogStrategy && onBackupFormatChange(value || 'all')
              }
              disabled={isLogStrategy}
              description="Keep the PostgreSQL dump if you may need restore later"
            />
          </SimpleGrid>

          {isLogStrategy ? (
            <Alert icon={<IconHistory size={16} />} color="blue">
              <Text size="sm">
                Log backups always export JSON change events.
              </Text>
            </Alert>
          ) : null}

          <Switch
            label="Include deleted records"
            checked={includeSoftDeleted}
            onChange={(event) =>
              onIncludeSoftDeletedChange(event.currentTarget.checked)
            }
          />

          <Button
            leftSection={<IconDatabase size={16} />}
            onClick={onCreateBackup}
            loading={creating}
            fullWidth
          >
            {creating ? 'Creating...' : 'Create Backup Now'}
          </Button>

          <Text size="xs" c="dimmed">
            Tip: if you want the safest restore path, choose a full backup and
            keep the PostgreSQL dump in the output.
          </Text>
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md" align="flex-start">
          <div>
            <Title order={3}>Backup Plan</Title>
            <Text size="sm" c="dimmed">
              The system uses a simple rhythm: full baseline, lighter change
              captures, and server-managed automation.
            </Text>
          </div>
          <Badge color="teal">Overview</Badge>
        </Group>

        <Stack gap="sm">
          {strategySchedule.map(({ key, meta, last, next }) => (
            <Card key={key} withBorder padding="sm" radius="md">
              <Group
                justify="space-between"
                align="center"
                gap="md"
                wrap="wrap"
              >
                <Group gap="sm" align="center">
                  <Badge color={meta.color}>{meta.label}</Badge>
                  <Text size="sm" c="dimmed">
                    {meta.cadence}
                  </Text>
                </Group>
                <Stack gap={0} align="flex-end">
                  <Text size="sm">
                    {last ? `Last: ${formatRelativeTime(last)}` : 'Last: Never'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {key === 'log'
                      ? 'Next: Continuous stream'
                      : next
                        ? `Next: ${formatBackupTimestamp(next.toISOString())}`
                        : 'Next: Ready now'}
                  </Text>
                </Stack>
              </Group>
            </Card>
          ))}

          <Alert color="teal">
            Automatic disaster-recovery backups now run from the server-side
            scheduler. Use this page for manual runs and review, and configure
            `BACKUP_AUTO_ENABLED`, `BACKUP_AUTO_TIME`, `BACKUP_AUTO_TIMEZONE`,
            and `BACKUP_RETENTION_DAYS` in your Docker environment.
          </Alert>
        </Stack>
      </Card>

      <Divider />

      <BackupListCard
        backups={backups}
        loading={loading}
        onRefresh={onRefresh}
        onPreview={onPreview}
        onDelete={onDelete}
        title={`Recent Backups (${backups.length})`}
        subtitle="Open a backup to inspect it, download artifacts, compare changes, or restore it."
      />
    </Stack>
  );
}
