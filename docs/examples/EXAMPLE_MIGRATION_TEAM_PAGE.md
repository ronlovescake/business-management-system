# Example Migration: Employee Team Detail Page

## File: `/src/app/clothing/employees/team/[id]/page.tsx`

### Step 1: Add Import

**Add this import at the top of the file (around line 4):**

```typescript
import { showError } from '@/lib/alerts';
```

### Step 2: Replace Alert #1 (Line 97)

**Before:**

```typescript
if (file.size > MAX_PROFILE_PHOTO_SIZE) {
  alert('Please select an image that is 2MB or smaller.');
  return;
}
```

**After:**

```typescript
if (file.size > MAX_PROFILE_PHOTO_SIZE) {
  await showError(
    'Please select an image that is 2MB or smaller.',
    'File Size Error'
  );
  return;
}
```

### Step 3: Replace Alert #2 (Line 106)

**Before:**

```typescript
} catch (error) {
  logger.error('Failed to upload profile photo:', error);
  alert('Failed to upload profile photo. Please try again.');
}
```

**After:**

```typescript
} catch (error) {
  logger.error('Failed to upload profile photo:', error);
  await showError(
    'Failed to upload profile photo. Please try again.',
    'Upload Failed'
  );
}
```

### Step 4: Update Function to be Async (if needed)

Make sure the `handleAvatarFileChange` function handles the async calls:

```typescript
const handleAvatarFileChange = async (file: File | null) => {
  if (!file) {
    return;
  }

  if (file.size > MAX_PROFILE_PHOTO_SIZE) {
    await showError(
      'Please select an image that is 2MB or smaller.',
      'File Size Error'
    );
    return;
  }

  try {
    const base64 = await convertFileToBase64(file);
    await handleProfilePhotoUpload(base64);
  } catch (error) {
    logger.error('Failed to upload profile photo:', error);
    await showError(
      'Failed to upload profile photo. Please try again.',
      'Upload Failed'
    );
  }
};
```

### Complete Updated Section

Here's the complete section with all changes:

```typescript
'use client';

import React from 'react';
import { logger } from '@/lib/logger';
import { showError } from '@/lib/alerts'; // ← NEW IMPORT
import { useParams, useRouter } from 'next/navigation';
// ... rest of imports

export default function EmployeeDetailPage() {
  // ... existing code

  const handleAvatarFileChange = async (file: File | null) => {
    if (!file) {
      return;
    }

    if (file.size > MAX_PROFILE_PHOTO_SIZE) {
      await showError(
        'Please select an image that is 2MB or smaller.',
        'File Size Error'
      );
      return;
    }

    try {
      const base64 = await convertFileToBase64(file);
      await handleProfilePhotoUpload(base64);
    } catch (error) {
      logger.error('Failed to upload profile photo:', error);
      await showError(
        'Failed to upload profile photo. Please try again.',
        'Upload Failed'
      );
    }
  };

  // ... rest of code
}
```

### Benefits of This Change

1. **Better UX**: Users see a styled, professional alert instead of a plain browser alert
2. **Consistent**: Matches other alerts across the application
3. **Customizable**: Title is now customizable and descriptive
4. **Non-blocking**: Alert doesn't block the entire browser
5. **Type-safe**: TypeScript knows the expected parameters

### Testing Checklist

- [ ] Upload a file larger than 2MB → Should show file size error
- [ ] Trigger an upload error → Should show upload failed error
- [ ] Both alerts display correctly with proper styling
- [ ] Alerts are dismissible
- [ ] Function continues to work as expected after dismissing alert
