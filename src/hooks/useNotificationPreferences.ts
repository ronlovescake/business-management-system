/**
 * Notification Preferences Hook
 *
 * Manages user preferences for notification sounds and other notification settings
 */

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

export interface NotificationPreferences {
  soundEnabled: boolean;
  volume: number;
  soundFile: string;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  volume: 0.6,
  soundFile: 'default',
};

const STORAGE_KEY = 'notification-preferences';

/**
 * Hook to manage notification preferences
 */
export function useNotificationPreferences() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as NotificationPreferences;
        setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
      }
    } catch (error) {
      logger.error('Failed to load notification preferences:', error);
    }
  }, []);

  // Save preferences to localStorage whenever they change
  const updatePreferences = (
    updates: Partial<NotificationPreferences>
  ): void => {
    setPreferences((prev) => {
      const newPreferences = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
      } catch (error) {
        logger.error('Failed to save notification preferences:', error);
      }
      return newPreferences;
    });
  };

  return {
    preferences,
    updatePreferences,
    setSoundEnabled: (enabled: boolean) =>
      updatePreferences({ soundEnabled: enabled }),
    setVolume: (volume: number) => updatePreferences({ volume }),
    setSoundFile: (soundFile: string) => updatePreferences({ soundFile }),
  };
}
