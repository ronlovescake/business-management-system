'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown, IconChevronRight, IconDatabase, IconHistory } from '@tabler/icons-react';
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
    <Stack gap="md">
      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Group justify="space-between" mb="sm">
          <div>
            <Title order={4}>Create Backup</Title>
            <Text size="xs" c="dimmed">
              One-off snapshots. Use a full backup with PostgreSQL dump for the
              safest restore path.
            </Text>
          </div>
          <Badge color="blue" size="sm">Manual</Badge>
        </Group>

        <Stack gap="sm">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
            <Select
              size="sm"
              label="Backup strategy"
              data={strategyOptions}
              value={backupStrategy}
              onChange={(value) =>
                onBackupStrategyChange((value as BackupStrategy) ?? 'full')
              }
            />
            <Select
              size="sm"
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
            />
          </SimpleGrid>

          {isLogStrategy ? (
            <Alert icon={<IconHistory size={16} />} color="blue" py="xs">
              <Text size="sm">
                Log backups always export JSON change events.
              </Text>
            </Alert>
          ) : null}

          <Group justify="space-between">
            <Switch
              size="sm"
              label="Include deleted records"
              checked={includeSoftDeleted}
              onChange={(event) =>
                onIncludeSoftDeletedChange(event.currentTarget.checked)
              }
            />
            <Button
              size="sm"
              leftSection={<IconDatabase size={16} />}
              onClick={onCreateBackup}
              loading={creating}
            >
              {creating ? 'Creating...' : 'Create Backup Now'}
            </Button>
          </Group>
        </Stack>
      </Card>

      <BackupPlanSection strategySchedule={strategySchedule} getPlanCadenceLabel={getPlanCadenceLabel} getPlanNextLabel={getPlanNextLabel} getLastRunStatus={getLastRunStatus} />

      <BackupListCard
        backups={backups}
        loading={loading}
        onRefresh={onRefresh}
        onPreview={onPreview}
        onDelete={onDelete}
        title={`Recent Backups (${backups.length})`}
        subtitle="Inspect, download, compare, or restore a backup."
      />
    </Stack>
  );
}

function BackupPlanSection({
  strategySchedule,
  getPlanCadenceLabel,
  getPlanNextLabel,
  getLastRunStatus,
}: {
  strategySchedule: StrategyScheduleEntry[];
  getPlanCadenceLabel: (key: BackupStrategy) => string;
  getPlanNextLabel: (key: BackupStrategy, next: Date | null) => string;
  getLastRunStatus: (backup: Backup | null) => {
    tone: 'gray' | 'orange' | 'teal';
    label: string;
    detail: string | null;
    recoveredDateKeys: string | null;
  } | null;
}) {
  const [opened, { toggle }] = useDisclosure(false);

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder>
      <UnstyledButton onClick={toggle} w="100%">
        <Group justify="space-between">
          <Group gap="sm">
            {opened ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            <Title order={4}>Backup Plan</Title>
            <Badge color="teal" size="sm">Schedule</Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {strategySchedule.filter((s) => s.last).length} of {strategySchedule.length} strategies have run
          </Text>
        </Group>
      </UnstyledButton>

      <Collapse in={opened}>
        <Stack gap="sm" mt="sm">
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="sm">
            {strategySchedule.map(({ key, meta, lastBackup, last, next }) => {
              const lastRunStatus = getLastRunStatus(lastBackup);

              return (
                <Card key={key} withBorder padding="sm" radius="md" h="100%">
                  <Stack gap="xs" h="100%" justify="space-between">
                    <Group gap="sm" align="center" wrap="nowrap">
                      <Badge color={meta.color} size="sm">{meta.label}</Badge>
                      <Text size="xs" c="dimmed">
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
                        <Group gap="xs">
                          <Badge color={lastRunStatus.tone} variant="light" size="xs">
                            {lastRunStatus.label}
                          </Badge>
                          {lastRunStatus.detail ? (
                            <Text size="xs" c="dimmed">
                              {lastRunStatus.detail}
                            </Text>
                          ) : null}
                        </Group>
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

          <Text size="xs" c="dimmed">
            Configure scheduling via BACKUP_AUTO_ENABLED, BACKUP_AUTO_TIME,
            BACKUP_DIFF_AUTO_ENABLED, and BACKUP_RETENTION_DAYS in your Docker
            environment.
          </Text>
        </Stack>
      </Collapse>
    </Card>
  );
}
