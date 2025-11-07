/**
 * Notification Sound Utility
 *
 * This module provides functions to play notification sounds when messages are received.
 * It handles browser permissions, error handling, and volume control.
 */

import { logger } from './logger';

// Base64-encoded notification sound (a simple beep)
// This is a fallback sound that works without external files
const DEFAULT_NOTIFICATION_SOUND = `data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBgoOFhoeJi4yOj5GSlJWXmZqcnZ+goqSlp6ipq62ur7GztLW3uLq7vb6/wcLExcbIycrMzc7Q0dLU1dbY2drb3d7g4eLk5ebn6err7e7w8fL09fb3+fr7/P3+/wAA/v38+/r5+Pf29fTz8vHw7+7t7Ovq6ejn5uXk4+Lh4N/e3dzb2tnY19bV1NPS0dDPzs3My8rJyMfGxcTDwsHAv769vLu6ubi3trW0s7KxsK+urayrqqmop6alpKOioaCfnp2cm5qZmJeWlZSTkpGQj46NjIuKiYiHhoWEg4KBAA==`;

/**
 * Play a notification sound
 *
 * @param soundFile - The name of the sound file in /public/sounds/ or 'default' for built-in sound (default: 'default')
 * @param volume - Volume level from 0.0 to 1.0 (default: 0.5)
 */
export function playNotificationSound(
  soundFile: string = 'default',
  volume: number = 0.5
): void {
  try {
    // Use the default embedded sound or load from public directory
    const audioSrc =
      soundFile === 'default'
        ? DEFAULT_NOTIFICATION_SOUND
        : `/sounds/${soundFile}`;

    // Create audio element
    const audio = new Audio(audioSrc);

    // Set volume (clamp between 0 and 1)
    audio.volume = Math.max(0, Math.min(1, volume));

    // Play the sound
    const playPromise = audio.play();

    // Handle play promise (required for modern browsers)
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Sound played successfully
        })
        .catch((error) => {
          // Auto-play was prevented
          logger.warn('Notification sound playback failed:', error);
        });
    }
  } catch (error) {
    logger.error('Error playing notification sound:', error);
  }
}

/**
 * Play message received sound
 * Uses a predefined sound file for message notifications
 */
export function playMessageSound(): void {
  playNotificationSound('default', 0.6);
}

/**
 * Check if audio playback is supported and enabled
 */
export function isAudioSupported(): boolean {
  return typeof Audio !== 'undefined';
}

/**
 * Request permission to play audio (useful for user interaction requirement)
 * Call this on a user interaction event (like a button click) to enable auto-play
 */
export async function requestAudioPermission(): Promise<boolean> {
  try {
    if (!isAudioSupported()) {
      return false;
    }

    // Play a silent sound to unlock audio in the browser
    const audio = new Audio();
    audio.volume = 0;
    await audio.play();
    audio.pause();

    return true;
  } catch (error) {
    logger.warn('Could not request audio permission:', error);
    return false;
  }
}
