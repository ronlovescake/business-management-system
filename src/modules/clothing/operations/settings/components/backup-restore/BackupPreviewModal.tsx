import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowsDiff,
  IconDatabase,
  IconFile,
  IconFileDescription,
  IconFileSpreadsheet,
  IconFileTypeCsv,
  IconHistory,
  IconPlayerPlay,
  IconRoute,
} from '@tabler/icons-react';
import type {
  BackupData,
  BackupChangesComparison,
  BackupChangeEntry,
  RestoreJobStatus,
  RestorePlan,
} from '../../backup/types';
import { formatBackupTimestamp } from '../../backup/types';
import { BackupTablesBrowser } from './BackupTablesBrowser';
import { UniversalModal } from '@/components/modals/UniversalModal';

type SelectedTableDetails = {
  name: string;
  count: number;
  data: Array<Record<string, unknown>>;
  columns: string[];
} | null;

interface BackupPreviewModalProps {
  opened: boolean;
  loading: boolean;
  previewData: BackupData | null;
  backupChanges: BackupChangesComparison | null;
  backupChangesLoading: boolean;
  backupChangesError: string | null;
  restorePlan: RestorePlan | null;
  restorePlanLoading: boolean;
  restorePlanError: string | null;
  restoreRunnerAvailable: boolean;
  restoreRunnerHeartbeatAt: string | null;
  restoreJobStatus: RestoreJobStatus | null;
  restoreJobLoading: boolean;
  restoreSubmitting: boolean;
  selectedBackupTimestamp: string | null;
  selectedDumpFileName: string | null;
  restoreDisabledReason: string | null;
  selectedTableName: string | null;
  selectedTableDetails: SelectedTableDetails;
  canDownloadJson: boolean;
  canDownloadDump: boolean;
  onClose: () => void;
  onSelectTable: (table: string) => void | Promise<void>;
  onDownloadJSON: () => void;
  onDownloadDump: () => void;
  onDownloadAllCSV: () => void;
  onDownloadAllXLSX: () => void;
  onDownloadCSV: (table: string) => void;
  onDownloadXLSX: (table: string) => void;
  onPreviewChangeTable: (table: string) => void;
  onRestore: () => void;
}

const CHANGE_STATUS_COLOR: Record<
  BackupChangeEntry['status'],
  'green' | 'red' | 'yellow' | 'gray'
> = {
  increased: 'green',
  decreased: 'red',
  missing: 'yellow',
  unchanged: 'gray',
};

const CHANGE_COVERAGE_COLOR: Record<
  BackupChangeEntry['coverage'],
  'blue' | 'grape' | 'dark'
> = {
  'selective-json': 'blue',
  'log-only': 'grape',
  'dump-only': 'dark',
};

const formatDelta = (value: number) => {
  if (value === 0) {
    return '0';
  }

  return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
};

