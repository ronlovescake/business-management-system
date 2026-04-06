# Clothing — Message Templates Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/settings/components/InvoiceMessageTab.tsx`
> - `src/app/clothing/operations/message-templates/MessageTemplatesBoard.tsx`
> - `src/app/api/message-templates/route.ts`
> - `src/modules/shared/messaging/api/messageTemplateRouteFactory.ts`
> - `src/modules/shared/messaging/api/messageTemplateService.ts`
> - `src/modules/clothing/operations/message-templates/templates.data.ts` (`DEFAULT_MESSAGE_TEMPLATES`, `MESSAGE_TEMPLATE_TITLE_ORDER`)

---

## A — Template List Display

| #   | Logic                                                              | Explanation                                                                                                                                            |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Templates are fetched on mount via `GET /api/message-templates`    | The board initiates a fetch call and stores the returned array in local state.                                                                         |
| 2   | Templates are displayed in a fixed canonical order                 | The list is sorted by `MESSAGE_TEMPLATE_TITLE_ORDER` — an ordered array of template title strings. Templates not in the order array appear at the end. |
| 3   | Each template card shows its title, a coloured badge, and the body | The body text is displayed with a fixed row height; long content is truncated.                                                                         |
| 4   | Badge colour is determined by the template category                | `Reminder` badge → blue; `Cancellation` badge → red; any other badge → gray.                                                                           |

---

## B — Copy to Clipboard

| #   | Logic                                                                                   | Explanation                                                                                                                             |
| --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Each template card has a copy icon button                                               | The icon is `IconCopy` by default.                                                                                                      |
| 6   | Clicking copy calls `navigator.clipboard.writeText`                                     | The template body is written to the system clipboard using the Clipboard API.                                                           |
| 7   | On successful copy, the icon switches to `IconCheck` for 2000 ms                        | `setCopiedId(template.id)` is called on success; after 2000 ms, a `setTimeout` resets it back to `null`, restoring the `IconCopy` icon. |
| 8   | If the Clipboard API is unavailable, a hidden-textarea fallback copy is attempted first | The board falls back to `document.execCommand('copy')`; only a total copy failure shows a SweetAlert error.                             |

---

## C — Editing a Template

| #   | Logic                                                                                                                             | Explanation                                                                                                                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | Clicking the "Edit" button opens a SweetAlert2 warning confirmation first                                                         | `Swal.fire({ title: 'Edit template?', text: 'You are about to edit the "${title}" template.', icon: 'warning', showCancelButton: true })` is shown before the edit modal opens. |
| 10  | If the operator cancels the SweetAlert, no changes are made                                                                       | The edit modal never opens; template state is untouched.                                                                                                                        |
| 11  | On confirmation, the edit modal opens with the template pre-populated                                                             | Text fields are set to the current `title`, `badge`, and paragraph body joined with blank lines before the modal renders.                                                       |
| 12  | Edit modal fields: Title (required text input), Badge (required text input with suggestions), Body (multi-line textarea, 12 rows) | The editor still uses one body textarea, but save converts blank-line-separated paragraphs into the API `paragraphs` array contract.                                            |
| 13  | Badge field shows suggestion chips below the input                                                                                | Predefined badge text options (e.g. "Reminder", "Cancellation") are shown as clickable chips that auto-fill the badge input.                                                    |

---

## D — Saving Edits

| #   | Logic                                                                       | Explanation                                                                                                                    |
| --- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 14  | Saving an edited template shows a SweetAlert2 confirmation first            | `Swal.fire({ title: 'Save template edits?', icon: 'question', showCancelButton: true })` is displayed.                         |
| 15  | Save is only offered if changes were actually made                          | `handleSave` compares the current form values against the original snapshot. If nothing changed, the save is skipped silently. |
| 16  | On confirmation, the template is submitted via `PUT /api/message-templates` | Request body: `{ id, title, badge, paragraphs }` after splitting the editor body on blank lines and trimming empty paragraphs. |
| 17  | `setSavingTemplate(true)` disables the save button during the API call      | The button shows a loading state until the response resolves.                                                                  |
| 18  | Success notification: green                                                 | Mantine `showNotification({ title: 'Template Saved', color: 'green' })`.                                                       |
| 19  | Failure notification: red                                                   | Mantine `showNotification({ title: 'Save Failed', color: 'red' })`.                                                            |
| 20  | The modal closes and template list refreshes after a successful save        | The updated template is merged into state; no full re-fetch is needed.                                                         |

---

## E — Creating a New Template

| #   | Logic                                                                           | Explanation                                                                                                      |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 21  | A "Create Template" button opens the create modal                               | The create modal is separate from the edit modal but uses the same field layout.                                 |
| 22  | Title is required; empty title shows a SweetAlert2 error                        | `Swal.fire({ title: 'Title Required', text: 'Please enter a template title.', icon: 'error' })`.                 |
| 23  | Badge is required; empty badge shows a SweetAlert2 error                        | `Swal.fire({ title: 'Badge Required', text: 'Please enter a badge label.', icon: 'error' })`.                    |
| 24  | At least one non-empty paragraph must exist                                     | If the editor body is blank or all blank-line-separated paragraphs trim to empty, an error SweetAlert2 is shown. |
| 25  | On validation pass, the template is submitted via `POST /api/message-templates` | Request body: `{ title, badge, paragraphs }`.                                                                    |
| 26  | Success notification: green                                                     | Mantine `showNotification({ title: 'Template Created', color: 'green' })`.                                       |
| 27  | Failure notification: red                                                       | Mantine `showNotification({ title: 'Create Failed', color: 'red' })`.                                            |
| 28  | `resetCreateForm` is called when the modal closes                               | All create form fields return to empty strings.                                                                  |

---

## F — Template Body Format

| #   | Logic                                                                  | Explanation                                                                                                               |
| --- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 29  | The editor uses blank lines, but the API persists a `paragraphs` array | The board joins `paragraphs` with `\n\n` for editing, then splits the textarea back into a trimmed array before PUT/POST. |
| 30  | Template bodies may include placeholder tokens                         | Tokens like `{customer_name}` or `{amount}` are substituted at generation time by the invoice message generator.          |
