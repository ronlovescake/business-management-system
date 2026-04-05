/**
 * Messaging Service
 * Client-side service for messaging operations
 */

export interface User {
  id: string;
  name: string | null;
  email: string;
  photoUrl: string | null;
}

export interface ConversationParticipant {
  id: string;
  userId: string;
  joinedAt: Date;
  lastReadAt: Date | null;
  role: string;
  user: User;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  messageType: string;
  attachmentUrl: string | null;
  isEdited: boolean;
  createdAt: Date;
  updatedAt: Date;
  sender: User;
}

export interface Conversation {
  id: string;
  title: string | null;
  isGroup: boolean;
  createdAt: Date;
  updatedAt: Date;
  participants: ConversationParticipant[];
  messages?: Message[];
  lastMessage?: Message | null;
  unreadCount?: number;
}

export interface CreateConversationPayload {
  participantIds: string[];
  title?: string;
  isGroup?: boolean;
}

export interface SendMessagePayload {
  body: string;
  messageType?: string;
  attachmentUrl?: string;
}

export interface DeleteMessageResult {
  messageId: string;
  mode: 'hard-delete' | 'hidden';
}

class MessagingService {
  private async request<T>(
    input: string,
    init: RequestInit | undefined,
    fallbackError: string
  ): Promise<T> {
    const response = await fetch(input, {
      cache: 'no-store',
      credentials: 'same-origin',
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | T
      | null;

    if (!response.ok) {
      throw new Error(
        body && typeof body === 'object' && 'error' in body
          ? (body.error ?? fallbackError)
          : fallbackError
      );
    }

    return body as T;
  }

  /**
   * Get all conversations for the current user
   */
  async getConversations(): Promise<Conversation[]> {
    return this.request<Conversation[]>(
      '/api/conversations',
      undefined,
      'Failed to fetch conversations'
    );
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(): Promise<number> {
    const data = await this.request<{ unreadCount: number }>(
      '/api/conversations/unread-count',
      undefined,
      'Failed to fetch unread count'
    );
    return data.unreadCount;
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    payload: CreateConversationPayload
  ): Promise<Conversation> {
    return this.request<Conversation>(
      '/api/conversations',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      'Failed to create conversation'
    );
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(
    conversationId: string,
    limit = 50,
    before?: string
  ): Promise<Message[]> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(before && { before }),
    });
    return this.request<Message[]>(
      `/api/conversations/${conversationId}/messages?${params}`,
      undefined,
      'Failed to fetch messages'
    );
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(
    conversationId: string,
    payload: SendMessagePayload
  ): Promise<Message> {
    return this.request<Message>(
      `/api/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      'Failed to send message'
    );
  }

  /**
   * Delete a message from the current user's perspective.
   * Sender deletion hard-deletes the message for everyone.
   * Receiver deletion hides the message only for the current user.
   */
  async deleteMessage(
    conversationId: string,
    messageId: string
  ): Promise<DeleteMessageResult> {
    return this.request<DeleteMessageResult>(
      `/api/conversations/${conversationId}/messages/${messageId}`,
      {
        method: 'DELETE',
      },
      'Failed to delete message'
    );
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId: string): Promise<void> {
    await this.request(
      `/api/conversations/${conversationId}/read`,
      {
        method: 'POST',
      },
      'Failed to mark as read'
    );
  }

  /**
   * Get all users available for messaging
   */
  async getUsers(): Promise<User[]> {
    return this.request<User[]>(
      '/api/users/messaging',
      undefined,
      'Failed to fetch users'
    );
  }
}

export const messagingService = new MessagingService();
