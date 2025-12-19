'use client';

import { Button, Group, List, Paper, Stack, Text } from '@mantine/core';
import { IconDatabaseExport, IconDatabaseImport } from '@tabler/icons-react';

export function BackupRestorePlaceholder() {
  return (
    <Paper withBorder radius="md" p="xl">
      <Stack gap="md">
        <Stack gap={4}>
          <Text size="lg" fw={600}>
            Backup & Restore
          </Text>
          <Text c="dimmed">
            Automated backups are coming soon. In the meantime, keep your data
            safe by exporting regular snapshots and storing them securely.
          </Text>
        </Stack>
        <List spacing="xs" size="sm" c="dimmed">
          <List.Item>Schedule periodic exports to external storage.</List.Item>
          <List.Item>
            Verify backup integrity before clearing local data.
          </List.Item>
          <List.Item>
            Contact support if you need help restoring a snapshot.
          </List.Item>
        </List>
        <Group>
          <Button leftSection={<IconDatabaseExport size={16} />} disabled>
            Export backup
          </Button>
          <Button
            variant="default"
            leftSection={<IconDatabaseImport size={16} />}
            disabled
          >
            Restore backup
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}
