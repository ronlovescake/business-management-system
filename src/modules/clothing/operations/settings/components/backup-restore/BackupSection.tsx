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
  lastBackup: Backup | null;
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
  const getPlanCadenceLabel = (key: BackupStrategy) => {
    if (key === 'full') {
      return 'Scheduled weekly full dump + manual';
    }

    if (key === 'differential') {
      return 'Scheduled daily differential snapshot + manual';
    }

    return 'Manual JSON change capture';
  };

  const getPlanNextLabel = (
    key: BackupStrategy,
    next: Date | null
  ) => {
    if (key === 'full') {
      return next
        ? `Next: ${formatBackupTimestamp(next.toISOString())}`
        : 'Next: At the configured scheduler time';
    }

    if (key === 'differential') {
      return next
        ? `Next: ${formatBackupTimestamp(next.toISOString())}`
        : 'Next: At the configured scheduler time';
    }

    return 'Next: Manual only';
  };

  const getLastRunStatus = (backup: Backup | null) => {
    const scheduler = backup?.manifest?.scheduler;
    if (!scheduler) {
      return null;
    }

    if (scheduler.trigger === 'manual') {
      return {
        tone: 'gray' as const,
        label: 'Manual',
        detail: null,
        recoveredDateKeys: null,
      };
    }

    if (scheduler.catchUp) {
      const missedDays = scheduler.missedDateKeys?.length ?? 0;
      return {
        tone: 'orange' as const,
        label: 'Recovery run',
        detail:
          missedDays > 0
            ? `Recovered after ${missedDays} missed scheduled day${missedDays === 1 ? '' : 's'}`
            : 'Recovered after downtime',
        recoveredDateKeys: scheduler.missedDateKeys?.join(', ') ?? null,
      };
    }

    return {
      tone: 'teal' as const,
      label: 'Scheduled',
      detail: 'Completed on the normal scheduler window',
      recoveredDateKeys: null,
    };
  };

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
              Full dumps and differential snapshots can both run from the
              server-side scheduler. Log strategy remains manual-only.
            </Text>
          </div>
          <Badge color="teal">Overview</Badge>
        </Group>

        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
            {strategySchedule.map(({ key, meta, lastBackup, last, next }) => {
              const lastRunStatus = getLastRunStatus(lastBackup);

              return (
              <Card key={key} withBorder padding="sm" radius="md" h="100%">
                <Stack gap="sm" h="100%" justify="space-between">
                  <Group gap="sm" align="center" wrap="nowrap">
                    <Badge color={meta.color}>{meta.label}</Badge>
                    <Text size="sm" c="dimmed">
                      {getPlanCadenceLabel(key)}
                    </Text>
                  </Group>
                  <Stack gap={2}>
                    <Text size="sm">
                      {last
                        ? `Last: ${formatRelativeTime(last)}`
                        : 'Last: Never'}
                    </Text>
                    {lastRunStatus ? (
                      <Stack gap={2}>
                        <Group gap="xs">
                        <Badge color={lastRunStatus.tone} variant="light">
                          {lastRunStatus.label}
                        </Badge>
                        {lastRunStatus.detail ? (
                          <Text size="xs" c="dimmed">
                            {lastRunStatus.detail}
                          </Text>
                        ) : null}
                        </Group>
                        {lastRunStatus.recoveredDateKeys ? (
                          <Text size="xs" c="dimmed">
                            Recovered dates: {lastRunStatus.recoveredDateKeys}
                          </Text>
                        ) : null}
                      </Stack>
                    ) : null}
                    <Text size="xs" c="dimmed">
                      {getPlanNextLabel(key, next)}
                    </Text>
                  </Stack>
                </Stack>
              </Card>
              );
            })}
          </SimpleGrid>

          <Alert color="teal">
            Scheduled automation supports full dumps and differential snapshots,
            with one startup catch-up run after downtime when a scheduled day
            was missed. Configure `BACKUP_AUTO_ENABLED`, `BACKUP_AUTO_TIME`,
            `BACKUP_DIFF_AUTO_ENABLED`, `BACKUP_DIFF_AUTO_TIME`,
            `BACKUP_AUTO_TIMEZONE`, and `BACKUP_RETENTION_DAYS` in your Docker
            environment.
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
