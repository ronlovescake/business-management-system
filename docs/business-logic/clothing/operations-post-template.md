# Clothing — Post Template Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/settings/components/PostTemplatesTab.tsx`
> - `src/modules/clothing/operations/post-template/components/PostTemplateComponent.tsx`
> - `src/app/api/post-template-notice/route.ts`
> - `src/modules/shared/messaging/api/postTemplateNoticeRouteFactory.ts`
> - `src/modules/shared/messaging/api/postTemplateNoticeService.ts`
> - `src/modules/clothing/operations/post-template/notice.data.ts`

---

## A — Page Load

| #   | Logic                                                                                   | Explanation                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Post Template editing is available inside Settings → Invoice Message → "Post Templates" | The settings tab hosts the dedicated Post Template editor, while the Post Template module consumes the same stored notice copy.                                                |
| 2   | Template data is fetched on mount via `GET /api/post-template-notice`                   | The service looks up the `post-template-notice` record by slug. If no record exists, the shared service creates and persists the default singleton record before returning it. |
| 3   | Loading state disables editing                                                          | While the fetch is in-flight, textareas remain read-only and the editor actions are unavailable.                                                                               |
| 4   | Load failures fall back to the default copy in the UI                                   | The settings UI logs the error, shows a red notification, and restores the serialized `DEFAULT_POST_TEMPLATE_NOTICE` copy locally when the GET request fails.                  |

---

## B — Editing Model

| #   | Logic                                                             | Explanation                                                                                                                          |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 5   | The editor uses two textareas: Intro paragraphs and Bullet points | The stored arrays are flattened for editing: intro paragraphs are joined with blank lines and bullet points are joined one-per-line. |
| 6   | Intro paragraphs are parsed from blank-line-separated text        | Saving splits the intro textarea on blank lines, trims each paragraph, and persists the result as the `introParagraphs` array.       |
| 7   | Bullet points are parsed from one item per line                   | Saving splits the bullet textarea on newlines, trims each item, and persists the result as the `bulletPoints` array.                 |
| 8   | Editing is gated behind a warning confirmation                    | "Enable editing" first shows a warning dialog because changes update the shared Post Template notice copy.                           |
| 9   | Cancel editing restores the last loaded snapshot                  | Cancelling discards unsaved textarea changes and resets the editor to the most recently loaded or saved values.                      |

---

## C — Saving

| #   | Logic                                                      | Explanation                                                                                                                                      |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 10  | Save is only meaningful when the textarea snapshot changed | The UI tracks a serialized snapshot and only enables a meaningful save flow once intro paragraphs or bullets differ from the last loaded values. |
| 11  | At least one intro paragraph is required                   | Both the UI and the shared route reject saves where the parsed `introParagraphs` array is empty.                                                 |
| 12  | At least one bullet point is required                      | Both the UI and the shared route reject saves where the parsed `bulletPoints` array is empty.                                                    |
| 13  | "Save" submits via `PUT /api/post-template-notice`         | The request body is `{ introParagraphs, bulletPoints }`, where both properties are trimmed string arrays.                                        |
| 14  | `upsertPostTemplateNotice` creates or updates the record   | The shared service uses Prisma `upsert` on `slug = 'post-template-notice'`, so saves remain idempotent once the singleton record exists.         |
| 15  | Success shows a green notification; failure shows red      | The settings tab reports "Notice saved" on success and surfaces the API error message when save fails.                                           |
