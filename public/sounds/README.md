# Notification Sounds

This directory contains audio files used for notifications in the application.

## Files

- `notification.mp3` - Default notification sound for new messages

## Usage

Sounds are played using the `playNotificationSound()` function from `@/lib/notificationSound`.

## Adding Custom Sounds

To add a custom notification sound:

1. Place your audio file (.mp3, .ogg, or .wav) in this directory
2. Use the filename when calling `playNotificationSound('your-sound.mp3')`

## Browser Compatibility

- MP3: Supported by all modern browsers
- OGG: Supported by Firefox, Chrome, Opera
- WAV: Supported by most browsers but larger file size

For best compatibility, use MP3 format.
