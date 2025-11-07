# Messaging Notification Sound Feature

## Overview

The messaging system now includes audio notifications that play when you receive new messages. This helps you stay aware of incoming messages even when you're focused on other tasks.

## Features

### 🔔 Automatic Sound Notifications

- A pleasant notification sound plays automatically when someone sends you a message
- Sound only plays for messages from other users (not your own messages)
- Works in real-time as messages arrive

### 🔇 Mute/Unmute Toggle

- Click the volume icon in the top-right corner of the conversations panel to toggle sounds on/off
- Your preference is saved locally and persists across sessions
- Visual indicator shows whether notifications are muted or active:
  - **Blue volume icon**: Sounds enabled
  - **Gray muted icon**: Sounds disabled

### ⚙️ User Preferences

- Notification sound preference is stored in your browser's local storage
- Settings persist even after closing and reopening the app
- Each user can have their own preference

## Technical Details

### Components

1. **Notification Sound Utility** (`src/lib/notificationSound.ts`)
   - Core audio playback functionality
   - Built-in default notification sound (no external file needed)
   - Support for custom sound files
   - Error handling and browser compatibility

2. **Notification Preferences Hook** (`src/hooks/useNotificationPreferences.ts`)
   - Manages user preferences for notification sounds
   - Handles localStorage persistence
   - Provides easy-to-use interface for toggling settings

3. **Updated Messaging Page** (`src/app/clothing/operations/messaging/MessagingClientPage.tsx`)
   - Integrated notification sound on message receipt
   - Added mute/unmute toggle button
   - Real-time preference updates

### Sound File Options

The system supports multiple sound sources:

1. **Default Built-in Sound** (recommended)
   - Embedded as a base64-encoded WAV file
   - No external file required
   - Works immediately without setup

2. **Custom Sound Files**
   - Place MP3, OGG, or WAV files in `public/sounds/`
   - Reference by filename in the code
   - Best format: MP3 for browser compatibility

### Usage in Code

```typescript
import {
  playNotificationSound,
  playMessageSound,
} from '@/lib/notificationSound';

// Play default notification sound
playMessageSound();

// Play custom sound with volume control
playNotificationSound('custom-sound.mp3', 0.8);

// Use notification preferences
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

const { preferences, setSoundEnabled } = useNotificationPreferences();

// Check if sound is enabled
if (preferences.soundEnabled) {
  playMessageSound();
}

// Toggle sound
setSoundEnabled(!preferences.soundEnabled);
```

## Browser Compatibility

### Audio Playback

- ✅ Chrome/Edge: Full support
- ✅ Firefox: Full support
- ✅ Safari: Full support (may require user interaction first)
- ✅ Mobile browsers: Supported with user gesture requirement

### Auto-play Policy

Modern browsers require user interaction before audio can play automatically. The first notification sound may not play until you interact with the page (click, type, etc.). Subsequent notifications will work normally.

## User Guide

### Enabling/Disabling Sounds

1. **To Mute Notifications:**
   - Click the blue volume icon (🔊) in the conversations panel header
   - The icon will change to gray (🔇) indicating sounds are off

2. **To Unmute Notifications:**
   - Click the gray muted icon (🔇)
   - The icon will change to blue (🔊) indicating sounds are on

### Troubleshooting

**Sound not playing?**

1. Check that your browser sound is not muted
2. Ensure the volume icon shows blue (enabled)
3. Try clicking anywhere on the page to allow audio (browser auto-play policy)
4. Check your system volume settings

**Sound too loud/quiet?**

- Currently uses a default volume of 60%
- Future updates may include volume control slider

## Future Enhancements

Potential improvements for the notification sound system:

- [ ] Volume slider for custom volume levels
- [ ] Multiple notification sound options
- [ ] Different sounds for different message types
- [ ] Browser notification API integration
- [ ] Desktop notifications with sound
- [ ] Sound preview in settings
- [ ] Per-conversation notification preferences

## Related Files

- `src/lib/notificationSound.ts` - Core sound playback utility
- `src/hooks/useNotificationPreferences.ts` - Preferences management hook
- `src/app/clothing/operations/messaging/MessagingClientPage.tsx` - Main messaging UI
- `public/sounds/` - Directory for custom sound files
- `scripts/generate-notification-sound.html` - Sound generation utility

## Testing

To test the notification sound feature:

1. Open the messaging page with two different user accounts (use two browsers)
2. Send a message from one account to the other
3. Verify that:
   - Visual notification appears
   - Sound plays (if not muted)
   - Mute toggle works correctly
   - Preference persists after page refresh

## Implementation Notes

- Sound playback uses the Web Audio API for reliability
- Preferences stored in localStorage with key `notification-preferences`
- Default sound is a 400ms double-beep (800Hz + 600Hz sine waves)
- Error handling prevents crashes if audio playback fails
- Logging uses application logger for debugging
