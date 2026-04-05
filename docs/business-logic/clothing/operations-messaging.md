# Clothing — Messaging Business Logic

> **Source files:**
>
> - `src/app/clothing/operations/messaging/page.tsx`
> - `src/app/clothing/operations/messaging/MessagingClientPage.tsx`
> - `src/app/api/conversations/route.ts`
> - `src/app/api/conversations/[id]/messages/route.ts`
> - `src/app/api/conversations/[id]/messages/[messageId]/route.ts`
> - `src/app/api/conversations/unread-count/route.ts`
> - `src/services/messaging.service.ts`

---

## A — Current State

| #   | Logic                                                                                  | Explanation                                                                                                                 |
| --- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 1   | The clothing messaging page is a real shared workflow                                  | `/clothing/operations/messaging` renders `MessagingClientPage` and persists conversations and messages through the API.     |
| 2   | Conversation lists and active threads are polled continuously                          | Conversations refetch every 5 seconds and the active message thread refetches every 3 seconds while open.                   |
| 3   | Operators can create direct and group conversations                                    | The page uses a modal with participant selection and optional group naming.                                                 |
| 4   | Sending a message updates the active thread and conversation previews                  | The client mutates the thread, refreshes conversation previews, and keeps unread state in sync.                             |
| 5   | Incoming messages can trigger toast notifications and optional audio                   | Visual notifications are shown for new incoming messages and audio follows the user preference toggle.                      |
| 6   | Senders can unsend their own messages with a permanent hard delete                     | Unsend removes the message record entirely so it disappears for all participants.                                           |
| 7   | Receivers can delete incoming messages only from their own view                        | Receiver-side delete stores a per-user hidden-message record and leaves the original message visible to other participants. |
| 8   | Conversation previews and unread counts are computed from only the current user's view | Hidden messages are excluded from the visible thread, last-message preview, and unread badge calculations for that user.    |
