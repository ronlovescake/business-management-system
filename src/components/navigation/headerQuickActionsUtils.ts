import type {
  Conversation,
  ConversationParticipant,
} from '@/services/messaging.service';

export function formatBadgeCount(count: number | undefined): string {
  if (!count || count <= 0) {
    return '';
  }
  return count > 20 ? '20+' : String(count);
}

export const getParticipantLabel = (participant: ConversationParticipant) =>
  participant.user.name || participant.user.email || 'Unknown';

export const getConversationTitle = (
  conversation: Conversation,
  currentUserId?: string | null,
  currentUserEmail?: string | null
) => {
  const participants = conversation.participants;
  if (!participants.length) {
    return 'Conversation';
  }

  const normalizedCurrentIds = new Set<string>();
  if (currentUserId) {
    normalizedCurrentIds.add(currentUserId.toLowerCase());
  }
  if (currentUserEmail) {
    normalizedCurrentIds.add(currentUserEmail.toLowerCase());
  }

  const others = participants.filter((participant) => {
    const participantId = participant.userId?.toLowerCase?.();
    const participantEmail = participant.user.email?.toLowerCase?.();

    if (participantId && normalizedCurrentIds.has(participantId)) {
      return false;
    }

    if (participantEmail && normalizedCurrentIds.has(participantEmail)) {
      return false;
    }

    return true;
  });

  if (others.length === 1) {
    return getParticipantLabel(others[0]);
  }

  if (others.length > 1) {
    const names = others.map(getParticipantLabel);
    return names.slice(0, 3).join(', ') + (names.length > 3 ? '...' : '');
  }

  const fallback =
    participants.find((participant) => participant.userId !== currentUserId) ||
    participants.find(
      (participant) =>
        participant.user.email &&
        participant.user.email.toLowerCase() !== currentUserEmail?.toLowerCase()
    ) ||
    participants[0];

  if (fallback) {
    return getParticipantLabel(fallback);
  }

  return conversation.title || 'Conversation';
};

export const getConversationInitials = (
  conversation: Conversation,
  currentUserId?: string | null,
  currentUserEmail?: string | null
) => {
  const title = getConversationTitle(
    conversation,
    currentUserId,
    currentUserEmail
  );
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
};
