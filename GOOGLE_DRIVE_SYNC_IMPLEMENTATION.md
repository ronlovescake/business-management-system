# Google Drive Invoice Sync - Implementation Summary

## What Was Implemented

Successfully implemented Google Drive integration to sync files from your Google Drive folder to the checkout-links invoice tab.

## Files Created/Modified

### New Files

1. **`src/app/api/google-drive/sync-files/route.ts`**
   - API endpoint to fetch files from Google Drive folder
   - Parses customer names from filenames
   - Handles authentication via service account
   - Returns structured data for invoice table

2. **`docs/GOOGLE_DRIVE_INTEGRATION.md`**
   - Complete setup guide with step-by-step instructions
   - Troubleshooting section
   - Security best practices
   - API documentation

### Modified Files

1. **`src/modules/clothing/operations/checkout-links/components/CheckoutLinksComponent.tsx`**
   - Added `handleSyncGoogleDrive()` function
   - Connected "Add New" button to sync functionality
   - Added `filteredInvoiceData` for search functionality
   - Added `isSyncing` state to show loading indicator

2. **`.env.example`**
   - Added Google Drive configuration section
   - Included setup instructions
   - Added environment variables:
     - `GOOGLE_DRIVE_FOLDER_ID`
     - `GOOGLE_CLIENT_EMAIL`
     - `GOOGLE_PRIVATE_KEY`

## How It Works

### Workflow

1. User clicks **"Add New"** button in the Invoicing tab
2. Frontend calls `GET /api/google-drive/sync-files`
3. Backend authenticates with Google Drive using service account credentials
4. API fetches all files from the specified folder
5. Customer names are extracted from filenames:
   - Example: `BOB & LOREN CLOTHING  Loren Young-1.png` → `BOB & LOREN CLOTHING | Loren Young`
6. Data is returned to frontend with:
   - Customer name (parsed from filename)
   - Drive file link (webViewLink)
   - File metadata (ID, name, mimeType)
7. Frontend populates invoice table with:
   - Customer Name (extracted)
   - Drive Files (clickable link)
   - Empty fields for user to fill: Actual Weight, Final Weight, Shopee Checkout Links, Message, Chat
   - Tickbox (unchecked by default)

### Filename Parsing Logic

The system automatically parses customer names using these rules:

1. Remove file extension (`.png`, `.pdf`, `.jpg`, etc.)
2. Remove trailing numbers (`-1`, `-2`, etc.)
3. Replace double spaces with `|` separator
4. Trim whitespace

**Examples:**

- `BOB & LOREN CLOTHING  Loren Young-1.png` → `BOB & LOREN CLOTHING | Loren Young`
- `ABC STORE  John Doe-2.pdf` → `ABC STORE | John Doe`
- `Simple Name.jpg` → `Simple Name`

## Features

