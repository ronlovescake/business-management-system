import { memo } from 'react';
import {
  ActionIcon,
  Badge,
  Card,
  Group,
  Progress,
  ScrollArea,
  Table as MantineTable,
  Text,
  Title,
} from '@mantine/core';
import {
  IconDatabase,
  IconDownload,
  IconEye,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import type { Backup } from '../../backup/types';
import { formatBackupTimestamp, formatFileSize } from '../../backup/types';

interface BackupListCardProps {
  backups: Backup[];
  loading: boolean;
  onRefresh: () => void;
  onPreview: (backup: Backup) => void;
  onDownloadJSON: (backup: Backup) => void;
  onDownloadSQL: (backup: Backup) => void;
  onDelete: (backup: Backup) => void;
  title?: string;
  subtitle?: string;
}

export const BackupListCard = memo(
  ({
    backups,
    loading,
    onRefresh,
    onPreview,
    onDownloadJSON,
    onDownloadSQL,
    onDelete,
    title = `Backups (${backups.length})`,
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
                <MantineTable.Th>Files</MantineTable.Th>
                <MantineTable.Th>Size</MantineTable.Th>
                <MantineTable.Th>Actions</MantineTable.Th>
              </MantineTable.Tr>
            </MantineTable.Thead>
            <MantineTable.Tbody>
              {backups.map((backup) => (
                <MantineTable.Tr key={backup.timestamp}>
                  <MantineTable.Td>
                    <Text size="sm">
                      {formatBackupTimestamp(backup.timestamp)}
                    </Text>
                  </MantineTable.Td>
                  <MantineTable.Td>
                    <Badge color="gray" variant="light">
                      {backup.files.length}
                    </Badge>
                  </MantineTable.Td>
                  <MantineTable.Td>
                    {formatFileSize(backup.totalSize)}
                  </MantineTable.Td>
                  <MantineTable.Td>
                    <Group gap="xs">
                      <ActionIcon
                        color="blue"
                        variant="subtle"
                        onClick={() => onPreview(backup)}
                        title="Preview backup"
                        aria-label="Preview backup"
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="green"
                        variant="subtle"
                        onClick={() => onDownloadJSON(backup)}
                        title="Download JSON"
                        aria-label="Download JSON"
                      >
                        <IconDownload size={16} />
                      </ActionIcon>
                      <ActionIcon
                        color="teal"
                        variant="subtle"
                        onClick={() => onDownloadSQL(backup)}
                        title="Download SQL"
                        aria-label="Download SQL"
                      >
                        <IconDatabase size={16} />
                      </ActionIcon>
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
              ))}
            </MantineTable.Tbody>
          </MantineTable>
        </ScrollArea>
      )}
    </Card>
  )
);

BackupListCard.displayName = 'BackupListCard';