export const BackupPreviewModal = ({
  opened,
  loading,
  previewData,
  backupChanges,
  backupChangesLoading,
  backupChangesError,
  restorePlan,
  restorePlanLoading,
  restorePlanError,
  restoreRunnerAvailable,
  restoreRunnerHeartbeatAt,
  restoreJobStatus,
  restoreJobLoading,
  restoreSubmitting,
  selectedBackupTimestamp,
  selectedDumpFileName,
  restoreDisabledReason,
  selectedTableName,
  selectedTableDetails,
  canDownloadJson,
  canDownloadDump,
  onClose,
  onSelectTable,
  onDownloadJSON,
  onDownloadDump,
  onDownloadAllCSV,
  onDownloadAllXLSX,
  onDownloadCSV,
  onDownloadXLSX,
  onPreviewChangeTable,
  onRestore,
}: BackupPreviewModalProps) => (
  <UniversalModal
    opened={opened}
    onClose={onClose}
    title="Backup Preview"
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
    {loading && !previewData && !restorePlan ? (
      <Progress value={100} animated />
    ) : previewData?.metadata || restorePlan ? (
      <Tabs defaultValue="summary">
        <Tabs.List>
          <Tabs.Tab value="summary">Summary</Tabs.Tab>
          <Tabs.Tab value="changes">Changes</Tabs.Tab>
          <Tabs.Tab value="tables" disabled={!previewData?.tables}>
            Tables
          </Tabs.Tab>
          <Tabs.Tab value="download">Download</Tabs.Tab>
          <Tabs.Tab value="restore">Restore</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="summary" pt="md">
          <Stack gap="md">
            {previewData?.metadata ? (
              <Alert icon={<IconHistory size={16} />} color="blue">
                <Stack gap="xs">
                  <Text size="sm">
                    Created:{' '}
                    {formatBackupTimestamp(previewData.metadata.createdAt)}
                  </Text>
                  <Text size="sm">
                    Database: {previewData.metadata.database}
                  </Text>
                </Stack>
              </Alert>
            ) : (
              <Alert icon={<IconFileDescription size={16} />} color="gray">
                This backup does not include a JSON inspection artifact. Table
                browsing is unavailable, but restore planning and dump download
                remain available.
              </Alert>
            )}

            {previewData?.tables ? (
              <Card withBorder>
                <Title order={5} mb="sm">
                  Tables
                </Title>
                <Stack gap="xs">
                  {Object.entries(previewData.tables).map(([name, data]) => (
                    <Group key={name} justify="space-between">
                      <Text size="sm">{name}</Text>
                      <Badge>{data.count} records</Badge>
                    </Group>
                  ))}
                </Stack>
              </Card>
            ) : null}

            {restorePlan ? (
              <Card withBorder>
                <Group justify="space-between" mb="sm">
                  <Title order={5}>Restore Chain</Title>
                  <Badge
                    color={
                      restorePlan.status === 'ready'
                        ? 'green'
                        : restorePlan.status === 'advisory'
                          ? 'yellow'
                          : 'red'
                    }
                  >
                    {restorePlan.status}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed" mb="sm">
                  {restorePlan.chainFolders.join(' -> ')}
                </Text>
                <Text size="sm">
                  {restorePlan.status === 'ready'
                    ? 'This target is immediately restorable under the current dump-only DR contract.'
                    : restorePlan.status === 'advisory'
                      ? 'This target has a structurally valid chain, but replay steps still depend on the future differential/log executor.'
                      : 'This target has a broken restore chain and should not be relied on until the underlying backup gap is fixed.'}
                </Text>
              </Card>
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="changes" pt="md">
          <Stack gap="md">
            <Alert icon={<IconArrowsDiff size={16} />} color="blue">
              This compares the selected backup&apos;s saved row counts with the
              live database right now. It is a table-count change summary, not a
              row-by-row audit trail.
            </Alert>

            {backupChangesLoading ? <Progress value={100} animated /> : null}

            {backupChangesError ? (
              <Alert icon={<IconAlertCircle size={16} />} color="yellow">
                {backupChangesError}
              </Alert>
            ) : null}

            {backupChanges ? (
              <>
                <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
                  <Card withBorder>
                    <Stack gap={4}>
                      <Text size="sm" c="dimmed">
                        Compared against live database
                      </Text>
                      <Text fw={600}>
                        {formatBackupTimestamp(
                          backupChanges.currentGeneratedAt
                        )}
                      </Text>
                      <Text size="sm" c="dimmed">
                        Backup:{' '}
                        {formatBackupTimestamp(
                          backupChanges.backupCreatedAt ??
                            backupChanges.backupTimestamp
                        )}
                      </Text>
                    </Stack>
                  </Card>
                  <Card withBorder>
                    <Stack gap={4}>
                      <Text size="sm" c="dimmed">
                        Changed tables
                      </Text>
                      <Text fw={700} size="lg">
                        {backupChanges.changedTables} /{' '}
                        {backupChanges.totalTables}
                      </Text>
                      <Group gap="xs">
                        <Badge color="green">
                          +{backupChanges.increasedTables} increased
                        </Badge>
                        <Badge color="red">
                          {backupChanges.decreasedTables} decreased
                        </Badge>
                        {backupChanges.missingTables ? (
                          <Badge color="yellow">
                            {backupChanges.missingTables} missing
                          </Badge>
                        ) : null}
                      </Group>
                    </Stack>
                  </Card>
                  <Card withBorder>
                    <Stack gap={4}>
                      <Text size="sm" c="dimmed">
                        Net row delta
                      </Text>
                      <Text fw={700} size="lg">
                        {formatDelta(backupChanges.deltaRecords)}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {backupChanges.backupTotalRecords.toLocaleString()}{' '}
                        backup rows
                        {' to '}
                        {backupChanges.currentTotalRecords.toLocaleString()}{' '}
                        current rows
                      </Text>
                    </Stack>
                  </Card>
                </SimpleGrid>

                {backupChanges.changedTables === 0 ? (
                  <Alert color="green" icon={<IconHistory size={16} />}>
                    No row-count changes were detected since this backup.
                  </Alert>
                ) : (
                  <>
                    {backupChanges.entries.some(
                      (entry) =>
                        entry.status === 'increased' ||
                        entry.status === 'decreased'
                    ) ? (
                      <Card withBorder>
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Title order={5}>Count Drift</Title>
                            <Badge color="blue">
                              {
                                backupChanges.entries.filter(
                                  (entry) =>
                                    entry.status === 'increased' ||
                                    entry.status === 'decreased'
                                ).length
                              }{' '}
                              changed
                            </Badge>
                          </Group>
                          <Table.ScrollContainer minWidth={720}>
                            <Table
                              striped
                              highlightOnHover
                              withTableBorder
                              withColumnBorders
                              verticalSpacing="xs"
                            >
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>Table</Table.Th>
                                  <Table.Th>Coverage</Table.Th>
                                  <Table.Th ta="right">Backup</Table.Th>
                                  <Table.Th ta="right">Current</Table.Th>
                                  <Table.Th ta="right">Delta</Table.Th>
                                  <Table.Th>Status</Table.Th>
                                  <Table.Th>Details</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {backupChanges.entries
                                  .filter(
                                    (entry) =>
                                      entry.status === 'increased' ||
                                      entry.status === 'decreased'
                                  )
                                  .map((entry) => (
                                    <Table.Tr key={entry.key}>
                                      <Table.Td>
                                        <Stack gap={0}>
                                          <Text size="sm" fw={600}>
                                            {entry.key}
                                          </Text>
                                          <Text size="xs" c="dimmed">
                                            {entry.modelName}
                                          </Text>
                                        </Stack>
                                      </Table.Td>
                                      <Table.Td>
                                        <Badge
                                          color={
                                            CHANGE_COVERAGE_COLOR[
                                              entry.coverage
                                            ]
                                          }
                                          variant="light"
                                        >
                                          {entry.coverage}
                                        </Badge>
                                      </Table.Td>
                                      <Table.Td ta="right">
                                        {entry.backupCount.toLocaleString()}
                                      </Table.Td>
                                      <Table.Td ta="right">
                                        {entry.currentCount.toLocaleString()}
                                      </Table.Td>
                                      <Table.Td
                                        ta="right"
                                        c={entry.delta > 0 ? 'green' : 'red'}
                                        fw={600}
                                      >
                                        {formatDelta(entry.delta)}
                                      </Table.Td>
                                      <Table.Td>
                                        <Badge
                                          color={
                                            CHANGE_STATUS_COLOR[entry.status]
                                          }
                                          variant="light"
                                        >
                                          {entry.status}
                                        </Badge>
                                      </Table.Td>
                                      <Table.Td>
                                        <Button
                                          size="xs"
                                          variant="subtle"
                                          onClick={() =>
                                            onPreviewChangeTable(entry.key)
                                          }
                                          disabled={
                                            entry.coverage === 'dump-only' ||
                                            entry.backupCount > 2000 ||
                                            entry.currentCount > 2000
                                          }
                                        >
                                          Preview
                                        </Button>
                                      </Table.Td>
                                    </Table.Tr>
                                  ))}
                              </Table.Tbody>
                            </Table>
                          </Table.ScrollContainer>
                          <Text size="xs" c="dimmed">
                            Detailed row preview is available for smaller
                            JSON-backed tables. Dump-only tables and very large
                            tables stay count-only.
                          </Text>
                        </Stack>
                      </Card>
                    ) : null}

                    {backupChanges.missingTables ? (
                      <Card withBorder>
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Title order={5}>
                              Missing Or Unavailable Tables
                            </Title>
                            <Badge color="yellow" variant="light">
                              {backupChanges.missingTables} missing
                            </Badge>
                          </Group>
                          <Stack
                            gap={6}
                            style={{ maxHeight: 220, overflowY: 'auto' }}
                          >
                            {backupChanges.entries
                              .filter((entry) => entry.status === 'missing')
                              .map((entry) => (
                                <Group
                                  key={entry.key}
                                  justify="space-between"
                                  align="flex-start"
                                >
                                  <Stack gap={0}>
                                    <Text size="sm" fw={600}>
                                      {entry.key}
                                    </Text>
                                    <Text size="xs" c="dimmed">
                                      {entry.modelName}
                                    </Text>
                                  </Stack>
                                  <Group gap="xs">
                                    <Badge
                                      color={
                                        CHANGE_COVERAGE_COLOR[entry.coverage]
                                      }
                                      variant="light"
                                    >
                                      {entry.coverage}
                                    </Badge>
                                    <Badge color="yellow" variant="light">
                                      {entry.reason ?? 'missing'}
                                    </Badge>
                                  </Group>
                                </Group>
                              ))}
                          </Stack>
                        </Stack>
                      </Card>
                    ) : null}
                  </>
                )}

                {backupChanges.unchangedTables ? (
                  <Text size="sm" c="dimmed">
                    {backupChanges.unchangedTables} table
                    {backupChanges.unchangedTables === 1 ? '' : 's'} unchanged
                    and omitted from the list above.
                  </Text>
                ) : null}
              </>
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="tables" pt="md">
          {previewData ? (
            <BackupTablesBrowser
              previewData={previewData}
              selectedTableName={selectedTableName}
              selectedTableDetails={selectedTableDetails}
              onSelectTable={onSelectTable}
            />
          ) : (
            <Alert icon={<IconFileDescription size={16} />} color="gray">
              This backup cannot be browsed by table because only the PostgreSQL
              dump artifact is available.
            </Alert>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="download" pt="md">
          <Stack gap="md">
            <Button
              leftSection={<IconFile size={16} />}
              onClick={onDownloadJSON}
              disabled={!canDownloadJson}
            >
              Download JSON
            </Button>
            <Button
              color="teal"
              leftSection={<IconDatabase size={16} />}
              onClick={onDownloadDump}
              disabled={!canDownloadDump}
            >
              Download PostgreSQL Dump
            </Button>
            <Button
              color="green"
              leftSection={<IconFileTypeCsv size={16} />}
              onClick={onDownloadAllCSV}
              disabled={!previewData}
            >
              Download All CSV
            </Button>
            <Button
              color="cyan"
              leftSection={<IconFileSpreadsheet size={16} />}
              onClick={onDownloadAllXLSX}
              disabled={!previewData}
            >
              Download All XLSX
            </Button>
            <Divider />
            {previewData?.tables ? (
              <Stack gap="xs">
                {Object.entries(previewData.tables).map(([name, data]) => (
                  <Group key={name} justify="space-between">
                    <Text size="sm">{name}</Text>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="subtle"
                        color="green"
                        disabled={!data.count}
                        onClick={() => onDownloadCSV(name)}
                      >
                        CSV
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="cyan"
                        disabled={!data.count}
                        onClick={() => onDownloadXLSX(name)}
                      >
                        XLSX
                      </Button>
                    </Group>
                  </Group>
                ))}
              </Stack>
            ) : (
              <Alert icon={<IconFileDescription size={16} />} color="gray">
                JSON, CSV, and XLSX inspection exports are unavailable for this
                backup because no JSON inspection artifact was generated.
              </Alert>
            )}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel
          value="restore"
          pt="md"
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 'calc(85vh - 80px)',
          }}
        >
          <Stack gap="md" style={{ flex: 1, minHeight: 0 }}>
            <Alert
              icon={<IconAlertCircle size={16} />}
              color="red"
              title="Disaster-Recovery Restore Is Operator Managed"
            >
              UI restore is available only through the dedicated restore-runner.
              It still performs the same validated full-dump Docker restore and
              will temporarily take the app offline while the database is
              replaced.
            </Alert>
            <Card withBorder padding="md" radius="md">
              <Stack gap="sm">
                <Text fw={600}>Supported Phase 2A workflow</Text>
                <Text size="sm">
                  1. Review the selected dump and restore chain below.
                </Text>
                <Text size="sm">
                  2. Submit the restore job from this modal.
                </Text>
                <Text size="sm">
                  3. The restore-runner validates the manifest and checksum,
                  stops the app, replaces the Docker database, and starts the
                  app again.
                </Text>
                <Text size="sm" c="dimmed">
                  Selected dump:{' '}
                  <strong>{selectedDumpFileName || 'No dump available'}</strong>
                </Text>
                <Text size="sm" c="dimmed">
                  JSON, CSV, and XLSX artifacts remain inspection/export only.
                </Text>
              </Stack>
            </Card>

            <Card withBorder padding="md" radius="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Text fw={600}>Restore runner</Text>
                  <Badge color={restoreRunnerAvailable ? 'green' : 'red'}>
                    {restoreRunnerAvailable ? 'online' : 'offline'}
                  </Badge>
                </Group>
                {restoreJobLoading ? <Progress value={100} animated /> : null}
                <Text size="sm" c="dimmed">
                  Last heartbeat:{' '}
                  {restoreRunnerHeartbeatAt
                    ? formatBackupTimestamp(restoreRunnerHeartbeatAt)
                    : 'Unavailable'}
                </Text>

                {restoreJobStatus ? (
                  <Card withBorder padding="sm" radius="md">
                    <Stack gap={4}>
                      <Group justify="space-between">
                        <Text size="sm" fw={600}>
                          Latest restore job
                        </Text>
                        <Badge
                          color={
                            restoreJobStatus.phase === 'succeeded'
                              ? 'green'
                              : restoreJobStatus.phase === 'failed'
                                ? 'red'
                                : 'yellow'
                          }
                        >
                          {restoreJobStatus.phase}
                        </Badge>
                      </Group>
                      <Text size="sm">
                        Backup folder: {restoreJobStatus.backupFolder}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Dump: {restoreJobStatus.dumpFileName}
                      </Text>
                      {restoreJobStatus.message ? (
                        <Text size="xs" c="dimmed">
                          {restoreJobStatus.message}
                        </Text>
                      ) : null}
                      {restoreJobStatus.error ? (
                        <Alert color="red" icon={<IconAlertCircle size={14} />}>
                          <Text size="xs">{restoreJobStatus.error}</Text>
                        </Alert>
                      ) : null}
                    </Stack>
                  </Card>
                ) : (
                  <Text size="sm" c="dimmed">
                    No restore jobs have been submitted yet.
                  </Text>
                )}
              </Stack>
            </Card>

            <Card withBorder padding="md" radius="md">
              <Stack gap="sm">
                <Group justify="space-between">
                  <Group gap="xs">
                    <IconRoute size={16} />
                    <Text fw={600}>Phase 3 restore planner</Text>
                  </Group>
                  {restorePlan ? (
                    <Badge
                      color={
                        restorePlan.status === 'ready'
                          ? 'green'
                          : restorePlan.status === 'advisory'
                            ? 'yellow'
                            : 'red'
                      }
                    >
                      {restorePlan.status}
                    </Badge>
                  ) : null}
                </Group>

                {restorePlanLoading ? <Progress value={100} animated /> : null}

                {restorePlanError ? (
                  <Alert color="red" icon={<IconAlertCircle size={16} />}>
                    {restorePlanError}
                  </Alert>
                ) : null}

                {restorePlan ? (
                  <>
                    <Text size="sm">
                      Target strategy:{' '}
                      <strong>{restorePlan.targetStrategy}</strong>
                    </Text>
                    <Text size="sm" c="dimmed">
                      Chain: {restorePlan.chainFolders.join(' -> ')}
                    </Text>
                    <Stack gap="xs">
                      {restorePlan.steps.map((step, index) => (
                        <Card
                          key={`${step.folder}-${step.action}`}
                          withBorder
                          padding="sm"
                          radius="md"
                        >
                          <Stack gap={4}>
                            <Group justify="space-between">
                              <Text size="sm" fw={600}>
                                {index + 1}. {step.action}
                              </Text>
                              <Badge color={step.supported ? 'green' : 'gray'}>
                                {step.supported ? 'supported' : 'planned only'}
                              </Badge>
                            </Group>
                            <Text size="sm">{step.folder}</Text>
                            {step.artifactName ? (
                              <Text size="xs" c="dimmed">
                                Artifact: {step.artifactName}
                              </Text>
                            ) : null}
                            {step.reason ? (
                              <Text size="xs" c="dimmed">
                                {step.reason}
                              </Text>
                            ) : null}
                          </Stack>
                        </Card>
                      ))}
                    </Stack>

                    {restorePlan.warnings.length ? (
                      <Alert
                        color="yellow"
                        icon={<IconAlertCircle size={16} />}
                      >
                        <Stack gap={4}>
                          {restorePlan.warnings.map((warning) => (
                            <Text key={warning} size="sm">
                              {warning}
                            </Text>
                          ))}
                        </Stack>
                      </Alert>
                    ) : null}

                    {restorePlan.errors.length ? (
                      <Alert color="red" icon={<IconAlertCircle size={16} />}>
                        <Stack gap={4}>
                          {restorePlan.errors.map((error) => (
                            <Text key={error} size="sm">
                              {error}
                            </Text>
                          ))}
                        </Stack>
                      </Alert>
                    ) : null}
                  </>
                ) : null}
              </Stack>
            </Card>

            <Group justify="space-between" align="center">
              <Stack gap={4} style={{ flex: 1 }}>
                <Text size="sm" c="dimmed">
                  {selectedBackupTimestamp
                    ? `Selected backup: ${selectedBackupTimestamp}`
                    : 'No backup selected.'}
                </Text>
                <Text size="sm" c="dimmed">
                  {restoreDisabledReason ||
                    'This backup is eligible for a validated full-dump restore.'}
                </Text>
              </Stack>
              <Group>
                <Button
                  leftSection={<IconDatabase size={16} />}
                  onClick={onDownloadDump}
                  disabled={!canDownloadDump}
                  variant="default"
                >
                  Download Dump
                </Button>
                <Button
                  color="red"
                  leftSection={<IconPlayerPlay size={16} />}
                  onClick={onRestore}
                  loading={restoreSubmitting}
                  disabled={Boolean(restoreDisabledReason)}
                >
                  Restore This Backup
                </Button>
              </Group>
            </Group>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    ) : (
      <Alert icon={<IconAlertCircle size={16} />} color="red">
        <Text size="sm">
          Failed to load backup data. The file may be corrupted.
        </Text>
      </Alert>
    )}
  </UniversalModal>
);
