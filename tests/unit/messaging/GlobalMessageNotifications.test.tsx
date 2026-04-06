import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { GlobalMessageNotifications } from '@/components/GlobalMessageNotifications';

type MockConversation = {
  title: string | null;
  participants: Array<{
    userId: string;
    user: { name: string | null; email: string | null };
  }>;
  lastMessage: {
    id: string;
    senderId: string;
    body: string;
  } | null;
};

const mockState = vi.hoisted(() => ({
  conversations: [] as MockConversation[],
  currentUserId: 'user-1',
  pathname: '/dashboard',
  selectedBusiness: 'clothing',
  soundEnabled: true,
  showNotification: vi.fn(),
  playMessageSound: vi.fn(),
  initializeAudioContext: vi.fn(),
  getConversations: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({
    data: mockState.conversations,
  })),
}));

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: {
      user: { id: mockState.currentUserId },
    },
  })),
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => mockState.pathname),
}));

vi.mock('@mantine/notifications', () => ({
  showNotification: mockState.showNotification,
}));

vi.mock('@/services/messaging.service', () => ({
  messagingService: {
    getConversations: mockState.getConversations,
  },
}));

vi.mock('@/lib/queryKeys', () => ({
  queryKeys: {
    messaging: {
      conversations: {
        list: () => ['messaging', 'conversations'],
      },
    },
  },
}));

vi.mock('@/lib/notificationSound', () => ({
  playMessageSound: mockState.playMessageSound,
  initializeAudioContext: mockState.initializeAudioContext,
}));

vi.mock('@/hooks/useNotificationPreferences', () => ({
  useNotificationPreferences: vi.fn(() => ({
    preferences: {
      soundEnabled: mockState.soundEnabled,
    },
  })),
}));

vi.mock('@/lib/store', () => ({
  useBusinessStore: vi.fn(() => ({
    selectedBusiness: mockState.selectedBusiness,
  })),
}));

vi.mock('@/lib/routes', () => ({
  getMessagingPath: vi.fn(() => '/clothing/operations/messaging'),
}));

describe('GlobalMessageNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.conversations = [];
    mockState.currentUserId = 'user-1';
    mockState.pathname = '/dashboard';
    mockState.selectedBusiness = 'clothing';
    mockState.soundEnabled = true;
    localStorage.clear();
  });

  it('does not notify for messages seen during initial hydration', async () => {
    mockState.conversations = [
      {
        title: null,
        participants: [
          {
            userId: 'user-2',
            user: { name: 'Teammate', email: 'teammate@example.com' },
          },
        ],
        lastMessage: {
          id: 'msg-1',
          senderId: 'user-2',
          body: 'Existing message',
        },
      },
    ];

    render(<GlobalMessageNotifications />);

    await waitFor(() => {
      expect(localStorage.getItem('seenMessageNotifications')).toContain(
        'msg-1'
      );
    });

    expect(mockState.showNotification).not.toHaveBeenCalled();
    expect(mockState.playMessageSound).not.toHaveBeenCalled();
  });

  it('shows a notification and plays sound for a new unseen incoming message', async () => {
    mockState.conversations = [
      {
        title: null,
        participants: [
          {
            userId: 'user-2',
            user: { name: 'Teammate', email: 'teammate@example.com' },
          },
        ],
        lastMessage: {
          id: 'msg-1',
          senderId: 'user-2',
          body: 'Existing message',
        },
      },
    ];

    const view = render(<GlobalMessageNotifications />);

    await waitFor(() => {
      expect(localStorage.getItem('seenMessageNotifications')).toContain(
        'msg-1'
      );
    });

    mockState.conversations = [
      {
        title: null,
        participants: [
          {
            userId: 'user-2',
            user: { name: 'Teammate', email: 'teammate@example.com' },
          },
        ],
        lastMessage: {
          id: 'msg-2',
          senderId: 'user-2',
          body: 'New message',
        },
      },
    ];

    view.rerender(<GlobalMessageNotifications />);

    await waitFor(() => {
      expect(mockState.showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Teammate (Teammate)',
          message: 'New message',
        })
      );
    });

    expect(mockState.playMessageSound).toHaveBeenCalled();
  });
});
