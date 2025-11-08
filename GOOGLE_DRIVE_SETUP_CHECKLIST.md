# Google Drive Integration - Setup Checklist

## ✅ Completed Steps

- [x] Created API endpoint (`/api/google-drive/sync-files`)
- [x] Integrated sync button in Invoicing tab
- [x] Installed `googleapis` package
- [x] Added configuration to `.env.local`
- [x] Your Google Drive folder ID is already configured

## 📋 Remaining Steps (Do These Now)

### Step 1: Create Google Cloud Service Account

1. **Go to Google Cloud Console**: https://console.cloud.google.com

2. **Create/Select Project**:
   - Click project dropdown at top
   - Click "New Project" or select existing one
   - Note the project ID

3. **Enable Google Drive API**:
   - Go to: **APIs & Services** > **Library**
   - Search: "Google Drive API"
   - Click it and press **"Enable"**

4. **Create Service Account**:
   - Go to: **IAM & Admin** > **Service Accounts**
   - Click: **"Create Service Account"**
   - Name: `business-management-drive`
   - Click: **"Create and Continue"**
   - Role: Select **"Editor"** (or just "Viewer" for read-only)
   - Click: **"Done"**

5. **Generate JSON Key**:
   - Click on the service account email you just created
   - Go to **"Keys"** tab
   - Click: **"Add Key"** > **"Create new key"**
   - Select: **"JSON"** format
   - Click: **"Create"**
   - **Save the downloaded JSON file securely!**

### Step 2: Share Your Google Drive Folder

1. **Open your folder**: https://drive.google.com/drive/folders/1reLxZAgqSy3xfMaG4lqFSVWAcYHbCjz8

2. **Click "Share" button** (top-right)

3. **Add service account**:
   - Paste the service account email from the JSON file
   - Format: `something@project-id.iam.gserviceaccount.com`
   - Permission: **Viewer** (or Editor if you want upload capabilities later)
   - Click: **"Share"**

### Step 3: Update Environment Variables

1. **Open the downloaded JSON key file** in a text editor

2. **Find these fields**:

   ```json
   {
     "client_email": "business-management-drive@your-project.iam.gserviceaccount.com",
     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...\n-----END PRIVATE KEY-----\n"
   }
   ```

3. **Copy values to `.env.local`**:

   Open: `/home/ron/Websites/business-management/.env.local`

   Replace these lines:

   ```bash
   # Replace this:
   GOOGLE_CLIENT_EMAIL="your-service-account@your-project.iam.gserviceaccount.com"

   # With the actual email from JSON:
   GOOGLE_CLIENT_EMAIL="business-management-drive@your-project.iam.gserviceaccount.com"

   # Replace this:
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

   # With the actual private_key from JSON (keep it on one line with \n as-is):
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBA...(full key here)...\n-----END PRIVATE KEY-----\n"
   ```

   **Important**:
   - Keep the entire private key on ONE line
   - Don't remove the `\n` characters
   - Keep the double quotes around the key

### Step 4: Restart Development Server

```bash
# Stop the current server (Ctrl+C if running)
# Then restart:
npm run dev
```

### Step 5: Test the Integration

1. **Open your app**: http://localhost:3000
2. **Navigate to**: Clothing > Operations > Checkout Links
3. **Click**: "Invoicing" tab
4. **Click**: "Add New" button
5. **Expected result**: Files from your Google Drive folder appear in the table!

## 🎯 Quick Test

If you've completed the setup, test it now:

```bash
# Make sure your dev server is running:
npm run dev

# Then test the API directly:
curl http://localhost:3000/api/google-drive/sync-files
```

**Expected response**: JSON with your Google Drive files
**Error response**: Will tell you what's missing (credentials, permissions, etc.)

## 📝 Example `.env.local` (After Setup)

After you complete the setup, your `.env.local` should look like this:

```bash
# Database Configuration
DATABASE_URL="postgresql://ron:ronpassword@localhost:5432/business_management_db?schema=public"

# Development Environment
NODE_ENV="development"

# Google Drive Integration
GOOGLE_DRIVE_FOLDER_ID="1reLxZAgqSy3xfMaG4lqFSVWAcYHbCjz8"
GOOGLE_CLIENT_EMAIL="business-management-drive@your-project-123456.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC8...(very long key)...\n-----END PRIVATE KEY-----\n"
```

## ❓ Troubleshooting

### "Google Drive credentials not configured"

→ You haven't updated `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY` in `.env.local`

### "The caller does not have permission"

→ You haven't shared the folder with the service account email

### "Invalid authentication credentials"

→ The private key is malformed. Make sure:

- It's all on one line in `.env.local`
- The `\n` characters are preserved
- It has the BEGIN/END markers

### No files appear

→ Check:

- Folder ID matches your Google Drive folder URL
- Folder is not empty
- Service account has access to the folder

## 📚 Need Help?

- **Full Setup Guide**: `docs/GOOGLE_DRIVE_INTEGRATION.md`
- **Implementation Details**: `GOOGLE_DRIVE_SYNC_IMPLEMENTATION.md`
- **Questions?**: Check the Troubleshooting section in the setup guide

## 🎉 Once Setup is Complete

You'll be able to:

- ✅ Click "Add New" in Invoicing tab to sync Google Drive files
- ✅ Automatically extract customer names from filenames
- ✅ Get clickable Drive links in the table
- ✅ Search and filter invoice records
- ✅ Mark invoices as processed with checkboxes

---

**Next Steps After Setup:**

1. Test the sync feature
2. Fill in the empty weight and link fields
3. Use the feature for your invoice workflow!
