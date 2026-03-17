'use client';

import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { IconClock, IconDatabase, IconHistory } from '@tabler/icons-react';
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
  autoBackupEnabled: boolean;
  autoBackupInterval: number;
  strategySchedule: StrategyScheduleEntry[];
  onBackupStrategyChange: (value: BackupStrategy) => void;
  onBackupFormatChange: (value: string) => void;
  onIncludeSoftDeletedChange: (checked: boolean) => void;
  onAutoBackupEnabledChange: (checked: boolean) => void;
  onAutoBackupIntervalChange: (value: number) => void;
  onCreateBackup: () => void;
  onRunStrategyBackup: (strategy: BackupStrategy) => void;
  onRefresh: () => void;
  onPreview: (backup: Backup) => void;
  onDownloadJSON: (backup: Backup) => void;
  onDownloadSQL: (backup: Backup) => void;
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
  autoBackupEnabled,
  autoBackupInterval,
  strategySchedule,
  onBackupStrategyChange,
  onBackupFormatChange,
  onIncludeSoftDeletedChange,
  onAutoBackupEnabledChange,
  onAutoBackupIntervalChange,
  onCreateBackup,
  onRunStrategyBackup,
  onRefresh,
  onPreview,
  onDownloadJSON,
  onDownloadSQL,
  onDelete,
}: BackupSectionProps) {
  return (
    <Stack gap="lg">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Create Backup</Title>
          <Badge color="blue">Manual</Badge>
        </Group>

        <Stack gap="md">
          <Select
            label="Backup strategy"
            data={strategyOptions}
            value={backupStrategy}
            onChange={(value) =>
              onBackupStrategyChange((value as BackupStrategy) ?? 'full')
            }
            description="Full weekly baseline, daily differential, or log stream"
          />
          <Select
            label="Format"
            data={[
              { value: 'json', label: 'JSON only' },
              { value: 'csv', label: 'CSV only' },
              { value: 'xlsx', label: 'XLSX only' },
              { value: 'sql', label: 'SQL dump only' },
              {
                value: 'all',
                label: 'JSON + CSV + XLSX + SQL (recommended)',
              },
            ]}
            value={isLogStrategy ? 'json' : backupFormat}
            onChange={(value) =>
              !isLogStrategy && onBackupFormatChange(value || 'all')
            }
            disabled={isLogStrategy}
          />
          {isLogStrategy ? (
            <Alert icon={<IconHistory size={16} />} color="blue">
              <Text size="sm">
                Log captures always export JSON change events so you can replay
                them during restore.
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
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md" align="flex-start">
          <div>
            <Title order={3}>Strategy Schedule</Title>
            <Text size="sm" c="dimmed">
              Weekly full baseline, daily differential snapshots, and continuous
              log capture.
            </Text>
          </div>
          <Badge color="teal">Planner</Badge>
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
                <Group gap="lg" align="center" wrap="wrap">
                  <div>
                    <Text size="xs" fw={600} c="dimmed">
                      Last run
                    </Text>
                    <Text size="sm">
                      {last
                        ? `${formatBackupTimestamp(last.toISOString())} (${formatRelativeTime(last)})`
                        : 'Never'}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" fw={600} c="dimmed">
                      Next due
                    </Text>
                    <Text size="sm">
                      {key === 'log'
                        ? 'Streaming'
                        : next
                          ? formatBackupTimestamp(next.toISOString())
                          : 'Ready now'}
                    </Text>
                  </div>
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconHistory size={14} />}
                    onClick={() => onRunStrategyBackup(key)}
                    loading={creating}
                  >
                    Run {meta.label}
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      </Card>

      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group justify="space-between" mb="md">
          <Title order={3}>Auto-Backup</Title>
          <Badge color={autoBackupEnabled ? 'green' : 'gray'}>
            {autoBackupEnabled ? 'ON' : 'OFF'}
          </Badge>
        </Group>

        <Stack gap="md">
          <Switch
            label="Enable automatic backups"
            checked={autoBackupEnabled}
            onChange={(event) =>
              onAutoBackupEnabledChange(event.currentTarget.checked)
            }
          />

          {autoBackupEnabled ? (
            <>
              <NumberInput
                label="Interval (minutes)"
                value={autoBackupInterval}
                onChange={(value) =>
                  onAutoBackupIntervalChange(Number(value) || 30)
                }
                min={5}
                max={1440}
              />

              <Alert icon={<IconClock size={16} />} color="green">
                Backups every {autoBackupInterval} minutes while page is open
              </Alert>
            </>
          ) : null}
        </Stack>
      </Card>

      <Divider />

      <BackupListCard
        backups={backups}
        loading={loading}
        onRefresh={onRefresh}
        onPreview={onPreview}
        onDownloadJSON={onDownloadJSON}
        onDownloadSQL={onDownloadSQL}
        onDelete={onDelete}
      />
    </Stack>
  );
}
