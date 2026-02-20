/**
 * Notification Sound Utility
 *
 * This module provides functions to play notification sounds when messages are received.
 * It handles browser permissions, error handling, and volume control.
 */

import { logger } from './logger';

// Global audio context instance (reused to avoid creating multiple contexts)
let audioContext: AudioContext | null = null;
let isAudioContextInitialized = false;

const getAudioContextConstructor = (): typeof AudioContext | undefined => {
  const nativeAudioContext =
    typeof AudioContext !== 'undefined' ? AudioContext : undefined;
  const globalWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  return nativeAudioContext || globalWindow.webkitAudioContext;
};

/**
 * Initialize the audio context on first user interaction
 * This is required due to browser auto-play policies
 */
export function initializeAudioContext(): void {
  if (isAudioContextInitialized) {
    return;
  }

  try {
    if (!audioContext) {
      const AudioContextCtor = getAudioContextConstructor();
      if (!AudioContextCtor) {
        throw new Error('AudioContext is not available in this browser.');
      }
      audioContext = new AudioContextCtor();
    }

    // Resume the context in case it's suspended (browser auto-play policy)
    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    isAudioContextInitialized = true;
    logger.info('Audio context initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize audio context:', error);
  }
}

/**
 * Play a notification sound using Web Audio API
 */
function playWebAudioNotification(volume: number = 0.7): void {
  try {
    // Create audio context if it doesn't exist
    if (!audioContext) {
      const AudioContextCtor = getAudioContextConstructor();
      if (!AudioContextCtor) {
        throw new Error('AudioContext is not available in this browser.');
      }
      audioContext = new AudioContextCtor();
    }

    // Resume context if suspended (handles auto-play policy)
    if (audioContext.state === 'suspended') {
      void audioContext.resume();
    }

    // Create oscillator for the beep sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Configure the sound (800Hz sine wave)
    oscillator.type = 'sine';
    oscillator.frequency.value = 800; // 800Hz

    // Set volume with envelope (fade in/out)
    const now = audioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.01); // Fade in
    gainNode.gain.linearRampToValueAtTime(volume, now + 0.1); // Sustain
    gainNode.gain.linearRampToValueAtTime(0, now + 0.15); // Fade out

    // Play the sound
    oscillator.start(now);
    oscillator.stop(now + 0.15); // 150ms duration

    // Clean up
    oscillator.onended = () => {
      gainNode.disconnect();
      oscillator.disconnect();
    };
  } catch (error) {
    logger.error('Failed to play Web Audio notification:', error);
  }
}

/**
 * Play a notification sound
 *
 * @param soundFile - The name of the sound file in /public/sounds/ or 'default' for built-in sound (default: 'default')
 * @param volume - Volume level from 0.0 to 1.0 (default: 0.6)
 */
export function playNotificationSound(
  soundFile: string = 'default',
  volume: number = 0.6
): void {
  try {
    // For default sound, use Web Audio API for better reliability
    if (soundFile === 'default') {
      playWebAudioNotification(volume);
      return;
    }

    // For custom sound files, use Audio element
    const audioSrc = `/sounds/${soundFile}`;
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
 * Uses Web Audio API for reliable playback
 */
export function playMessageSound(): void {
  logger.info('Playing message notification sound');
  playNotificationSound('default', 0.7);
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
