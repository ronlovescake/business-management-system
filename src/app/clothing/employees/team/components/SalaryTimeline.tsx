'use client';

import React, { useState, useEffect } from 'react';
import {
  Stack,
  Card,
  Group,
  Title,
  Text,
  Divider,
  Button,
  Timeline,
  TextInput,
  NumberInput,
  Textarea,
  Center,
  Loader,
  ScrollArea,
  Badge,
} from '@mantine/core';
import {
  IconPlus,
  IconCalendar,
  IconCurrencyPeso,
  IconTrendingUp,
} from '@tabler/icons-react';
import { DateInput } from '@mantine/dates';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';
import { buildApiPath } from '@/lib/api/paths';
import { showNotification } from '@mantine/notifications';
import type { ApiResponse } from '@/types/api';
import { UniversalModal } from '@/components/modals/UniversalModal';

interface SalaryHistoryRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  effectiveDate: string;
  basicSalary: number;
  allowance: number;
  totalSalary: number;
  reason?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface SalaryTimelineProps {
  employeeId: string;
  currentBasicSalary: number;
  currentAllowance: number;
  apiBasePath?: string;
}

export function SalaryTimeline({
  employeeId,
  currentBasicSalary,
  currentAllowance,
  apiBasePath,
}: SalaryTimelineProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState<Date | null>(new Date());
  const [basicSalary, setBasicSalary] = useState<number | string>(
    currentBasicSalary || 0
  );
  const [allowance, setAllowance] = useState<number | string>(
    currentAllowance || 0
  );
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch salary history
  const fetchSalaryHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        buildApiPath(apiBasePath, `/employees/${employeeId}/salary-history`)
      );
      const result = (await response.json()) as ApiResponse<
        SalaryHistoryRecord[]
      >;

      if (response.ok && result.success && Array.isArray(result.data)) {
        setSalaryHistory(result.data);
      } else {
        throw new Error(result.error || 'Failed to load salary history');
      }
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to load salary history',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSalaryHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleSubmit = async () => {
    if (!effectiveDate) {
      showNotification({
        title: 'Validation Error',
        message: 'Please select an effective date',
        color: 'red',
      });
      return;
    }

    if (!basicSalary || basicSalary === 0) {
      showNotification({
        title: 'Validation Error',
        message: 'Basic salary must be greater than zero',
        color: 'red',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        buildApiPath(apiBasePath, `/employees/${employeeId}/salary-history`),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            effectiveDate: effectiveDate.toISOString().split('T')[0],
            basicSalary: Number(basicSalary),
            allowance: Number(allowance) || 0,
            reason: reason || null,
            notes: notes || null,
          }),
        }
      );
      const result =
        (await response.json()) as ApiResponse<SalaryHistoryRecord>;

      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to add salary record');
      }

      showNotification({
        title: 'Success',
        message: 'Salary adjustment added successfully',
        color: 'green',
      });

      // Refresh the data
      await fetchSalaryHistory();

      // Reset form
      setIsModalOpen(false);
      setEffectiveDate(new Date());
      setBasicSalary(currentBasicSalary || 0);
      setAllowance(currentAllowance || 0);
      setReason('');
      setNotes('');
    } catch (error) {
      showNotification({
        title: 'Error',
        message:
          error instanceof Error
            ? error.message
            : 'Failed to add salary adjustment',
        color: 'red',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateIncrease = (current: number, previous: number) => {
    if (!previous) {
      return null;
    }
    const increase = current - previous;
    const percentage = ((increase / previous) * 100).toFixed(1);
    return { amount: increase, percentage };
  };

  return (
    <>
      <Stack gap="lg">
        <Card withBorder padding="lg">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={4}>Salary Timeline</Title>
              <Text size="sm" c="dimmed">
                Track base salary and allowance adjustments over time
              </Text>
            </div>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setIsModalOpen(true)}
            >
              Add Adjustment
            </Button>
          </Group>
          <Divider my="md" />

          {isLoading ? (
            <Center py="xl">
              <Loader size="sm" />
            </Center>
          ) : !salaryHistory || salaryHistory.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <IconCurrencyPeso size={48} stroke={1.5} color="gray" />
                <Text c="dimmed" size="sm">
                  No salary history recorded yet
                </Text>
                <Text c="dimmed" size="xs">
                  Click &quot;Add Adjustment&quot; to record the first salary
                  entry
                </Text>
              </Stack>
            </Center>
          ) : (
            <ScrollArea h="70vh">
              <Timeline
                active={salaryHistory.length - 1}
                bulletSize={24}
                lineWidth={2}
              >
                {salaryHistory.map(
                  (entry: SalaryHistoryRecord, index: number) => {
                    const previousEntry = salaryHistory[index + 1];
                    const increase = previousEntry
                      ? calculateIncrease(
                          entry.totalSalary,
                          previousEntry.totalSalary
                        )
                      : null;

                    return (
                      <Timeline.Item
                        key={entry.id}
                        bullet={<IconCalendar size={12} />}
                        title={
                          <Group gap="xs">
                            <Text fw={600}>
                              {formatDate(entry.effectiveDate)}
                            </Text>
                            {index === 0 && (
                              <Badge size="sm" color="blue">
                                Current
                              </Badge>
                            )}
                          </Group>
                        }
                      >
                        <Stack gap="xs" mt="xs">
                          {entry.reason && (
                            <Group gap="xs">
                              <IconTrendingUp size={14} />
                              <Text size="sm" fw={500}>
                                {entry.reason}
                              </Text>
                            </Group>
                          )}

                          <Group gap="md">
                            <div>
                              <Text size="xs" c="dimmed">
                                Basic Salary
                              </Text>
                              <Text size="sm" fw={600}>
                                {formatCurrency(entry.basicSalary)}
                              </Text>
                            </div>
                            <div>
                              <Text size="xs" c="dimmed">
                                Allowance
                              </Text>
                              <Text size="sm" fw={600}>
                                {formatCurrency(entry.allowance)}
                              </Text>
                            </div>
                            <div>
                              <Text size="xs" c="dimmed">
                                Total
                              </Text>
                              <Text size="sm" fw={700} c="blue">
                                {formatCurrency(entry.totalSalary)}
                              </Text>
                            </div>
                          </Group>

                          {increase && (
                            <Group gap="xs">
                              <Badge
                                size="sm"
                                color={increase.amount > 0 ? 'green' : 'red'}
                              >
                                {increase.amount > 0 ? '+' : ''}
                                {formatCurrency(increase.amount)} (
                                {increase.percentage}%)
                              </Badge>
                            </Group>
                          )}

                          {entry.notes && (
                            <Text size="xs" c="dimmed" fs="italic">
                              {entry.notes}
                            </Text>
                          )}

                          <Text size="xs" c="dimmed">
                            Added on {formatDate(entry.createdAt)}
                          </Text>
                        </Stack>
                      </Timeline.Item>
                    );
                  }
                )}
              </Timeline>
            </ScrollArea>
          )}
        </Card>
      </Stack>

      <UniversalModal
        opened={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Salary Adjustment"
        size="md"
      >
        <Stack gap="md">
          <DateInput
            label="Effective Date"
            placeholder="Select date"
            value={effectiveDate}
            onChange={setEffectiveDate}
            required
            leftSection={<IconCalendar size={16} />}
            {...COMMON_DATE_INPUT_PROPS}
          />

          <NumberInput
            label="Basic Salary"
            placeholder="Enter basic salary"
            value={basicSalary}
            onChange={setBasicSalary}
            required
            min={0}
            prefix="₱"
            thousandSeparator=","
            decimalScale={2}
          />

          <NumberInput
            label="Allowance"
            placeholder="Enter allowance"
            value={allowance}
            onChange={setAllowance}
            min={0}
            prefix="₱"
            thousandSeparator=","
            decimalScale={2}
          />

          <TextInput
            label="Reason"
            placeholder="e.g., Annual Increase, Promotion, Initial Salary"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
          />

          <Textarea
            label="Notes"
            placeholder="Optional notes about this adjustment"
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            rows={3}
          />

          <Group justify="flex-end" mt="md">
            <Button
              variant="subtle"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={isSubmitting}>
              Add Adjustment
            </Button>
          </Group>
        </Stack>
      </UniversalModal>
    </>
  );
}
