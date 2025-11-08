import { NextResponse } from 'next/server';

/**
 * Google Drive File Sync API
 *
 * This endpoint syncs files from a Google Drive folder to the invoice table.
 *
 * SETUP REQUIRED:
 * 1. Go to Google Cloud Console: https://console.cloud.google.com
 * 2. Create a new project or select existing one
 * 3. Enable Google Drive API
 * 4. Create credentials (OAuth 2.0 Client ID or Service Account)
 * 5. Add these to your .env.local:
 *    - GOOGLE_DRIVE_FOLDER_ID=your_folder_id
 *    - GOOGLE_CLIENT_EMAIL=your_service_account_email
 *    - GOOGLE_PRIVATE_KEY=your_private_key
 *
 * For service account setup:
 * 1. Create service account in Google Cloud Console
 * 2. Download JSON key file
 * 3. Share your Google Drive folder with the service account email
 * 4. Copy client_email and private_key to .env.local
 */

interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId =
      searchParams.get('folderId') || process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!folderId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Google Drive folder ID is required. Set GOOGLE_DRIVE_FOLDER_ID in environment variables or pass as query parameter.',
        },
        { status: 400 }
      );
    }

    // Check if credentials are configured
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Google Drive credentials not configured. Please set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in environment variables.',
          setupInstructions: {
            step1: 'Go to Google Cloud Console',
            step2: 'Create a service account',
            step3: 'Download JSON key file',
            step4:
              'Share your Google Drive folder with the service account email',
            step5: 'Add credentials to .env.local',
          },
        },
        { status: 500 }
      );
    }

    // Dynamically import googleapis to avoid installation conflicts
    const { google } = await import('googleapis');

    // Create JWT auth client
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey.replace(/\\n/g, '\n'), // Handle escaped newlines
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    // Initialize Drive API
    const drive = google.drive({ version: 'v3', auth });

    // List files in the folder
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'files(id, name, mimeType, webViewLink, webContentLink)',
      orderBy: 'name',
    });

    const files = (response.data.files || []) as GoogleDriveFile[];

    // Parse customer names from filenames
    // Example: "BOB & LOREN CLOTHING  Loren Young-1.png" -> "BOB & LOREN CLOTHING | Loren Young"
    const customerRecords = files.map((file) => {
      // Remove file extension and numbering
      let customerName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
      customerName = customerName.replace(/-\d+$/, ''); // Remove trailing -1, -2, etc.
      customerName = customerName.trim();

      // Replace double spaces with |
      customerName = customerName.replace(/\s{2,}/g, ' | ');

      return {
        customerName,
        driveFiles: file.webViewLink || '',
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
      };
    });

    return NextResponse.json({
      success: true,
      data: customerRecords,
      count: customerRecords.length,
      folderId,
    });
  } catch (error) {
    // Check if googleapis is not installed
    if (
      error instanceof Error &&
      error.message.includes('Cannot find module')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: 'googleapis package not installed',
          instructions: 'Run: npm install googleapis --legacy-peer-deps',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to sync Google Drive files',
      },
      { status: 500 }
    );
  }
}
