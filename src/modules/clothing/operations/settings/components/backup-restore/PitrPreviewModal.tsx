'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Code,
  CopyButton,
  Group,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCalendarTime,
  IconCheck,
  IconCopy,
  IconHistory,
  IconSearch,
} from '@tabler/icons-react';
import type { PitrBaseBackup, PitrStatus, PitrWalFile } from '../../backup/types';
import {
  formatBackupTimestamp,
  formatFileSize,
  formatRelativeTime,
  parseTimestamp,
} from '../../backup/types';
import { UniversalModal } from '@/components/modals/UniversalModal';
import { PitrInvestigationTab } from './PitrInvestigationTab';

interface PitrPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  status: PitrStatus | null;
}

export function PitrPreviewModal({ opened, onClose, status }: PitrPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<string | null>('bases');

  const [bases, setBases] = useState<PitrBaseBackup[]>([]);
  const [basesLoading, setBasesLoading] = useState(false);
  const [basesError, setBasesError] = useState<string | null>(null);

  const [walFiles, setWalFiles] = useState<PitrWalFile[]>([]);
  const [walTotalSize, setWalTotalSize] = useState(0);
  const [walLoading, setWalLoading] = useState(false);
  const [walLoaded, setWalLoaded] = useState(false);
  const [walError, setWalError] = useState<string | null>(null);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [targetTime, setTargetTime] = useState<Date | null>(null);
  const [plannerMessage, setPlannerMessage] = useState<string | null>(null);

  const loadBaseBackups = useCallback(() => {
    setBasesLoading(true);
    setBasesError(null);

    fetch('/api/backup/pitr/bases')
      .then((res) => res.json())
      .then((data) => {
        const backups: PitrBaseBackup[] = data.baseBackups ?? [];
        setBases(backups);
        if (backups.length > 0 && !selectedFolder) {
          setSelectedFolder(backups[0].folder);
        }
      })
      .catch(() => setBasesError('Failed to load base backups.'))
      .finally(() => setBasesLoading(false));
  }, [selectedFolder]);

  useEffect(() => {
    if (!opened) {
      return;
    }

    loadBaseBackups();
  }, [opened, loadBaseBackups]);

  useEffect(() => {
    if (opened && status?.recoveryWindow.end && !targetTime) {
      setTargetTime(new Date(status.recoveryWindow.end));
    }
  }, [opened, status, targetTime]);

  useEffect(() => {
    if (!opened) {
      setActiveTab('bases');
      setWalLoaded(false);
      setWalFiles([]);
      setWalTotalSize(0);
      setWalError(null);
      setTargetTime(null);
      setPlannerMessage(null);
    }
  }, [opened]);

  const loadWalFiles = useCallback(() => {
    if (walLoaded || walLoading) {
      return;
    }

    setWalLoading(true);
    setWalError(null);

    fetch('/api/backup/pitr/wal')
      .then((res) => res.json())
      .then((data) => {
        setWalFiles(data.files ?? []);
        setWalTotalSize(data.totalSize ?? 0);
        setWalLoaded(true);
      })
      .catch(() => setWalError('Failed to load WAL archive.'))
      .finally(() => setWalLoading(false));
  }, [walLoaded, walLoading]);

  useEffect(() => {
    if (opened && activeTab === 'wal') {
      loadWalFiles();
    }
  }, [activeTab, loadWalFiles, opened]);

  const selectedBackup = bases.find((baseBackup) => baseBackup.folder === selectedFolder) ?? null;
  const windowStart = selectedBackup
    ? new Date(selectedBackup.createdAt)
    : status?.recoveryWindow.start
      ? new Date(status.recoveryWindow.start)
      : null;
  const windowEnd = status?.recoveryWindow.end
    ? new Date(status.recoveryWindow.end)
    : null;

  const restoreCommand =
    selectedFolder && targetTime
      ? `npm run docker:restore:pitr -- --base-backup ${selectedFolder} --target-time ${targetTime.toISOString()} --confirm`
      : null;

  const oldestWalMtime = walFiles.length > 0 ? walFiles[walFiles.length - 1].mtime : undefined;
  const newestWalMtime = walFiles.length > 0 ? walFiles[0].mtime : undefined;

  return (
    <UniversalModal
      opened={opened}
      onClose={onClose}
      title="PITR Recovery Inspector"
      size="90vw"
      styles={{
        content: {
          maxWidth: '90vw',
          width: '90vw',
          maxHeight: '80vh',
          height: '80vh',
        },
      }}
    >
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="bases">
            Base Backups{bases.length > 0 ? ` (${bases.length})` : ''}
          </Tabs.Tab>
          <Tabs.Tab value="wal">
            WAL Archive{status ? ` (${status.walArchiveFileCount})` : ''}
          </Tabs.Tab>
          <Tabs.Tab value="investigate">Find Event</Tabs.Tab>
          <Tabs.Tab value="planner">Restore Planner</Tabs.Tab>
        </Tabs.List>

        {status?.runtime.failedCount !== undefined && status.runtime.failedCount > 0 ? (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="red"
            title="WAL archiving failures detected"
            mt="sm"
          >
            {status.runtime.failedCount} segment{status.runtime.failedCount !== 1 ? 's' : ''} failed
            to archive.{status.runtime.lastFailedWal
              ? ` Last failed: ${status.runtime.lastFailedWal}`
              : ''}{status.runtime.lastFailedAt
              ? ` at ${new Date(status.runtime.lastFailedAt).toLocaleString()}.`
              : '.'} PITR replay may have gaps. Investigate the archive command and disk space before relying on WAL recovery.
          </Alert>
        ) : null}

        {!status?.runtime.databaseConnected && status !== null ? (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="orange"
            title="Cannot reach database runtime"
            mt="sm"
          >
            WAL archive status is unavailable. PostgreSQL runtime stats could not be read. PITR
            recovery window information may be stale.
          </Alert>
        ) : null}

        <Tabs.Panel value="bases" pt="md">
          <Stack gap="md">
            {basesLoading ? (
              <Progress value={100} animated />
            ) : basesError ? (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                {basesError}
              </Alert>
            ) : bases.length === 0 ? (
              <Alert icon={<IconHistory size={16} />} color="gray">
                No base backups found. Create one using the &ldquo;Create Base Backup&rdquo; button
                on the PITR card.
              </Alert>
            ) : (
              <Card withBorder padding="md" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={5}>Physical Base Backups</Title>
                    <Badge color="blue">{bases.length} total</Badge>
                  </Group>
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
                    <Card withBorder padding="sm" radius="sm">
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">Oldest retained base backup</Text>
                        <Text size="sm" fw={600}>
                          {formatBackupTimestamp(bases[bases.length - 1].createdAt)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatRelativeTime(parseTimestamp(bases[bases.length - 1].createdAt))}
                        </Text>
                      </Stack>
                    </Card>
                    <Card withBorder padding="sm" radius="sm">
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">Newest base backup</Text>
                        <Text size="sm" fw={600}>
                          {formatBackupTimestamp(bases[0].createdAt)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {formatRelativeTime(parseTimestamp(bases[0].createdAt))}
                        </Text>
                      </Stack>
                    </Card>
                    <Card withBorder padding="sm" radius="sm">
                      <Stack gap={2}>
                        <Text size="xs" c="dimmed">WAL coverage end</Text>
                        {status?.recoveryWindow.end ? (
                          <>
                            <Text size="sm" fw={600}>
                              {formatBackupTimestamp(status.recoveryWindow.end)}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatRelativeTime(new Date(status.recoveryWindow.end))}
                            </Text>
                          </>
                        ) : (
                          <Text size="sm" c="dimmed">Not yet available</Text>
                        )}
                      </Stack>
                    </Card>
                  </SimpleGrid>
                  <Table.ScrollContainer minWidth={640}>
                    <Table withTableBorder withColumnBorders striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Folder</Table.Th>
                          <Table.Th>Created</Table.Th>
                          <Table.Th>Size</Table.Th>
                          <Table.Th>Trigger</Table.Th>
                          <Table.Th>Files</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {bases.map((baseBackup) => {
                          const trigger = baseBackup.scheduler?.trigger;
                          const catchUp = baseBackup.scheduler?.catchUp;
                          return (
                            <Table.Tr key={baseBackup.folder}>
                              <Table.Td>
                                <Text size="xs" ff="monospace">
                                  {baseBackup.folder}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={2}>
                                  <Text size="sm">
                                    {formatBackupTimestamp(baseBackup.createdAt)}
                                  </Text>
                                  <Text size="xs" c="dimmed">
                                    {formatRelativeTime(parseTimestamp(baseBackup.createdAt))}
                                  </Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">{formatFileSize(baseBackup.totalSize)}</Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  size="xs"
                                  variant="light"
                                  color={
                                    trigger === 'scheduled'
                                      ? catchUp
                                        ? 'orange'
                                        : 'teal'
                                      : 'gray'
                                  }
                                >
                                  {trigger === 'scheduled'
                                    ? catchUp
                                      ? 'Catch-up'
                                      : 'Scheduled'
                                    : 'Manual'}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                <Text size="xs" c="dimmed">
                                  {baseBackup.files.length}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          );
                        })}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Stack>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="wal" pt="md">
          <Stack gap="md">
            {walLoading ? (
              <Progress value={100} animated />
            ) : walError ? (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                {walError}
              </Alert>
            ) : !walLoaded ? (
              <Alert icon={<IconHistory size={16} />} color="gray">
                Click this tab to load the WAL archive listing.
              </Alert>
            ) : walFiles.length === 0 ? (
              <Alert icon={<IconHistory size={16} />} color="gray">
                No WAL files archived yet. WAL archiving starts automatically once there is write
                activity and the archive_timeout interval elapses.
              </Alert>
            ) : (
              <Card withBorder padding="md" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={5}>WAL Segments</Title>
                    <Group gap="xs">
                      <Badge color="blue">{walFiles.length} files</Badge>
                      <Badge color="gray" variant="light">
                        {formatFileSize(walTotalSize)}
                      </Badge>
                    </Group>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Sorted newest first. These segments cover the time range between base backups and
                    the most recent archived checkpoint.
                  </Text>
                  {oldestWalMtime ? (
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                      <Card withBorder padding="sm" radius="sm">
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">Oldest WAL segment</Text>
                          <Text size="xs" ff="monospace">
                            {walFiles[walFiles.length - 1].name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {formatRelativeTime(new Date(oldestWalMtime))}
                          </Text>
                        </Stack>
                      </Card>
                      <Card withBorder padding="sm" radius="sm">
                        <Stack gap={2}>
                          <Text size="xs" c="dimmed">Newest WAL segment</Text>
                          <Text size="xs" ff="monospace">{walFiles[0].name}</Text>
                          <Text size="xs" c="dimmed">
                            {formatRelativeTime(new Date(newestWalMtime ?? oldestWalMtime))}
                          </Text>
                        </Stack>
                      </Card>
                    </SimpleGrid>
                  ) : null}
                  <Table.ScrollContainer minWidth={400}>
                    <Table withTableBorder withColumnBorders striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>WAL Segment</Table.Th>
                          <Table.Th>Size</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {walFiles.map((file) => (
                          <Table.Tr key={file.name}>
                            <Table.Td>
                              <Text size="xs" ff="monospace">
                                {file.name}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{formatFileSize(file.size)}</Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Table.ScrollContainer>
                </Stack>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="investigate" pt="md">
          <PitrInvestigationTab
            opened={opened}
            baseBackups={bases}
            onApplyRestoreAnchor={({ folder, targetTime: nextTargetTime, message }) => {
              setSelectedFolder(folder);
              setTargetTime(nextTargetTime);
              setPlannerMessage(message);
              setActiveTab('planner');
            }}
          />
        </Tabs.Panel>

        <Tabs.Panel value="planner" pt="md">
          <Stack gap="md">
            <Alert icon={<IconAlertCircle size={16} />} color="red" title="Operator-Managed Restore">
              PITR recovery is a terminal operation that stops the app and database, replaces the
              PostgreSQL data directory, and restarts the stack automatically. The current database
              state is preserved as a <Code>.pre-pitr-*</Code> fallback folder before any change is
              made.
            </Alert>

            {plannerMessage ? (
              <Alert icon={<IconSearch size={16} />} color="blue">
                {plannerMessage}
              </Alert>
            ) : null}

            {basesLoading ? (
              <Progress value={100} animated />
            ) : bases.length === 0 ? (
              <Alert icon={<IconHistory size={16} />} color="orange">
                No base backups available. Create one first using the PITR card.
              </Alert>
            ) : (
              <Card withBorder padding="md" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={5}>Select Recovery Point</Title>
                    {selectedBackup ? (
                      <Badge color="blue" variant="light">
                        {selectedBackup.folder}
                      </Badge>
                    ) : null}
                  </Group>

                  <Select
                    label="Base backup"
                    description="The physical snapshot to restore from. All changes after this point are replayed from WAL."
                    data={bases.map((baseBackup) => ({
                      value: baseBackup.folder,
                      label: `${baseBackup.folder} — ${formatFileSize(baseBackup.totalSize)} (${baseBackup.scheduler?.trigger ?? 'manual'})`,
                    }))}
                    value={selectedFolder}
                    onChange={setSelectedFolder}
                  />

                  {windowStart ? (
                    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
                      <Card withBorder padding="sm" radius="md">
                        <Stack gap={4}>
                          <Text size="xs" c="dimmed">
                            Recovery window start
                          </Text>
                          <Text size="sm" fw={600}>
                            {formatBackupTimestamp(windowStart.toISOString())}
                          </Text>
                          <Text size="xs" c="dimmed">
                            Base backup taken {formatRelativeTime(windowStart)}
                          </Text>
                        </Stack>
                      </Card>
                      <Card withBorder padding="sm" radius="md">
                        <Stack gap={4}>
                          <Text size="xs" c="dimmed">
                            Recovery window end
                          </Text>
                          <Text size="sm" fw={600}>
                            {windowEnd
                              ? formatBackupTimestamp(windowEnd.toISOString())
                              : 'Unknown — no WAL archived yet'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {windowEnd
                              ? `Latest archived WAL ${formatRelativeTime(windowEnd)}`
                              : 'WAL archiving in progress'}
                          </Text>
                        </Stack>
                      </Card>
                    </SimpleGrid>
                  ) : null}

                  <DateTimePicker
                    label="Target recovery time"
                    description="The exact moment to recover to. Must fall within the recovery window above."
                    placeholder="Pick a date and time"
                    leftSection={<IconCalendarTime size={16} />}
                    value={targetTime}
                    onChange={setTargetTime}
                    minDate={windowStart ?? undefined}
                    maxDate={windowEnd ?? undefined}
                    clearable
                  />
                </Stack>
              </Card>
            )}

            {restoreCommand ? (
              <Card withBorder padding="md" radius="md">
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={5}>Restore Command</Title>
                    <CopyButton value={restoreCommand}>
                      {({ copied, copy }) => (
                        <Button
                          size="xs"
                          variant="light"
                          color={copied ? 'teal' : 'blue'}
                          leftSection={
                            copied ? <IconCheck size={14} /> : <IconCopy size={14} />
                          }
                          onClick={copy}
                        >
                          {copied ? 'Copied!' : 'Copy command'}
                        </Button>
                      )}
                    </CopyButton>
                  </Group>
                  <Text size="sm" c="dimmed">
                    Run this from the server terminal in the directory where the Docker Compose stack
                    lives. The app will go offline briefly while the restore completes.
                  </Text>
                  <Code block>{restoreCommand}</Code>
                </Stack>
              </Card>
            ) : null}
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </UniversalModal>
  );
}
