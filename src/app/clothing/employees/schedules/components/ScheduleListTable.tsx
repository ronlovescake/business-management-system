import {
  Stack,
  Card,
  Box,
  Table,
  Badge,
  Text,
  Group,
  ActionIcon,
  Menu,
} from '@mantine/core';
import {
  IconDots,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import type { Schedule, ScheduleStatus, ShiftType } from '../types';

interface ScheduleListTableProps {
  schedules: Schedule[];
  formatDate: (date: string) => string;
  formatTime: (time: string) => string;
  getStatusColor: (status: ScheduleStatus) => string;
  getShiftTypeColor: (shiftType: ShiftType) => string;
  calculateDuration: (startTime: string, endTime: string) => number;
  onEdit: (schedule: Schedule) => void;
  onDelete: (id: string) => void;
  onMarkCompleted: (id: string) => void;
  onMarkCancelled: (id: string) => void;
}

/**
 * ScheduleListTable Component
 *
 * Renders the main schedule list table with:
 * - Date, Employee, Shift Type, Time, Duration, Position, Status, Notes, Actions
 * - Mark Completed/Cancelled buttons for scheduled shifts
 * - Edit and Delete actions
 */
export function ScheduleListTable({
  schedules,
  formatDate,
  formatTime,
  getStatusColor,
  getShiftTypeColor,
  calculateDuration,
  onEdit,
  onDelete,
  onMarkCompleted,
  onMarkCancelled,
}: ScheduleListTableProps) {
  return (
    <Stack gap="md">
      <Card withBorder radius="md" p={0}>
        <Box
          style={{
            overflowX: 'auto',
            minHeight: '60vh',
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
        >
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>DATE</Table.Th>
                <Table.Th>EMPLOYEE</Table.Th>
                <Table.Th>SHIFT TYPE</Table.Th>
                <Table.Th>START TIME</Table.Th>
                <Table.Th>END TIME</Table.Th>
                <Table.Th>DURATION</Table.Th>
                <Table.Th>POSITION</Table.Th>
                <Table.Th>STATUS</Table.Th>
                <Table.Th>NOTES</Table.Th>
                <Table.Th>ACTIONS</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {schedules.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={10} style={{ textAlign: 'center' }}>
                    <Text c="dimmed" size="sm" py="xl">
                      No schedules found
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                schedules.map((schedule) => (
                  <Table.Tr key={schedule.id}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {formatDate(schedule.date)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500}>
                          {schedule.employeeName}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {schedule.employeeId}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={getShiftTypeColor(schedule.shiftType)}
                        variant="light"
                        size="sm"
                        tt="capitalize"
                      >
                        {schedule.shiftType.replace('-', ' ')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatTime(schedule.startTime)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatTime(schedule.endTime)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {calculateDuration(
                          schedule.startTime,
                          schedule.endTime
                        ).toFixed(1)}
                        h
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <Text size="sm">{schedule.position}</Text>
                        <Text size="xs" c="dimmed">
                          {schedule.department}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={getStatusColor(schedule.status)}
                        variant="light"
                        size="sm"
                        tt="capitalize"
                      >
                        {schedule.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed" lineClamp={1}>
                        {schedule.notes || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="center">
                        <Menu position="bottom-end" withinPortal>
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray">
                              <IconDots size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item
                              leftSection={<IconEdit size={16} />}
                              onClick={() => onEdit(schedule)}
                            >
                              Edit
                            </Menu.Item>
                            {schedule.status === 'scheduled' && (
                              <>
                                <Menu.Item
                                  leftSection={<IconCheck size={16} />}
                                  onClick={() => onMarkCompleted(schedule.id)}
                                >
                                  Mark Completed
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconX size={16} />}
                                  onClick={() => onMarkCancelled(schedule.id)}
                                >
                                  Mark Cancelled
                                </Menu.Item>
                              </>
                            )}
                            <Menu.Divider />
                            <Menu.Item
                              leftSection={<IconTrash size={16} />}
                              color="red"
                              onClick={() => onDelete(schedule.id)}
                            >
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Box>
      </Card>
    </Stack>
  );
}
