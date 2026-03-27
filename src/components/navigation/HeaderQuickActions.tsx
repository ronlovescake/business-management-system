'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Group } from '@mantine/core';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { useBusinessStore } from '@/lib/store';
import { getMessagingPath } from '@/lib/routes';
import { messagingService } from '@/services/messaging.service';
import {
  buildNavigationItems,
  getWorkspacesForBusiness,
  isBusiness,
} from './navigationItems';
import {
  formatBadgeCount,
  getParticipantLabel,
  getConversationTitle,
} from './headerQuickActionsUtils';
import { AppsMenu } from './header-quick-actions/AppsMenu';
import { MessagesMenu } from './header-quick-actions/MessagesMenu';
import {
  NotificationsMenu,
  ProfileMenu,
  SettingsButton,
} from './header-quick-actions/SystemActionGroup';
import { ChatWindows } from './header-quick-actions/ChatWindows';
import { useChatWindows } from './header-quick-actions/useChatWindows';
import type {
  HeaderQuickActionsProps,
  WorkspaceNavSection,
} from './header-quick-actions/types';

export function HeaderQuickActions({
  unreadMessages = 0,
  unreadNotifications = 0,
  userInitials = 'Y',
}: HeaderQuickActionsProps) {
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const { openChats, openConversation, closeConversation, toggleConversation } =
    useChatWindows();
  const pathname = usePathname();
  const router = useRouter();
  const { selectedBusiness, selectedWorkspace, initializeFromPath } =
    useBusinessStore();
  const messagingPath = useMemo(
    () => getMessagingPath(selectedBusiness),
    [selectedBusiness]
  );
  const currentUserId = session?.user?.id ?? null;
  const currentUserEmail = session?.user?.email ?? null;
  const conversationsQueryKey = queryKeys.messaging.conversations.list();

  const {
    data: conversations = [],
    isLoading: loadingConversations,
    error: conversationsError,
  } = useQuery({
    queryKey: conversationsQueryKey,
    queryFn: () => messagingService.getConversations(),
    refetchInterval: 5000,
  });

  const totalUnreadFromApi = useMemo(() => {
    if (!conversations?.length) {
      return undefined;
    }
    return conversations.reduce(
      (sum, conversation) => sum + (conversation.unreadCount ?? 0),
      0
    );
  }, [conversations]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if ((!selectedBusiness || !selectedWorkspace) && pathname) {
      initializeFromPath(pathname);
    }
  }, [pathname, selectedBusiness, selectedWorkspace, initializeFromPath]);

  const workspaceSections: WorkspaceNavSection[] = useMemo(() => {
    if (!isBusiness(selectedBusiness)) {
      return [];
    }

    return getWorkspacesForBusiness(selectedBusiness).map((workspace) => ({
      workspace,
      items: buildNavigationItems(selectedBusiness, workspace.value),
    }));
  }, [selectedBusiness]);

  const handleNavigate = useCallback(
    (path: string) => {
      setAppsOpen(false);
      setMessagesOpen(false);
      router.push(path);
    },
    [router]
  );

  const toggleAppsOpen = useCallback(() => {
    setAppsOpen((open) => !open);
  }, []);

  const toggleMessagesOpen = useCallback(() => {
    setMessagesOpen((open) => !open);
  }, []);

  const handleMessageSearchChange = useCallback((value: string) => {
    setMessageSearch(value);
  }, []);

  const handleOpenConversation = useCallback(
    (conversationId: string) => {
      setMessagesOpen(false);
      openConversation(conversationId);
    },
    [openConversation]
  );

  const handleCloseConversation = useCallback(
    (conversationId: string) => {
      closeConversation(conversationId);
    },
    [closeConversation]
  );

  const handleToggleMinimize = useCallback(
    (conversationId: string) => {
      toggleConversation(conversationId);
    },
    [toggleConversation]
  );

  const handleViewAllMessages = useCallback(() => {
    setMessagesOpen(false);
  }, []);

  const goTo = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router]
  );

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: '/login' });
  }, []);

  const filteredConversations = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const title = getConversationTitle(
        conversation,
        currentUserId,
        currentUserEmail
      ).toLowerCase();
      const participants = conversation.participants
        .map((participant) => getParticipantLabel(participant).toLowerCase())
        .join(' ');
      return `${title} ${participants}`.includes(query);
    });
  }, [conversations, messageSearch, currentUserId, currentUserEmail]);

  const unreadMessagesCount = totalUnreadFromApi ?? unreadMessages;
  const unreadBadgeLabel = formatBadgeCount(unreadMessagesCount);
  const totalConversations = conversations.length;

  return (
    <Group gap="sm" align="center">
      <AppsMenu
        isOpen={appsOpen}
        onOpenChange={setAppsOpen}
        onToggle={toggleAppsOpen}
        workspaceSections={workspaceSections}
        onNavigate={handleNavigate}
        activePath={pathname}
      />
      <MessagesMenu
        isOpen={messagesOpen}
        onOpenChange={setMessagesOpen}
        onToggle={toggleMessagesOpen}
        unreadCount={unreadMessagesCount}
        badgeLabel={unreadBadgeLabel}
        messageSearch={messageSearch}
        onSearchChange={handleMessageSearchChange}
        loadingConversations={loadingConversations}
        conversationsError={conversationsError}
        filteredConversations={filteredConversations}
        totalConversations={totalConversations}
        currentUserId={currentUserId}
        currentUserEmail={currentUserEmail}
        onConversationSelect={handleOpenConversation}
        onViewAll={handleViewAllMessages}
        messagingPath={messagingPath}
      />
      <NotificationsMenu unreadNotifications={unreadNotifications} />
      <SettingsButton />
      <ProfileMenu
        session={session}
        mounted={mounted}
        userInitials={userInitials}
        onNavigate={goTo}
        onSignOut={handleSignOut}
      />
      <ChatWindows
        openChats={openChats}
        conversations={conversations}
        currentUserId={currentUserId}
        currentUserEmail={currentUserEmail}
        onClose={handleCloseConversation}
        onToggleMinimize={handleToggleMinimize}
        messagingPath={messagingPath}
      />
    </Group>
  );
}

export default HeaderQuickActions;
