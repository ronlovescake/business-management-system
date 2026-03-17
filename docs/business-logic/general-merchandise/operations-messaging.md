# General Merchandise — Operations Messaging Business Logic

> **Source files:**
>
> - `src/app/general-merchandise/operations/messaging/page.tsx`
> - `src/app/general-merchandise/operations/_shared/renderGmOperationsPage.tsx`
> - Shared messaging route/page components under `src/app/operations/messaging/_shared/`

---

## A — Route & Shell

| #   | Logic                                                                      | Explanation                                                      |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | The GM messaging page lives at `/general-merchandise/operations/messaging` | The route path is GM-specific.                                   |
| 2   | The route renders through the shared GM operations shell                   | The route uses `renderGmOperationsPage`.                         |
| 3   | The route delegates to the shared messaging route page                     | There is no GM-only messaging page implementation at this route. |

---

## B — Current Workflow State

| #   | Logic                                                                                                         | Explanation                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 4   | The GM messaging route is a real shared messaging workflow, not an empty placeholder page                     | The route delegates to `MessagingClientPage`, which implements conversation and message flows directly.  |
| 5   | The shared page polls conversation lists and active messages continuously                                     | Conversations refetch every 5 seconds and active messages refetch every 3 seconds while a chat is open.  |
| 6   | Operators can search conversations and switch active threads from the shared message list                     | The page keeps a searchable conversation list and selects an active conversation.                        |
| 7   | Sending a message uses mutation-driven optimistic updates and toast-based failure handling                    | Successful sends update caches and scroll the thread; failures raise a red notification.                 |
| 8   | New messages from other users trigger toast notifications and optional sound playback                         | The page shows a notification per incoming message and respects the sound preference toggle.             |
| 9   | Operators can open a modal to create a new direct or group conversation                                       | The shared page uses `UniversalModal`, recipient selection, and validation before conversation creation. |
| 10  | Any future GM-specific messaging persistence, routing, or operator actions must be documented here explicitly | This doc currently records real shared-workflow parity as the baseline.                                  |
| 11  | Shared messaging workflow changes that affect GM should also update this GM doc                               | Shared implementation still defines GM operator behavior.                                                |
