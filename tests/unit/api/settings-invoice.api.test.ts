/**
 * Settings — Invoice Settings API (Business Rule Tests)
 *
 * Rules from docs/business-logic/platform/settings-and-configuration.md:
 *   #6  — Invoice settings are file-backed JSON, not database-backed
 *   #7  — The current invoice output format choices are `pdf` and `png`
 *   #8  — PNG quality is validated on a 1-to-10 scale
 *   #9  — Missing invoice settings fall back to defaults (format: png, quality: 8)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// We need to intercept the SETTINGS_FILE to use a temp dir
let tempDir: string;
let settingsFilePath: string;

beforeEach(() => {
  vi.resetModules();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invoice-settings-'));
  settingsFilePath = path.join(tempDir, 'settings', 'invoice-settings.json');
  // Override process.cwd to use our temp directory
  vi.spyOn(process, 'cwd').mockReturnValue(tempDir);
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('Settings — Invoice Settings API (Business Rules)', () => {
  // Must import fresh each time because the SETTINGS_FILE const is computed at import time
  // Instead we re-import and test

  it('Rule #9: GET returns default settings when file does not exist', async () => {
    // Dynamic import to get fresh module with our mocked cwd
    const { GET } = await import('@/app/api/settings/invoice/route');
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.settings.format).toBe('png');
    expect(json.settings.pngQuality).toBe(8);
  });

  it('Rule #6: GET reads from file-backed JSON when file exists', async () => {
    // Create a settings file
    fs.mkdirSync(path.join(tempDir, 'settings'), { recursive: true });
    fs.writeFileSync(
      settingsFilePath,
      JSON.stringify({ format: 'pdf', pngQuality: 5 })
    );

    const { GET } = await import('@/app/api/settings/invoice/route');
    const res = await GET();
    const json = await res.json();

    expect(json.settings.format).toBe('pdf');
    expect(json.settings.pngQuality).toBe(5);
  });

  it('Rule #7: POST rejects invalid format (must be "pdf" or "png")', async () => {
    const { POST } = await import('@/app/api/settings/invoice/route');
    const req = new NextRequest('http://localhost:3000/api/settings/invoice', {
      method: 'POST',
      body: JSON.stringify({ format: 'svg', pngQuality: 8 }),
    });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toMatch(/invalid format/i);
  });

  it('Rule #7: POST accepts "pdf" format', async () => {
    const { POST } = await import('@/app/api/settings/invoice/route');
    const req = new NextRequest('http://localhost:3000/api/settings/invoice', {
      method: 'POST',
      body: JSON.stringify({ format: 'pdf', pngQuality: 8 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('Rule #7: POST accepts "png" format', async () => {
    const { POST } = await import('@/app/api/settings/invoice/route');
    const req = new NextRequest('http://localhost:3000/api/settings/invoice', {
      method: 'POST',
      body: JSON.stringify({ format: 'png', pngQuality: 8 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('Rule #8: POST rejects PNG quality < 1', async () => {
    const { POST } = await import('@/app/api/settings/invoice/route');
    const req = new NextRequest('http://localhost:3000/api/settings/invoice', {
      method: 'POST',
      body: JSON.stringify({ format: 'png', pngQuality: 0 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/quality/i);
  });

  it('Rule #8: POST rejects PNG quality > 10', async () => {
    const { POST } = await import('@/app/api/settings/invoice/route');
    const req = new NextRequest('http://localhost:3000/api/settings/invoice', {
      method: 'POST',
      body: JSON.stringify({ format: 'png', pngQuality: 11 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('Rule #8: POST accepts PNG quality boundary values 1 and 10', async () => {
    const { POST } = await import('@/app/api/settings/invoice/route');

    for (const quality of [1, 10]) {
      const req = new NextRequest(
        'http://localhost:3000/api/settings/invoice',
        {
          method: 'POST',
          body: JSON.stringify({ format: 'png', pngQuality: quality }),
        }
      );
      const res = await POST(req);
      expect(res.status).toBe(200);
    }
  });
});
