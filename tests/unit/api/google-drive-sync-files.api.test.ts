import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/google-drive/sync-files/route';

const list = vi.hoisted(() => vi.fn());
vi.mock('googleapis', () => ({
  google: {
    auth: { JWT: vi.fn() },
    drive: () => ({ files: { list } }),
  },
}));

const file = (id: string, name: string) => ({
  id,
  name,
  mimeType: 'image/png',
  webViewLink: `https://drive.google.com/file/d/${id}/view`,
});

describe('Google Drive invoice file sync', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('GOOGLE_CLIENT_EMAIL', 'unit@example.invalid');
    vi.stubEnv('GOOGLE_PRIVATE_KEY', 'unit-test-placeholder');
    vi.stubEnv('GOOGLE_DRIVE_FOLDER_ID', 'folder-1');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns all pages and preserves file/customer mapping', async () => {
    list
      .mockResolvedValueOnce({
        data: {
          files: [file('first', 'Customer One-1.png')],
          nextPageToken: 'page-2',
        },
      })
      .mockResolvedValueOnce({
        data: { files: [file('second', 'Customer Two-1.png')] },
      });
    const response = await GET(
      new Request('http://localhost/api/google-drive/sync-files')
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.count).toBe(2);
    expect(
      body.data.map((row: { customerName: string }) => row.customerName)
    ).toEqual(['Customer One', 'Customer Two']);
    expect(list).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageToken: 'page-2',
        fields: expect.stringContaining('nextPageToken'),
      })
    );
  });

  it('returns a failure rather than a partial success if a later page fails', async () => {
    list
      .mockResolvedValueOnce({
        data: {
          files: [file('first', 'Customer One.png')],
          nextPageToken: 'page-2',
        },
      })
      .mockRejectedValueOnce(new Error('Drive unavailable'));
    const response = await GET(
      new Request('http://localhost/api/google-drive/sync-files')
    );
    expect(response.status).toBe(500);
    expect((await response.json()).success).toBe(false);
  });

  it('rejects malformed folder identifiers before constructing a Drive query', async () => {
    list.mockResolvedValue({ data: { files: [] } });
    const response = await GET(
      new Request(
        `http://localhost/api/google-drive/sync-files?folderId=${encodeURIComponent("folder' or trashed=true or 'other")}`
      )
    );
    expect(response.status).toBe(400);
    expect(list).not.toHaveBeenCalled();
  });
});
