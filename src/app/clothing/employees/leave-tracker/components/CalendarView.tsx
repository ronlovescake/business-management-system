import React, { useState } from 'react';
import {
  Card,
  Stack,
  Title,
  Text,
  Badge,
  Group,
  SimpleGrid,
  Box,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import type { LeaveRequest, LeaveType } from '../types';

interface CalendarViewProps {
  leaveRequests: LeaveRequest[];
  formatDate: (date: string) => string;
  getLeaveTypeColor: (leaveType: LeaveType) => string;
}

export function CalendarView({
  leaveRequests,
  formatDate,
  getLeaveTypeColor,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const currentYear = selectedDate?.getFullYear() || new Date().getFullYear();

  // Get all months for the year
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(currentYear, i, 1);
    return date;
  });

  // Helper to check if a date has leave requests
  const getLeaveRequestsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return leaveRequests.filter((request) => {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const current = new Date(dateStr);
      return current >= start && current <= end;
    });
  };

  // Helper to render day with indicators
  const renderDay = (date: Date) => {
    const requests = getLeaveRequestsForDate(date);

    if (requests.length === 0) {
      return null;
    }

    return (
      <Box
        style={{
          position: 'absolute',
          bottom: 2,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 2,
        }}
      >
        {requests.slice(0, 3).map((request) => (
          <Box
            key={request.id}
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              backgroundColor: `var(--mantine-color-${getLeaveTypeColor(request.leaveType)}-6)`,
            }}
          />
        ))}
      </Box>
    );
  };

  // Get requests for selected date
  const selectedDateRequests = selectedDate
    ? getLeaveRequestsForDate(selectedDate)
    : [];

  return (
    <Card
      padding="lg"
      radius="xl"
      style={{
        background: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(15px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.2)',
      }}
    >
      <Stack gap="lg">
        <Title
          order={3}
          style={{
            color: 'rgba(255, 255, 255, 0.95)',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          Leave Calendar - {currentYear}
        </Title>

        {/* Year View - 12 Month Grid */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
          {months.map((monthDate) => (
            <Box
              key={monthDate.getMonth()}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '8px',
              }}
            >
              <DatePicker
                type="default"
                value={selectedDate}
                onChange={setSelectedDate}
                defaultDate={monthDate}
                size="xs"
                hideOutsideDates
                renderDay={(date: Date) => (
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    {renderDay(date)}
                  </div>
                )}
              />
            </Box>
          ))}
        </SimpleGrid>

        {/* Selected Date Details */}
        {selectedDate && selectedDateRequests.length > 0 && (
          <Card
            padding="md"
            radius="md"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <Stack gap="sm">
              <Title order={5} c="white">
                Leave Requests on{' '}
                {formatDate(selectedDate.toISOString().split('T')[0])}
              </Title>
              {selectedDateRequests.map((request) => (
                <Group key={request.id} justify="space-between">
                  <div>
                    <Text fw={600} c="white">
                      {request.employeeName}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {request.reason}
                    </Text>
                  </div>
                  <Group gap="xs">
                    <Badge
                      color={getLeaveTypeColor(request.leaveType)}
                      variant="light"
                    >
                      {request.leaveType}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      {request.numberOfDays}{' '}
                      {request.numberOfDays === 1 ? 'day' : 'days'}
                    </Text>
                  </Group>
                </Group>
              ))}
            </Stack>
          </Card>
        )}

        {/* Legend */}
        <Card
          padding="sm"
          radius="md"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Group gap="md">
            <Text size="sm" fw={600} c="white">
              Legend:
            </Text>
            {['Sick Leave', 'Vacation Leave', 'Emergency Leave', 'Other'].map(
              (type) => (
                <Group key={type} gap={4}>
                  <Box
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: `var(--mantine-color-${getLeaveTypeColor(type as LeaveType)}-6)`,
                    }}
                  />
                  <Text size="xs" c="dimmed">
                    {type}
                  </Text>
                </Group>
              )
            )}
          </Group>
        </Card>

        {/* Summary */}
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Click on any date to see leave details
          </Text>
          <Text size="sm" fw={600} c="white">
            Total Requests: {leaveRequests.length}
          </Text>
        </Group>
      </Stack>
    </Card>
  );
}
