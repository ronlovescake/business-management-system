'use client';

import { Accordion, Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { IconBuildingStore, IconShirt, IconTruck } from '@tabler/icons-react';
import { EmployeeAutomationSettingsPage } from '@/app/employees/_shared/EmployeeAutomationSettingsPage';

export function SchedulerTab() {
  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <div>
              <Text fw={600}>Backup Scheduler</Text>
              <Text c="dimmed" size="sm">
                Automated disaster-recovery backups are managed by the Docker
                backup-scheduler service.
              </Text>
            </div>
            <Badge color="teal">Docker</Badge>
          </Group>

          <Text size="sm">
            Configure <code>.env.docker</code> with{' '}
            <code>BACKUP_AUTO_ENABLED</code>, <code>BACKUP_AUTO_TIME</code>,{' '}
            <code>BACKUP_DIFF_AUTO_ENABLED</code>,{' '}
            <code>BACKUP_DIFF_AUTO_TIME</code>,{' '}
            <code>BACKUP_AUTO_TIMEZONE</code>, and{' '}
            <code>BACKUP_RETENTION_DAYS</code>, then run the{' '}
            <code>backup-scheduler</code> service alongside the app.
          </Text>

          <Text size="sm" c="dimmed">
            Scheduling stays in Docker so backups continue even when no admin
            page is open, including one startup catch-up run after downtime.
          </Text>
        </Stack>
      </Paper>

      <div>
        <Text fw={600} size="lg" mb="sm">
          Employee Automation
        </Text>
        <Text c="dimmed" size="sm" mb="md">
          Manage stay-in attendance and payroll generation automations for each
          business domain. Open a section to configure settings, trigger manual
          runs, and review execution history.
        </Text>

        <Accordion variant="separated" radius="md" defaultValue="clothing">
          <Accordion.Item value="clothing">
            <Accordion.Control icon={<IconShirt size={20} />}>
              Clothing
            </Accordion.Control>
            <Accordion.Panel>
              <EmployeeAutomationSettingsPage embedded />
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="trucking">
            <Accordion.Control icon={<IconTruck size={20} />}>
              Trucking
            </Accordion.Control>
            <Accordion.Panel>
              <EmployeeAutomationSettingsPage
                apiBasePath="/api/trucking"
                embedded
              />
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="general-merchandise">
            <Accordion.Control icon={<IconBuildingStore size={20} />}>
              General Merchandise
            </Accordion.Control>
            <Accordion.Panel>
              <EmployeeAutomationSettingsPage
                apiBasePath="/api/general-merchandise"
                embedded
              />
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </div>
    </Stack>
  );
}
