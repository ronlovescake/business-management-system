'use client';

import { useState, useCallback, useEffect } from 'react';
import { Stack } from '@mantine/core';
import { showNotification } from '@mantine/notifications';
import { api } from '@/lib/api/client';
import type { PitrStatus } from '@/modules/clothing/operations/settings/backup/types';
import { PitrStatusCard } from '@/modules/clothing/operations/settings/components/backup-restore/PitrStatusCard';

export function PitrWalTab() {
  const [pitrStatus, setPitrStatus] = useState<PitrStatus | null>(null);
  const [pitrStatusLoading, setPitrStatusLoading] = useState(false);
  const [pitrCreating, setPitrCreating] = useState(false);

  const fetchPitrStatus = useCallback(async () => {
    setPitrStatusLoading(true);

    try {
      const payload = await api.get<{
        success: boolean;
        status?: PitrStatus;
        error?: string;
      }>('/api/backup/pitr');

      if (!payload.success || !payload.status) {
        throw new Error(payload.error || 'Failed to fetch PITR status');
      }

      setPitrStatus(payload.status ?? null);
    } catch (error) {
      showNotification({
        title: 'PITR status unavailable',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setPitrStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPitrStatus();
  }, [fetchPitrStatus]);

  const handleCreatePitrBaseBackup = useCallback(async () => {
    setPitrCreating(true);

    try {
      const payload = await api.post<{
        success: boolean;
        message?: string;
        error?: string;
        status?: PitrStatus;
      }>('/api/backup/pitr', {});

      if (!payload.success) {
        throw new Error(payload.error || 'Failed to create PITR base backup');
      }

      if (payload.status) {
        setPitrStatus(payload.status);
      } else {
        await fetchPitrStatus();
      }

      showNotification({
        title: 'PITR base backup created',
        message:
          payload.message ||
          'A new physical base backup is available for point-in-time recovery.',
        color: 'green',
      });
    } catch (error) {
      showNotification({
        title: 'PITR base backup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        color: 'red',
      });
    } finally {
      setPitrCreating(false);
    }
  }, [fetchPitrStatus]);

  return (
    <Stack gap="md">
      <PitrStatusCard
        status={pitrStatus}
        loading={pitrStatusLoading}
        creating={pitrCreating}
        onRefresh={() => void fetchPitrStatus()}
        onCreateBaseBackup={() => void handleCreatePitrBaseBackup()}
      />
    </Stack>
  );
}
