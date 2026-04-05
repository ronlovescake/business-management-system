import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messagingService } from '@/services/messaging.service';

describe('messagingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn() as typeof fetch;
  });

  it('requests conversations with no-store caching and same-origin credentials', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => [],
    } as Response);

    await messagingService.getConversations();

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/conversations',
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'same-origin',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      })
    );
  });

  it('surfaces server error messages when sending a message fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Conversation not found.' }),
    } as Response);

    await expect(
      messagingService.sendMessage('missing-conversation', {
        body: 'hello',
      })
    ).rejects.toThrow('Conversation not found.');
  });

  it('deletes a message through the conversation message endpoint', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: 'message-1', mode: 'hidden' }),
    } as Response);

    await messagingService.deleteMessage('conversation-1', 'message-1');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/conversations/conversation-1/messages/message-1',
      expect.objectContaining({
        method: 'DELETE',
        cache: 'no-store',
        credentials: 'same-origin',
      })
    );
  });
});
