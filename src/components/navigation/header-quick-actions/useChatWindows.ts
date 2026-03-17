'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { showNotification } from '@mantine/notifications';
import type { ChatWindowState } from './types';

const STORAGE_KEY = 'bm-open-chat-windows';
const LEGACY_STORAGE_KEY = 'bm-open-chat-ids';
const MAX_CHAT_WINDOWS = 3;

const showChatWindowsStorageError = (action: 'restore' | 'save') => {
  showNotification({
    title: 'Messaging state',
    message:
      action === 'restore'
        ? 'Failed to restore chat windows.'
        : 'Failed to save chat windows.',
    color: 'red',
  });
};

const parseLegacyChatWindows = (legacyParsed: unknown): ChatWindowState[] => {
  if (!Array.isArray(legacyParsed)) {
    return [];
  }

  return legacyParsed
    .filter((id: unknown): id is string => typeof id === 'string')
    .map((id) => ({ id, minimized: false }));
};

const parseStoredChatWindows = (parsed: unknown): ChatWindowState[] => {
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((item) => {
      if (typeof item === 'string') {
        return { id: item, minimized: false } satisfies ChatWindowState;
      }

      if (item && typeof item === 'object' && typeof item.id === 'string') {
        return {
          id: item.id,
          minimized: Boolean((item as { minimized?: boolean }).minimized),
        } satisfies ChatWindowState;
      }

      return null;
    })
    .filter((item): item is ChatWindowState => item !== null);
};

export function useChatWindows() {
  const [openChats, setOpenChats] = useState<ChatWindowState[]>([]);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      hasHydratedRef.current = true;
      return;
    }

    let restoredChats: ChatWindowState[] | null = null;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          restoredChats = parseLegacyChatWindows(JSON.parse(legacy));
        }
      } else {
        restoredChats = parseStoredChatWindows(JSON.parse(stored));
      }
    } catch {
      showChatWindowsStorageError('restore');
    }

    if (Array.isArray(restoredChats) && restoredChats.length > 0) {
      setOpenChats(restoredChats);
    }

    hasHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hasHydratedRef.current || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(openChats));
    } catch {
      showChatWindowsStorageError('save');
    }
  }, [openChats]);

  const openConversation = useCallback((conversationId: string) => {
    setOpenChats((current) => {
      const withoutDuplicate = current.filter(
        (chat) => chat.id !== conversationId
      );
      const next = [
        ...withoutDuplicate,
        { id: conversationId, minimized: false },
      ];

      if (next.length <= MAX_CHAT_WINDOWS) {
        return next;
      }

      return next.slice(next.length - MAX_CHAT_WINDOWS);
    });
  }, []);

  const closeConversation = useCallback((conversationId: string) => {
    setOpenChats((current) =>
      current.filter((chat) => chat.id !== conversationId)
    );
  }, []);

  const toggleConversation = useCallback((conversationId: string) => {
    setOpenChats((current) =>
      current.map((chat) =>
        chat.id === conversationId
          ? { ...chat, minimized: !chat.minimized }
          : chat
      )
    );
  }, []);

  return {
    openChats,
    openConversation,
    closeConversation,
    toggleConversation,
  } as const;
}
