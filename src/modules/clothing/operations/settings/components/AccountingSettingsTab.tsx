'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Stack,
  Title,
  Text,
  Button,
  Paper,
  Group,
  Loader,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { showNotification } from '@mantine/notifications';
import { logger } from '@/lib/logger';
import { COMMON_DATE_INPUT_PROPS } from '@/lib/dateInputConfig';

type AccountingSettings = {
  id: string;
  clothingCutoverDate: string;
  generalMerchandiseCutoverDate: string;
  createdAt: string;
  updatedAt: string;
};

function parseDateOnly(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const dt = new Date(y, m - 1, d);

  if (
    Number.isNaN(dt.getTime()) ||
    dt.getFullYear() !== y ||
    dt.getMonth() !== m - 1 ||
    dt.getDate() !== d
  ) {
    return null;
  }

  return dt;
}

function formatDateOnly(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function AccountingSettingsTab() {
  const [settings, setSettings] = useState<AccountingSettings | null>(null);
  const [clothingCutoverDate, setClothingCutoverDate] = useState<Date | null>(
    null
  );
  const [generalMerchandiseCutoverDate, setGeneralMerchandiseCutoverDate] =
    useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/settings/accounting');
        if (!response.ok) {
          throw new Error('Failed to fetch accounting settings');
        }

        const data = (await response.json()) as AccountingSettings;
        setSettings(data);
        setClothingCutoverDate(parseDateOnly(data.clothingCutoverDate));
        setGeneralMerchandiseCutoverDate(
          parseDateOnly(data.generalMerchandiseCutoverDate)
        );
      } catch (error) {
        logger.error('Error fetching accounting settings:', error);
        showNotification({
          title: '❌ Error',
          message: 'Failed to load accounting settings',
          color: 'red',
          autoClose: 4000,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const hasChanges = useMemo(() => {
    if (!settings || !clothingCutoverDate || !generalMerchandiseCutoverDate) {
      return false;
    }

    return (
      formatDateOnly(clothingCutoverDate) !== settings.clothingCutoverDate ||
      formatDateOnly(generalMerchandiseCutoverDate) !==
        settings.generalMerchandiseCutoverDate
    );
  }, [settings, clothingCutoverDate, generalMerchandiseCutoverDate]);

  const handleSave = async () => {
    if (!clothingCutoverDate || !generalMerchandiseCutoverDate) {
      showNotification({
        title: '❌ Invalid Date',
        message: 'Please pick a valid cutover date.',
        color: 'red',
        autoClose: 4000,
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/settings/accounting', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clothingCutoverDate: formatDateOnly(clothingCutoverDate),
          generalMerchandiseCutoverDate: formatDateOnly(
            generalMerchandiseCutoverDate
          ),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save accounting settings');
      }

      const updated = (await response.json()) as AccountingSettings;
      setSettings(updated);
      setClothingCutoverDate(parseDateOnly(updated.clothingCutoverDate));
      setGeneralMerchandiseCutoverDate(
        parseDateOnly(updated.generalMerchandiseCutoverDate)
      );

      showNotification({
        title: '✅ Settings Saved',
        message: 'Accounting cutover dates updated for Clothing and GM.',
        color: 'green',
        autoClose: 5000,
      });
    } catch (error) {
      logger.error('Error saving accounting settings:', error);
      showNotification({
        title: '❌ Save Failed',
        message: 'Failed to save accounting settings',
        color: 'red',
        autoClose: 4000,
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Stack align="center" py="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading settings...</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="lg">
      <div>
        <Title order={3} style={{ color: '#1e293b', fontWeight: 600 }}>
          Accounting Settings
        </Title>
        <Text size="sm" c="dimmed" mt="xs">
          Configure accounting behavior for Clothing and General Merchandise.
        </Text>
      </div>

      <Paper p="lg" withBorder radius="md" shadow="xs">
        <Stack gap="md">
          <Text fw={600}>Clothing Cutover Date</Text>
          <Text size="sm" c="dimmed">
            Transactions before this date are excluded from accounting reports.
          </Text>

          <DateInput
            value={clothingCutoverDate}
            onChange={setClothingCutoverDate}
            placeholder="Pick cutover date"
            aria-label="Clothing accounting cutover date"
            valueFormat="MMMM D, YYYY"
            clearable={false}
            {...COMMON_DATE_INPUT_PROPS}
          />

          <Text fw={600}>General Merchandise Cutover Date</Text>
          <Text size="sm" c="dimmed">
            Transactions before this date are excluded from GM accounting
            reports.
          </Text>

          <DateInput
            value={generalMerchandiseCutoverDate}
            onChange={setGeneralMerchandiseCutoverDate}
            placeholder="Pick GM cutover date"
            aria-label="General merchandise accounting cutover date"
            valueFormat="MMMM D, YYYY"
            clearable={false}
            {...COMMON_DATE_INPUT_PROPS}
          />

          <Group justify="flex-end">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={isSaving}
              disabled={
                !hasChanges ||
                !clothingCutoverDate ||
                !generalMerchandiseCutoverDate
              }
            >
              Save Cutover Dates
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
