/**
 * Module Download API Route
 *
 * Handles downloading module bundles from remote URLs,
 * verifying checksums, and extracting to installation directory.
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// ============================================================================
// TYPES
// ============================================================================

interface DownloadRequest {
  moduleId: string;
  downloadUrl: string;
  version: string;
  checksum?: string;
  size?: number;
}

interface DownloadResponse {
  success: boolean;
  moduleId: string;
  installPath: string;
  size: number;
  duration: number;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const MODULES_BASE_PATH = join(process.cwd(), 'modules', 'marketplace');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate download request
 */
function validateRequest(body: unknown): body is DownloadRequest {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const req = body as Partial<DownloadRequest>;

  return !!(
    req.moduleId &&
    typeof req.moduleId === 'string' &&
    req.downloadUrl &&
    typeof req.downloadUrl === 'string' &&
    req.version &&
    typeof req.version === 'string'
  );
}

/**
 * Validate URL is safe
 */
function isValidDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Only allow HTTPS for security
    if (parsed.protocol !== 'https:') {
      return false;
    }
    // Block local/private IPs
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize module ID for file system
 */
function sanitizeModuleId(moduleId: string): string {
  // Remove any path traversal attempts
  return moduleId.replace(/[^a-zA-Z0-9-_]/g, '-');
}

/**
 * Download file with timeout
 */
async function downloadFile(
  url: string,
  timeout: number = DOWNLOAD_TIMEOUT
): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ModuleMarketplace/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Check content length
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (size > MAX_FILE_SIZE) {
        throw new Error(
          `File too large: ${size} bytes (max: ${MAX_FILE_SIZE} bytes)`
        );
      }
    }

    const buffer = await response.arrayBuffer();

    // Verify size
    if (buffer.byteLength > MAX_FILE_SIZE) {
      throw new Error(
        `File too large: ${buffer.byteLength} bytes (max: ${MAX_FILE_SIZE} bytes)`
      );
    }

    return buffer;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Verify file checksum
 */
async function verifyChecksum(
  data: ArrayBuffer,
  expectedChecksum: string
): Promise<boolean> {
  try {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const actualChecksum = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return actualChecksum === expectedChecksum;
  } catch (error) {
    logger.error('Checksum verification error:', error);
    return false;
  }
}

/**
 * Ensure directory exists
 */
async function ensureDirectory(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * Save downloaded file
 */
async function saveModuleFile(
  moduleId: string,
  version: string,
  data: ArrayBuffer
): Promise<string> {
  const sanitized = sanitizeModuleId(moduleId);
  const modulePath = join(MODULES_BASE_PATH, sanitized);

  // Ensure directory exists
  await ensureDirectory(modulePath);

  // Save the bundle file
  const fileName = `${sanitized}-${version}.bundle.js`;
  const filePath = join(modulePath, fileName);

  // Convert ArrayBuffer to Buffer
  const buffer = Buffer.from(data);
  await writeFile(filePath, buffer);

  logger.debug(`✅ Module saved to: ${filePath}`);

  return modulePath;
}

/**
 * Create module manifest
 */
async function createModuleManifest(
  moduleId: string,
  version: string,
  installPath: string,
  size: number
): Promise<void> {
  const manifestPath = join(installPath, 'manifest.json');

  const manifest = {
    moduleId,
    version,
    installPath,
    size,
    installedAt: new Date().toISOString(),
    bundleFile: `${sanitizeModuleId(moduleId)}-${version}.bundle.js`,
  };

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  logger.debug(`✅ Manifest created: ${manifestPath}`);
}

// ============================================================================
// API ROUTE HANDLERS
// ============================================================================

/**
 * POST /api/modules/download
 * Download and install a module
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    // Parse request body
    const body = await request.json();

    // Validate request
    if (!validateRequest(body)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid request: missing required fields (moduleId, downloadUrl, version)',
        },
        { status: 400 }
      );
    }

    const { moduleId, downloadUrl, version, checksum, size } = body;

    logger.debug(`📥 Starting download for module: ${moduleId} v${version}`);

    // Validate download URL
    if (!isValidDownloadUrl(downloadUrl)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Invalid download URL: must be HTTPS and not localhost/private IP',
        },
        { status: 400 }
      );
    }

    // Download the file
    logger.debug(`⬇️  Downloading from: ${downloadUrl}`);
    const fileData = await downloadFile(downloadUrl);

    logger.debug(`✅ Downloaded: ${fileData.byteLength} bytes`);

    // Verify size if provided
    if (size && fileData.byteLength !== size) {
      return NextResponse.json(
        {
          success: false,
          error: `Size mismatch: expected ${size} bytes, got ${fileData.byteLength} bytes`,
        },
        { status: 400 }
      );
    }

    // Verify checksum if provided
    if (checksum) {
      logger.debug(`🔍 Verifying checksum...`);
      const isValid = await verifyChecksum(fileData, checksum);

      if (!isValid) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Checksum verification failed: file may be corrupted or tampered',
          },
          { status: 400 }
        );
      }

      logger.debug(`✅ Checksum verified`);
    }

    // Save the module
    logger.debug(`💾 Saving module to disk...`);
    const installPath = await saveModuleFile(moduleId, version, fileData);

    // Create manifest
    await createModuleManifest(
      moduleId,
      version,
      installPath,
      fileData.byteLength
    );

    const duration = Date.now() - startTime;

    logger.debug(`✅ Module installed successfully in ${duration}ms`);

    const response: DownloadResponse = {
      success: true,
      moduleId,
      installPath,
      size: fileData.byteLength,
      duration,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('❌ Download failed:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    const response: DownloadResponse = {
      success: false,
      moduleId: '',
      installPath: '',
      size: 0,
      duration,
      error: errorMessage,
    };

    return NextResponse.json(response, { status: 500 });
  }
}

/**
 * GET /api/modules/download
 * Get download status/info (not implemented yet)
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: 'Method not implemented. Use POST to download modules.',
    },
    { status: 405 }
  );
}
