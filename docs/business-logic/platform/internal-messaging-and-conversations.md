# Platform — Internal Messaging And Conversations

> **Source files:**
>
> - `src/app/api/conversations/route.ts`
> - `src/app/api/conversations/[id]/messages/route.ts`
> - `src/app/api/conversations/[id]/read/route.ts`
> - `src/app/api/conversations/unread-count/route.ts`
> - `src/app/api/users/messaging/route.ts`
> - `src/app/clothing/operations/messaging/**`

---

## A — Access And User Discovery Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | Internal messaging is only available to authenticated users | The conversation and messaging-user routes all require a valid server session. |
| 2 | Messaging-user lookup returns active, non-deleted users except the current user | The picker list is built from active internal users and excludes self-selection. |
| 3 | Messaging-user lookup is ordered by name | The participant picker is intentionally stable and human-readable for operators. |

---

## B — Conversation List And Creation Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 4 | Users only see conversations they participate in | Conversation listing filters by `conversationParticipant` membership for the current user. |
| 5 | Soft-deleted conversations are excluded from normal lists | Conversation list reads require `deletedAt=null`. |
| 6 | Conversation summaries use the latest visible message | The list's last-message preview ignores deleted messages and messages hidden for the current user. |
| 7 | Each listed conversation includes a computed unread count | Unread counts compare message timestamps against the participant's `lastReadAt` and ignore the current user's own messages. |
| 8 | Direct-message creation is deduplicated | When a non-group conversation would involve the same two participants, the API returns the existing conversation instead of creating another thread. |
| 9 | The current user is always included in the participant set | Conversation creation adds the signed-in user if they were not explicitly included in the request. |
| 10 | New conversations assign the creator `admin` role and other participants `member` role | Participant roles are seeded at creation time. |
| 11 | Conversation titles are group-only metadata | Direct messages do not preserve a custom title; group conversations may store one. |

---

## C — Message And Read-State Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 12 | Conversation message reads require participant membership | Users cannot fetch or post messages for conversations they do not belong to. |
| 13 | Message listing supports pagination by `before` message and `limit` | Older-message loading is based on message timestamp derived from a cursor message. |
| 14 | Message lists are returned in chronological order to the client | The route fetches descending for efficiency, then reverses before responding. |
| 15 | Sending a message requires a non-empty trimmed body | Blank or whitespace-only submissions are rejected. |
| 16 | Messages support `messageType` and optional attachment URL metadata | The transport supports richer message descriptors beyond plain text body alone. |
| 17 | Sending a message also updates the parent conversation timestamp | The message create and conversation `updatedAt` bump happen together in a transaction. |
| 18 | Mark-as-read updates the participant's `lastReadAt` timestamp | Read state is per user per conversation rather than a global flag on the thread. |

---

## D — Visibility Semantics

| # | Logic | Explanation |
| --- | --- | --- |
| 19 | Deleted messages are excluded from lists and unread counts | Message visibility calculations consistently filter `deletedAt=null`. |
| 20 | Per-user hidden messages disappear from that user's list, preview, and unread calculations | `hiddenForUsers` is part of the visibility filter across conversation summary and message-history routes. |
| 21 | Internal messaging is distinct from customer-facing messaging templates | This system models user-to-user conversations and unread state, not outbound customer messaging templates or blast-notice workflows. |