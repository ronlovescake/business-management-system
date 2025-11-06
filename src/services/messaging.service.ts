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

class MessagingService {
  /**
   * Get all conversations for the current user
   */
  async getConversations(): Promise<Conversation[]> {
    const response = await fetch('/api/conversations');
    if (!response.ok) {
      throw new Error('Failed to fetch conversations');
    }
    return response.json();
  }

  /**
   * Get unread message count
   */
  async getUnreadCount(): Promise<number> {
    const response = await fetch('/api/conversations/unread-count');
    if (!response.ok) {
      throw new Error('Failed to fetch unread count');
    }
    const data = await response.json();
    return data.unreadCount;
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    payload: CreateConversationPayload
  ): Promise<Conversation> {
    const response = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Failed to create conversation');
    }
    return response.json();
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
    const response = await fetch(
      `/api/conversations/${conversationId}/messages?${params}`
    );
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    return response.json();
  }

  /**
   * Send a message to a conversation
   */
  async sendMessage(
    conversationId: string,
    payload: SendMessagePayload
  ): Promise<Message> {
    const response = await fetch(
      `/api/conversations/${conversationId}/messages`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    return response.json();
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId: string): Promise<void> {
    const response = await fetch(`/api/conversations/${conversationId}/read`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to mark as read');
    }
  }

  /**
   * Get all users available for messaging
   */
  async getUsers(): Promise<User[]> {
    const response = await fetch('/api/users/messaging');
    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }
    return response.json();
  }
}

export const messagingService = new MessagingService();
