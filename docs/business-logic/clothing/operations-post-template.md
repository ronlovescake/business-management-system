# Clothing — Post Template Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/settings/components/tabs/PostTemplatesTab.tsx`
> - `src/app/api/post-template/notice/route.ts`
> - `src/modules/clothing/operations/settings/services/notice.service.ts`
> - `src/modules/clothing/operations/settings/data/notice.data.ts`

---

## A — Page Load

| #   | Logic                                                                                      | Explanation                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Post Template tab is nested inside Settings → InvoiceMessageTab → "Post Templates" sub-tab | The tab is accessible from the Settings page by clicking the `message` quick-action button or selecting the message sub-tab, then choosing "Post Templates" within. |
| 2   | Template data is fetched on mount via `GET /api/post-template/notice`                      | The service looks up the `post-template-notice` record by slug. If no record exists, the `DEFAULT_POST_TEMPLATE_NOTICE` constant is returned as the initial value.  |
| 3   | Loading state disables the form                                                            | While the initial fetch is in-flight, input fields are disabled and the Save button is grayed out.                                                                  |

---

## B — Intro Paragraphs Management

| #   | Logic                                                         | Explanation                                                                                                                                                |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4   | The template body is composed of one or more intro paragraphs | Each intro paragraph is rendered as a separate `Textarea` input. Paragraphs are stored as a JSON array (`introParagraphs`) in the database.                |
| 5   | "Add Paragraph" button appends a blank paragraph              | Clicking the add button appends an empty string to the local `introParagraphs` array. The new textarea is immediately visible and focused.                 |
| 6   | Each paragraph has a "Delete" button                          | Clicking the delete icon removes that paragraph at its array index. At least one paragraph must remain — if only one exists the delete button is disabled. |
| 7   | Paragraph content is updated on change                        | `onChange` for each textarea calls a handler that replaces the value at that array index.                                                                  |

---

## C — Bullet Points Management

| #   | Logic                                                             | Explanation                                                                                                    |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 8   | Below the intro paragraphs, a list of bullet-point items is shown | Each bullet point is rendered as a single-line `Textarea`. Points are stored as a JSON array (`bulletPoints`). |
| 9   | "Add Bullet" button appends a blank bullet                        | Works identically to the paragraph add: appends an empty string and renders a new textarea.                    |
| 10  | Each bullet has a "Remove" button                                 | Removes the bullet at its index. No minimum count is enforced for bullets — all can be deleted.                |
| 11  | Bullet content is updated on change                               | Same index-based update pattern as paragraphs.                                                                 |

---

## D — Saving

| #   | Logic                                                     | Explanation                                                                                                              |
| --- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 12  | "Save" button submits via `PUT /api/post-template/notice` | The request body includes the full `introParagraphs` and `bulletPoints` arrays serialised as JSON.                       |
| 13  | Success shows a green notification                        | Mantine `showNotification({ title: 'Saved', message: 'Post template updated.', color: 'green' })` is displayed.          |
| 14  | Failure shows a red notification                          | Mantine `showNotification({ title: 'Error', message: 'Failed to save post template.', color: 'red' })` is displayed.     |
| 15  | `upsertPostTemplateNotice` creates or updates the record  | The service uses Prisma `upsert` with `slug = 'post-template-notice'` as the unique key, so the operation is idempotent. |
