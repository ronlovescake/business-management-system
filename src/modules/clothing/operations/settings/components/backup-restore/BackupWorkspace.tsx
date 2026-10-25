'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  ScrollArea,
  Select,
  Stack,
  Tabs,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconDatabase,
  IconDownload,
  IconGitCompare,
  IconHistory,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconTable,
  IconTrash,
} from '@tabler/icons-react';
import { formatBackupTimestamp, formatFileSize } from '../../backup/types';
import type { Backup } from '../../backup/types';
import { BackupBrowsePanel } from './BackupBrowsePanel';
import styles from './backupWorkspace.module.css';

interface Props {
  backups: Backup[];
  loading: boolean;
  runnerAvailable: boolean;
  nextBackup: Date | null;
  createForm: ReactNode;
  onRefresh: () => void;
  onReview: (backup: Backup, tab: 'changes' | 'restore') => void;
  onDelete: (backup: Backup) => void;
}

export function BackupWorkspace({
  backups,
  loading,
  runnerAvailable,
  nextBackup,
  createForm,
  onRefresh,
  onReview,
  onDelete,
}: Props) {
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window === 'undefined'
      ? null
      : new URLSearchParams(window.location.search).get('backup')
  );
  const [strategy, setStrategy] = useState<string | null>('all');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<string | null>('overview');
  const ordered = [...backups].sort((left, right) =>
    right.timestamp.localeCompare(left.timestamp)
  );
  const filtered = ordered.filter(
    (backup) =>
      (strategy === 'all' || (backup.strategy ?? 'full') === strategy) &&
      `${backup.timestamp} ${formatBackupTimestamp(backup.timestamp)}`
        .toLowerCase()
        .includes(search.toLowerCase())
  );
  const backup =
    filtered.find((entry) => entry.timestamp === selected) ?? filtered[0];
  const lastFull = ordered.find(
    (entry) =>
      (entry.strategy ?? 'full') === 'full' &&
      entry.files.some((file) => file.endsWith('.dump'))
  );
  useEffect(() => {
    if (!backup) {
      return;
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get('backup') !== backup.timestamp) {
      url.searchParams.set('backup', backup.timestamp);
      url.searchParams.delete('backupTable');
      window.history.replaceState(null, '', url);
    }
  }, [backup]);
  const downloadable =
    backup?.files.filter(
      (file) => !file.endsWith('.summary.json') && file !== 'MANIFEST.json'
    ) ?? [];
  const browsable = (entry: Backup) =>
    entry.files.some(
      (file) =>
        file.endsWith('.dump') ||
        file.endsWith('.csv') ||
        /^(full|differential|log)-backup-.+\.json$/.test(file)
    );
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Box>
          <Title order={3}>Backup &amp; Restore</Title>
          <Text size="sm" c="dimmed">
            {backups.length} saved snapshots
          </Text>
        </Box>
        <Group gap="xs">
          <Tooltip label="Refresh backups">
            <ActionIcon
              aria-label="Refresh backups"
              variant="default"
              size="lg"
              loading={loading}
              onClick={onRefresh}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreating(true)}
          >
            Create backup
          </Button>
        </Group>
      </Group>
      <Group
        gap="lg"
        py="sm"
        style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
      >
        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            Last full dump
          </Text>
          <Text size="sm" fw={500}>
            {lastFull ? formatBackupTimestamp(lastFull.timestamp) : 'None'}
          </Text>
        </Stack>
        <Divider orientation="vertical" />
        <Stack gap={2}>
          <Text size="xs" c="dimmed">
            Next scheduled backup
          </Text>
          <Text size="sm" fw={500}>
            {nextBackup
              ? formatBackupTimestamp(nextBackup.toISOString())
              : 'Not scheduled'}
          </Text>
        </Stack>
        <Badge color={runnerAvailable ? 'teal' : 'gray'} variant="dot">
          Restore runner {runnerAvailable ? 'online' : 'offline'}
        </Badge>
      </Group>
      <div className={styles.workspace}>
        <Stack gap="sm" className={styles.archive}>
          <Text fw={600} size="sm">
            Snapshots
          </Text>
          <TextInput
            aria-label="Filter backups by date"
            placeholder="Filter by date"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
          <Select
            aria-label="Filter backup strategy"
            data={[
              { value: 'all', label: 'All strategies' },
              { value: 'full', label: 'Full' },
              { value: 'differential', label: 'Differential' },
              { value: 'log', label: 'Change log' },
            ]}
            value={strategy}
            onChange={setStrategy}
          />
          <ScrollArea h={620}>
            {loading && !backups.length && (
              <Group role="status">
                <Loader size="sm" />
                <Text size="sm">Loading snapshots...</Text>
              </Group>
            )}
            {!loading && !filtered.length && (
              <Text size="sm" c="dimmed" py="md">
                {backups.length
                  ? 'No matching snapshots.'
                  : 'No backups found.'}
              </Text>
            )}
            {filtered.map((entry) => (
              <UnstyledButton
                key={entry.timestamp}
                className={styles.backupItem}
                data-active={entry.timestamp === backup?.timestamp}
                aria-pressed={entry.timestamp === backup?.timestamp}
                onClick={() => setSelected(entry.timestamp)}
              >
                <Stack gap={6}>
                  <Text fw={500} size="sm">
                    {formatBackupTimestamp(entry.timestamp)}
                  </Text>
                  <Group gap={4}>
                    <Badge
                      color={
                        entry.strategy === 'differential'
                          ? 'orange'
                          : entry.strategy === 'log'
                            ? 'gray'
                            : 'teal'
                      }
                      size="xs"
                    >
                      {entry.strategy ?? 'full'}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {formatFileSize(entry.totalSize)}
                    </Text>
                  </Group>
                  <Group gap={4}>
                    <Text size="xs" c="dimmed">
                      {entry.manifest?.scheduler?.trigger === 'scheduled'
                        ? entry.manifest.scheduler.catchUp
                          ? 'Recovery run'
                          : 'Scheduled'
                        : 'Manual'}
                    </Text>
                    {browsable(entry) && (
                      <Badge size="xs" variant="outline" color="blue">
                        Browsable
                      </Badge>
                    )}
                  </Group>
                </Stack>
              </UnstyledButton>
            ))}
          </ScrollArea>
        </Stack>
        <Stack gap="md" className={styles.detail}>
          {backup ? (
            <>
              <Group justify="space-between">
                <Box>
                  <Title order={4}>
                    {formatBackupTimestamp(backup.timestamp)}
                  </Title>
                  <Group gap={6} mt={6}>
                    {['dump', 'json', 'csv', 'xlsx']
                      .filter((extension) =>
                        downloadable.some((file) =>
                          file.endsWith(`.${extension}`)
                        )
                      )
                      .map((extension) => (
                        <Badge
                          key={extension}
                          variant="light"
                          color={extension === 'dump' ? 'teal' : 'gray'}
                        >
                          {extension}
                        </Badge>
                      ))}
                  </Group>
                </Box>
                <Tooltip label="Delete snapshot">
                  <ActionIcon
                    aria-label="Delete snapshot"
                    color="red"
                    variant="subtle"
                    onClick={() => onDelete(backup)}
                  >
                    <IconTrash size={17} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Tabs value={tab} onChange={setTab} keepMounted={false}>
                <Tabs.List>
                  <Tabs.Tab
                    value="overview"
                    leftSection={<IconDatabase size={15} />}
                  >
                    Overview
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="browse"
                    leftSection={<IconTable size={15} />}
                  >
                    Browse Data
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="compare"
                    leftSection={<IconGitCompare size={15} />}
                  >
                    Compare
                  </Tabs.Tab>
                  <Tabs.Tab
                    value="restore"
                    leftSection={<IconHistory size={15} />}
                  >
                    Restore
                  </Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel value="overview" pt="md">
                  <Stack gap="md">
                    <Group gap="xl">
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">
                          Database
                        </Text>
                        <Text size="sm">
                          {backup.manifest?.database ?? 'Not recorded'}
                        </Text>
                      </Stack>
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">
                          Total size
                        </Text>
                        <Text size="sm">
                          {formatFileSize(backup.totalSize)}
                        </Text>
                      </Stack>
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">
                          Records
                        </Text>
                        <Text size="sm">
                          {backup.manifest?.recordCounts
                            ? Object.values(backup.manifest.recordCounts)
                                .reduce((sum, count) => sum + count, 0)
                                .toLocaleString()
                            : 'Not recorded'}
                        </Text>
                      </Stack>
                    </Group>
                    <Divider />
                    <Text size="sm" fw={600}>
                      Files
                    </Text>
                    {downloadable.map((file) => (
                      <Group key={file} justify="space-between" wrap="nowrap">
                        <Text
                          size="sm"
                          style={{ overflowWrap: 'anywhere', minWidth: 0 }}
                        >
                          {file}
                        </Text>
                        <Tooltip label={`Download ${file}`}>
                          <ActionIcon
                            component="a"
                            href={`/api/backup/${encodeURIComponent(backup.timestamp)}/${encodeURIComponent(file)}`}
                            download
                            variant="subtle"
                            aria-label={`Download ${file}`}
                          >
                            <IconDownload size={17} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    ))}
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel value="browse" pt="md">
                  <BackupBrowsePanel key={backup.timestamp} backup={backup} />
                </Tabs.Panel>
                <Tabs.Panel value="compare" pt="md">
                  <Stack align="flex-start">
                    <Text size="sm">Live database comparison</Text>
                    <Text size="sm" c="dimmed">
                      {backup.strategy === 'differential'
                        ? 'Detailed comparison is available for full JSON-backed snapshots only.'
                        : 'Compare captured records against the current database.'}
                    </Text>
                    <Button
                      variant="light"
                      leftSection={<IconGitCompare size={16} />}
                      onClick={() => onReview(backup, 'changes')}
                    >
                      Review changes
                    </Button>
                  </Stack>
                </Tabs.Panel>
                <Tabs.Panel value="restore" pt="md">
                  <Stack align="flex-start">
                    <Alert color="red" title="Database replacement">
                      Restoring replaces the current database and temporarily
                      stops the app.
                    </Alert>
                    <Button
                      color="red"
                      variant="light"
                      leftSection={<IconHistory size={16} />}
                      onClick={() => onReview(backup, 'restore')}
                    >
                      Review restore plan
                    </Button>
                  </Stack>
                </Tabs.Panel>
              </Tabs>
            </>
          ) : (
            <Text size="sm" c="dimmed" py="xl">
              Select a snapshot to inspect its data.
            </Text>
          )}
        </Stack>
      </div>
      <Drawer
        closeButtonProps={{ 'aria-label': 'Close create backup' }}
        opened={creating}
        onClose={() => setCreating(false)}
        title="Create backup"
        position="right"
        size="lg"
      >
        {createForm}
      </Drawer>
    </Stack>
  );
}
