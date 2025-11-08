# Google Drive Integration Guide

This guide explains how to set up Google Drive integration for syncing invoice files to the checkout-links invoice tab.

## Overview

The system can automatically sync files from your Google Drive folder and populate the invoice table with customer names extracted from the filenames.

**Example:**

- Google Drive file: `BOB & LOREN CLOTHING  Loren Young-1.png`
- Extracted customer name: `BOB & LOREN CLOTHING | Loren Young`

## Setup Instructions

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Note your project ID for later use

### Step 2: Enable Google Drive API

1. In the Google Cloud Console, go to **"APIs & Services"** > **"Library"**
2. Search for **"Google Drive API"**
3. Click on it and press **"Enable"**

### Step 3: Create Service Account

1. Go to **"IAM & Admin"** > **"Service Accounts"**
2. Click **"Create Service Account"**
3. Enter a name (e.g., `business-management-drive`)
4. Click **"Create and Continue"**
5. Grant the **"Editor"** role (or customize permissions as needed)
6. Click **"Done"**

### Step 4: Generate JSON Key

1. Click on the service account email you just created
2. Go to the **"Keys"** tab
3. Click **"Add Key"** > **"Create new key"**
4. Select **"JSON"** format
5. Click **"Create"**
6. The JSON file will download automatically - **keep it secure!**

### Step 5: Share Google Drive Folder

1. Open your Google Drive folder: https://drive.google.com/drive/folders/1reLxZAgqSy3xfMaG4lqFSVWAcYHbCjz8
2. Click the **"Share"** button
3. Paste the service account email (format: `name@project-id.iam.gserviceaccount.com`)
   - You can find this email in the downloaded JSON file (`client_email` field)
4. Give **"Viewer"** or **"Editor"** permissions
5. Click **"Share"**

### Step 6: Configure Environment Variables

1. Open the downloaded JSON key file
2. Copy the following values to your `.env.local` file:

```bash
# Google Drive Integration
GOOGLE_DRIVE_FOLDER_ID="1reLxZAgqSy3xfMaG4lqFSVWAcYHbCjz8"
GOOGLE_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

**Important:**

- `GOOGLE_CLIENT_EMAIL`: Copy from `client_email` field in JSON file
- `GOOGLE_PRIVATE_KEY`: Copy from `private_key` field in JSON file
  - **Keep the quotes and `\n` characters as-is**
  - The key should start with `-----BEGIN PRIVATE KEY-----\n` and end with `\n-----END PRIVATE KEY-----\n`

### Step 7: Install Required Package

The system uses dynamic imports for the Google APIs library. If you encounter errors about missing packages, install it:

```bash
npm install googleapis --legacy-peer-deps
```

### Step 8: Restart Development Server

After configuring environment variables, restart your development server:

```bash
npm run dev
```

## Usage

1. Navigate to **Clothing** > **Operations** > **Checkout Links**
2. Click on the **"Invoicing"** tab
3. Click the **"Add New"** button
4. The system will sync all files from your Google Drive folder
5. Customer names will be automatically extracted from filenames
6. The Drive Files column will contain clickable links to view the files

## File Naming Convention

The system parses customer names from filenames using this pattern:

**Pattern:** `CUSTOMER NAME  Additional Info-Number.extension`

**Examples:**

- `BOB & LOREN CLOTHING  Loren Young-1.png` → `BOB & LOREN CLOTHING | Loren Young`
- `ABC STORE  John Doe-2.pdf` → `ABC STORE | John Doe`
- `Simple Name.jpg` → `Simple Name`

**Rules:**

- Double spaces are converted to `|` separator
- File extensions are removed (`.png`, `.pdf`, `.jpg`, etc.)
- Trailing numbers are removed (`-1`, `-2`, etc.)

## Troubleshooting

### Error: "Google Drive credentials not configured"

**Solution:** Make sure you've added `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` to your `.env.local` file and restarted the server.

### Error: "googleapis package not installed"

**Solution:** Run `npm install googleapis --legacy-peer-deps`

### Error: "The caller does not have permission"

**Solution:** Make sure you've shared the Google Drive folder with the service account email. Check that the email in `.env.local` matches the service account email.

### Error: "Invalid authentication credentials"

**Solution:**

1. Verify that `GOOGLE_PRIVATE_KEY` includes the full key with BEGIN/END markers
2. Ensure newline characters (`\n`) are preserved in the key
3. The key should be enclosed in double quotes

### No files are synced

**Possible causes:**

1. The folder ID is incorrect - verify it matches your Google Drive folder URL
2. The folder is empty or all files are in trash
3. The service account doesn't have access to the folder

## API Endpoint

The sync functionality is implemented as an API endpoint:

**Endpoint:** `GET /api/google-drive/sync-files`

**Query Parameters:**

- `folderId` (optional): Override the default folder ID from environment variables

**Response:**

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

## Security Best Practices

1. **Never commit `.env.local` to version control**
2. **Keep your JSON key file secure** - it provides full access to your service account
3. **Use minimal permissions** - grant only "Viewer" access to the Drive folder if you only need to read files
4. **Rotate keys regularly** - delete old keys and create new ones periodically
5. **Monitor service account activity** in Google Cloud Console

## Additional Resources

- [Google Drive API Documentation](https://developers.google.com/drive/api/guides/about-sdk)
- [Service Account Authentication](https://cloud.google.com/docs/authentication/production)
- [Google Cloud Console](https://console.cloud.google.com)

## Support

If you encounter issues not covered in this guide, check:

1. Google Cloud Console logs
2. Application console for detailed error messages
3. Verify all environment variables are set correctly
4. Ensure the service account has proper permissions
