'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { showNotification } from '@mantine/notifications';
import { messagingService } from '@/services/messaging.service';
import { usePathname } from 'next/navigation';
import {
  playMessageSound,
  initializeAudioContext,
} from '@/lib/notificationSound';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';

const STORAGE_KEY = 'seenMessageNotifications';

export function GlobalMessageNotifications() {
  const { data: session } = useSession();
  const currentUserId = session?.user?.id;
  const pathname = usePathname();
  const isMessagingPage = pathname?.startsWith(
    '/clothing/operations/messaging'
  );
  const { preferences } = useNotificationPreferences();

  // Load seen message IDs from localStorage on mount
  const previousMessagesRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef(false);

  // Initialize audio context on mount (enables auto-play notifications)
  useEffect(() => {
    // Initialize on any user interaction with the page
    const handleUserInteraction = () => {
      initializeAudioContext();
      // Remove listeners after first interaction
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };

    document.addEventListener('click', handleUserInteraction);
    document.addEventListener('keydown', handleUserInteraction);
    document.addEventListener('touchstart', handleUserInteraction);

    return () => {
      document.removeEventListener('click', handleUserInteraction);
      document.removeEventListener('keydown', handleUserInteraction);
      document.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  useEffect(() => {
    // Load seen messages from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const messageIds = JSON.parse(stored) as string[];
        previousMessagesRef.current = new Set(messageIds);
      }
    } catch {
      // Silently fail if localStorage is not available
    }
  }, []);

  // Fetch all conversations to get all messages
  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagingService.getConversations(),
    refetchInterval: 5000, // Poll every 5 seconds
    enabled: !!currentUserId,
  });

  const persistSeenMessages = () => {
    if (previousMessagesRef.current.size > 100) {
      const trimmedIds = Array.from(previousMessagesRef.current).slice(-100);
      previousMessagesRef.current = new Set(trimmedIds);
    }

    try {
      const messageIds = Array.from(previousMessagesRef.current);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messageIds));
    } catch {
      // Silently fail if localStorage is not available
    }
  };

  // On initial load, capture the existing last messages so they don't trigger notifications
  useEffect(() => {
    if (
      !currentUserId ||
      conversations.length === 0 ||
      hasInitializedRef.current
    ) {
      return;
    }

    let hasChanges = false;

    conversations.forEach((conversation) => {
      const lastMessage = conversation.lastMessage;
      if (lastMessage && !previousMessagesRef.current.has(lastMessage.id)) {
        previousMessagesRef.current.add(lastMessage.id);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      persistSeenMessages();
    }

    hasInitializedRef.current = true;
  }, [conversations, currentUserId]);

  // After initialization, handle new messages as data updates
  useEffect(() => {
    if (
      !currentUserId ||
      conversations.length === 0 ||
      !hasInitializedRef.current
    ) {
      return;
    }

    let shouldPersist = false;

    conversations.forEach((conversation) => {
      const lastMessage = conversation.lastMessage;
      if (!lastMessage || previousMessagesRef.current.has(lastMessage.id)) {
        return;
      }

      previousMessagesRef.current.add(lastMessage.id);
      shouldPersist = true;

      if (!isMessagingPage && lastMessage.senderId !== currentUserId) {
        const sender = conversation.participants.find(
          (p) => p.userId === lastMessage.senderId
        );
        const senderName = sender?.user.name || sender?.user.email || 'Someone';
        const conversationTitle = conversation.title || senderName;

        // Show visual notification
        showNotification({
          title: `${senderName} (${conversationTitle})`,
          message: lastMessage.body,
          color: 'blue',
          position: 'top-right',
          autoClose: 5000,
          onClick: () => {
            window.location.href = '/clothing/operations/messaging';
          },
          style: { cursor: 'pointer' },
        });

        // Play notification sound if enabled
        if (preferences.soundEnabled) {
          playMessageSound();
        }
      }
    });

    if (shouldPersist) {
      persistSeenMessages();
    }
  }, [conversations, currentUserId, isMessagingPage, preferences.soundEnabled]);

  return null; // This component doesn't render anything
}
