'use client';

import { Badge, Group, Paper, Stack, Text } from '@mantine/core';

export function BackupSchedulerTab() {
  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <div>
              <Text fw={600}>Server-Side Backup Scheduler</Text>
              <Text c="dimmed" size="sm">
                Automated disaster-recovery backups are managed by the Docker
                `backup-scheduler` service.
              </Text>
            </div>
            <Badge color="teal">Phase 1</Badge>
          </Group>

          <Text size="sm">
            Configure `.env.docker` with `BACKUP_AUTO_ENABLED`,
            `BACKUP_AUTO_TIME`, `BACKUP_DIFF_AUTO_ENABLED`,
            `BACKUP_DIFF_AUTO_TIME`, `BACKUP_AUTO_TIMEZONE`, and
            `BACKUP_RETENTION_DAYS`, then run the `backup-scheduler` service
            alongside the app.
          </Text>

          <Text size="sm" c="dimmed">
            This phase intentionally keeps scheduling out of browser state so
            backups continue even when no admin page is open, including one
            startup catch-up run after downtime.
          </Text>
        </Stack>
      </Paper>
    </Stack>
  );
}
