import { memo } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Progress,
  ScrollArea,
  Stack,
  Table as MantineTable,
  Text,
  Title,
} from '@mantine/core';
import { IconEye, IconRefresh, IconTrash } from '@tabler/icons-react';
import type { Backup } from '../../backup/types';
import {
  STRATEGY_META,
  formatBackupTimestamp,
  formatFileSize,
} from '../../backup/types';

interface BackupListCardProps {
  backups: Backup[];
  loading: boolean;
  onRefresh: () => void;
  onPreview: (backup: Backup) => void;
  onDelete: (backup: Backup) => void;
  title?: string;
  subtitle?: string;
}

const getArtifactSummary = (backup: Backup) => {
  const hasDump = backup.files.some((file) => file.endsWith('.dump'));
  const hasJson = backup.files.some((file) => file.endsWith('.json'));

  return {
    artifactCount: backup.files.length,
    hasDump,
    hasJson,
  };
};

export const BackupListCard = memo(
  ({
    backups,
    loading,
    onRefresh,
    onPreview,
    onDelete,
    title = `Recent Backups (${backups.length})`,
    subtitle,
  }: BackupListCardProps) => (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>{title}</Title>
          {subtitle ? (
            <Text size="sm" c="dimmed">
              {subtitle}
            </Text>
          ) : null}
        </div>
        <ActionIcon
          onClick={onRefresh}
          loading={loading}
          aria-label="Refresh backups"
        >
          <IconRefresh size={18} />
        </ActionIcon>
      </Group>

      {loading ? (
        <Progress value={100} animated />
      ) : backups.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No backups found
        </Text>
      ) : (
        <ScrollArea h="55vh" scrollbarSize={10} offsetScrollbars>
          <MantineTable striped highlightOnHover>
            <MantineTable.Thead
              style={{
                position: 'sticky',
                top: 0,
                zIndex: 2,
                background: 'var(--mantine-color-white)',
              }}
            >
              <MantineTable.Tr>
                <MantineTable.Th>Date</MantineTable.Th>
                <MantineTable.Th>Strategy</MantineTable.Th>
                <MantineTable.Th>Artifacts</MantineTable.Th>
                <MantineTable.Th>Size</MantineTable.Th>
                <MantineTable.Th>Actions</MantineTable.Th>
              </MantineTable.Tr>
            </MantineTable.Thead>
            <MantineTable.Tbody>
              {backups.map((backup) => {
                const strategyMeta = backup.strategy
                  ? STRATEGY_META[backup.strategy]
                  : null;
                const { artifactCount, hasDump, hasJson } =
                  getArtifactSummary(backup);

                return (
                  <MantineTable.Tr key={backup.timestamp}>
                    <MantineTable.Td>
                      <Stack gap={0}>
                        <Text size="sm">
                          {formatBackupTimestamp(backup.timestamp)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {artifactCount} artifact
                          {artifactCount === 1 ? '' : 's'}
                        </Text>
                      </Stack>
                    </MantineTable.Td>
                    <MantineTable.Td>
                      {strategyMeta ? (
                        <Badge color={strategyMeta.color} variant="light">
                          {strategyMeta.label}
                        </Badge>
                      ) : (
                        <Badge color="gray" variant="light">
                          Unknown
                        </Badge>
                      )}
                    </MantineTable.Td>
                    <MantineTable.Td>
                      <Group gap="xs">
                        {hasDump ? (
                          <Badge color="teal" variant="light">
                            Dump
                          </Badge>
                        ) : null}
                        {hasJson ? (
                          <Badge color="blue" variant="light">
                            JSON
                          </Badge>
                        ) : null}
                        {!hasDump && !hasJson ? (
                          <Text size="xs" c="dimmed">
                            Other exports only
                          </Text>
                        ) : null}
                      </Group>
                    </MantineTable.Td>
                    <MantineTable.Td>
                      {formatFileSize(backup.totalSize)}
                    </MantineTable.Td>
                    <MantineTable.Td>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          variant="light"
                          leftSection={<IconEye size={14} />}
                          onClick={() => onPreview(backup)}
                        >
                          Open
                        </Button>
                        <ActionIcon
                          color="red"
                          variant="subtle"
                          onClick={() => onDelete(backup)}
                          title="Delete backup"
                          aria-label="Delete backup"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    </MantineTable.Td>
                  </MantineTable.Tr>
                );
              })}
            </MantineTable.Tbody>
          </MantineTable>
        </ScrollArea>
      )}
    </Card>
  )
);

BackupListCard.displayName = 'BackupListCard';
