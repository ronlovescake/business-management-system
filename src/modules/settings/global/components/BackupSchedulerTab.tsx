'use client';

import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import {
  IconPlayerPlay,
  IconTrash,
  IconVideoPlus,
  IconCalendar,
} from '@tabler/icons-react';

interface BackupSchedule {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  retentionDays: number;
  startDate: Date | null;
  enabled: boolean;
}

type BackupScheduleForm = Omit<BackupSchedule, 'id'>;

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function BackupSchedulerTab() {
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [form, setForm] = useState<BackupScheduleForm>({
    name: '',
    frequency: 'daily',
    time: '02:00',
    retentionDays: 30,
    startDate: null,
    enabled: true,
  });

  const hasSchedules = schedules.length > 0;

  const nextRunSummary = useMemo(() => {
    if (!hasSchedules) {
      return 'No schedules yet';
    }
    const next = schedules[0];
    return `${next.name} — ${next.frequency} @ ${next.time}`;
  }, [hasSchedules, schedules]);

  const handleInputChange = <K extends keyof BackupScheduleForm>(
    key: K,
    value: BackupScheduleForm[K]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddSchedule = () => {
    if (form.name.trim().length === 0) {
      return;
    }

    const newSchedule: BackupSchedule = {
      id: crypto.randomUUID(),
      ...form,
    };

    setSchedules((prev) => [newSchedule, ...prev]);
    setForm((prev) => ({ ...prev, name: '' }));
  };

  const handleToggleSchedule = (id: string) => {
    setSchedules((prev) =>
      prev.map((schedule) =>
        schedule.id === id
          ? { ...schedule, enabled: !schedule.enabled }
          : schedule
      )
    );
  };

  const handleDeleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((schedule) => schedule.id !== id));
  };

  return (
    <Stack gap="lg">
      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <div>
              <Text fw={600}>Create Backup Schedule</Text>
              <Text c="dimmed" size="sm">
                Define when automated backups should run and how long we keep
                them.
              </Text>
            </div>
            <Button
              leftSection={<IconVideoPlus size={16} />}
              onClick={handleAddSchedule}
              disabled={form.name.trim().length === 0}
            >
              Add schedule
            </Button>
          </Group>

          <Group gap="md" align="flex-end" wrap="wrap">
            <TextInput
              label="Schedule name"
              placeholder="Nightly database backup"
              value={form.name}
              onChange={(event) =>
                handleInputChange('name', event.target.value)
              }
              required
              style={{ flex: 1, minWidth: 240 }}
            />
            <Select
              label="Frequency"
              data={FREQUENCY_OPTIONS}
              value={form.frequency}
              onChange={(value) =>
                handleInputChange(
                  'frequency',
                  value as BackupSchedule['frequency']
                )
              }
              required
              style={{ minWidth: 160 }}
            />
            <TextInput
              label="Time"
              type="time"
              value={form.time}
              onChange={(event) =>
                handleInputChange('time', event.target.value)
              }
              required
              style={{ minWidth: 140 }}
            />
            <NumberInput
              label="Retention (days)"
              min={1}
              value={form.retentionDays}
              onChange={(value) =>
                handleInputChange('retentionDays', Number(value) || 1)
              }
              required
              style={{ minWidth: 160 }}
            />
            <DateInput
              label="Start date"
              value={form.startDate}
              onChange={(value) => handleInputChange('startDate', value)}
              leftSection={<IconCalendar size={16} />}
              style={{ minWidth: 180 }}
            />
            <Switch
              label="Enabled"
              checked={form.enabled}
              onChange={(event) =>
                handleInputChange('enabled', event.currentTarget.checked)
              }
            />
          </Group>
        </Stack>
      </Paper>

      <Paper withBorder p="lg" radius="md">
        <Stack gap="sm">
          <Group justify="space-between" align="center">
            <div>
              <Text fw={600}>Backup Schedules</Text>
              <Text size="sm" c="dimmed">
                {nextRunSummary}
              </Text>
            </div>
          </Group>

          {hasSchedules ? (
            <Table.ScrollContainer minWidth={600}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Frequency</Table.Th>
                    <Table.Th>Runtime</Table.Th>
                    <Table.Th>Retention</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th align="right">Actions</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {schedules.map((schedule) => (
                    <Table.Tr key={schedule.id}>
                      <Table.Td>
                        <Text fw={500}>{schedule.name}</Text>
                        <Text size="sm" c="dimmed">
                          {schedule.startDate
                            ? schedule.startDate.toLocaleDateString()
                            : 'Starts immediately'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge>
                          {FREQUENCY_OPTIONS.find(
                            (option) => option.value === schedule.frequency
                          )?.label || schedule.frequency}
                        </Badge>
                      </Table.Td>
                      <Table.Td>{schedule.time}</Table.Td>
                      <Table.Td>{schedule.retentionDays} days</Table.Td>
                      <Table.Td>
                        <Badge color={schedule.enabled ? 'green' : 'gray'}>
                          {schedule.enabled ? 'Enabled' : 'Paused'}
                        </Badge>
                      </Table.Td>
                      <Table.Td align="right">
                        <Group gap="xs" justify="flex-end">
                          <ActionIcon
                            variant="subtle"
                            color="blue"
                            onClick={() => handleToggleSchedule(schedule.id)}
                          >
                            <IconPlayerPlay size={16} />
                          </ActionIcon>
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleDeleteSchedule(schedule.id)}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ) : (
            <Paper
              withBorder
              p="lg"
              radius="md"
              style={{ textAlign: 'center' }}
            >
              <Stack gap="xs" align="center">
                <Text fw={500}>No schedules yet</Text>
                <Text size="sm" c="dimmed">
                  Use the form above to automate your backup process.
                </Text>
              </Stack>
            </Paper>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