✅ **Automatic Sync** - Click "Add New" to sync all files from Google Drive
✅ **Smart Parsing** - Extracts customer names from filenames
✅ **Direct Links** - Drive Files column contains clickable links to view files
✅ **Append Mode** - New syncs append to existing data (doesn't replace)
✅ **Search Filtering** - Filter invoice records by any field
✅ **Interactive Checkboxes** - Toggle tickbox for each record
✅ **Error Handling** - Clear error messages for configuration issues
✅ **Loading States** - Shows loading indicator during sync

## Setup Required

To use this feature, you need to:

1. **Install Package** (if not using dynamic import):

   ```bash
   npm install googleapis --legacy-peer-deps
   ```

2. **Configure Google Cloud**:
   - Create/select project
   - Enable Google Drive API
   - Create service account
   - Download JSON key
   - Share folder with service account email

3. **Add Environment Variables** to `.env.local`:

   ```bash
   GOOGLE_DRIVE_FOLDER_ID="1reLxZAgqSy3xfMaG4lqFSVWAcYHbCjz8"
   GOOGLE_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

4. **Restart Server**:
   ```bash
   npm run dev
   ```

See `docs/GOOGLE_DRIVE_INTEGRATION.md` for detailed setup instructions.

## User Guide

### Syncing Files

1. Navigate to **Clothing** > **Operations** > **Checkout Links**
2. Click the **"Invoicing"** tab
3. Click **"Add New"** button
4. Wait for sync to complete (shows loading indicator)
5. Files will appear in the table with customer names extracted

### Table Features

- **Customer Name**: Automatically extracted from filename
- **Actual Weight**: Empty - fill in manually
- **Final Weight**: Empty - fill in manually
- **Shopee Checkout Links**: Empty - fill in manually
- **Drive Files**: Clickable link to view file in Google Drive
- **Message**: Empty - fill in manually
- **Chat**: Empty - fill in manually
- **Tickbox**: Interactive checkbox - click to toggle
- **Action**: Edit and delete buttons (TODO: implement handlers)

### Search

Use the search box to filter records by any field:

- Customer name
- Weights
- Links
- Messages

## Error Messages

### "Google Drive Not Configured"

**Cause**: Missing `GOOGLE_CLIENT_EMAIL` or `GOOGLE_PRIVATE_KEY` in environment variables

**Solution**: Add credentials to `.env.local` and restart server

### "Package Not Installed"

**Cause**: `googleapis` package not installed

**Solution**: Run `npm install googleapis --legacy-peer-deps`

### "The caller does not have permission"

**Cause**: Service account doesn't have access to the folder

**Solution**: Share the Google Drive folder with the service account email

## Technical Details

### API Endpoint

**URL**: `GET /api/google-drive/sync-files`

**Query Parameters**:

- `folderId` (optional): Override default folder ID

**Response**:

```json
{
  "success": true,
  "data": [
    {
      "customerName": "BOB & LOREN CLOTHING | Loren Young",
      "driveFiles": "https://drive.google.com/file/d/...",
      "fileId": "1abc...",
      "fileName": "BOB & LOREN CLOTHING  Loren Young-1.png",
      "mimeType": "image/png"
    }
  ],
  "count": 1,
  "folderId": "1reLxZAgqSy3xfMaG4lqFSVWAcYHbCjz8"
}
```

### Authentication

Uses **Service Account** authentication with JWT:

- Scope: `https://www.googleapis.com/auth/drive.readonly`
- Auth method: `google.auth.JWT`
- Credentials from environment variables

### Security

- Service account has read-only access to Drive
- Private key stored in environment variables (never committed)
- Folder access controlled via Google Drive sharing
- Uses HTTPS for all API calls

## Next Steps (Future Enhancements)

1. **Implement Edit Functionality**: Allow editing of invoice records
2. **Implement Delete Functionality**: Allow deleting invoice records
3. **Auto-Sync**: Add periodic auto-sync every X minutes
4. **Batch Operations**: Select multiple records with checkboxes for bulk actions
5. **Export to CSV**: Export invoice data to CSV file
6. **Import from CSV**: Import invoice data from CSV file
7. **Database Persistence**: Save invoice data to database
8. **Duplicate Detection**: Prevent syncing the same file twice
9. **File Upload**: Upload files directly to Google Drive from the app
10. **Two-Way Sync**: Update Google Drive when data changes in app

## Related Documentation

- `docs/GOOGLE_DRIVE_INTEGRATION.md` - Complete setup guide
- `.env.example` - Environment variable configuration
- `src/app/api/google-drive/sync-files/route.ts` - API implementation
- `src/modules/clothing/operations/checkout-links/components/CheckoutLinksComponent.tsx` - Frontend implementation

## Notes

- The sync is **append-only** by default - it adds new files without removing existing records
- Empty fields (Actual Weight, Final Weight, etc.) can be filled in manually after sync
- The tickbox is useful for marking processed/completed invoices
- Drive Files link opens in new tab to view the file in Google Drive
- Search works across all fields in the invoice table
