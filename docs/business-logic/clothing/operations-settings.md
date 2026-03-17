# Clothing — Settings Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/settings/components/SettingsPage.tsx`
> - `src/modules/clothing/operations/settings/components/tabs/AccountingSettingsTab.tsx`
> - `src/modules/clothing/operations/settings/components/tabs/TransactionsSettingsTab.tsx`
> - `src/modules/clothing/operations/settings/components/tabs/InvoiceSettingsTab.tsx`
> - `src/modules/clothing/operations/settings/components/tabs/InvoiceMessageTab.tsx`
> - `src/modules/clothing/operations/settings/components/MessageTemplatesBoard.tsx`
> - `src/modules/clothing/operations/settings/components/PostTemplatesTab.tsx`
> - `src/app/clothing/operations/settings/page.tsx`
> - `src/app/api/settings/accounting/route.ts`
> - `src/app/api/settings/transactions/route.ts`
> - `src/app/api/settings/invoice/route.ts`
> - `src/app/api/invoice-settings/route.ts`

---

## A — Page Layout & Quick Actions

| #   | Logic                                                                          | Explanation                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The URL parameter `?tab=` controls the initially active tab                    | On mount, `useSearchParams()` reads the `tab` value and sets the active `Tabs` panel. If absent, the default is `change-log`.                                                                                |
| 2   | Five quick-action buttons are shown at the top                                 | Buttons: **Change Log**, **Invoice Settings**, **Templates**, **Transactions**, **Accounting**. Each calls `setActiveTab` with the corresponding tab key, jumping directly to that section.                  |
| 3   | The header search `TextInput` currently filters only the Change Log tab        | `SettingsPage` stores one shared `searchQuery`, but only `ChangeLogPage` receives it via `externalSearch`; Invoice, Templates, Transactions, and Accounting tabs do not currently consume this search input. |
| 4   | Date range inputs are shown in the header but only feed the current page state | `startDate` and `endDate` are local state owned by `SettingsPage`; the current page only passes `externalSearch` into `ChangeLogPage`.                                                                       |
| 5   | Date range validation is inline                                                | Invalid ranges show inline input errors: `Start must be before end` and `End must be after start`.                                                                                                           |
| 6   | Five tabs: change-log, invoice, message, transactions, accounting              | Each tab maps to a dedicated component handling its own state and API calls.                                                                                                                                 |
| 7   | The visible quick-action buttons are the primary tab navigation UI             | The `Tabs.List` is visually hidden; operators navigate through the top quick-action buttons instead of a visible tab strip.                                                                                  |
| 8   | The `message` tab supports a nested `?subTab=` entry point                     | Valid sub-tabs are `invoice`, `message-templates`, and `post-templates`; invalid values fall back to `invoice`.                                                                                              |

---

## B — Route-Level Behaviour

| #   | Logic                                                                           | Explanation                                                                                                                                          |
| --- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 9   | `/clothing/operations/settings?tab=backup` redirects to `/admin/backup-restore` | The route page checks `searchParams.tab`; the old backup tab no longer renders inside Clothing Settings and now redirects to the central admin page. |
| 10  | The settings route renders through the shared operations page wrapper           | `renderOperationsPage('/clothing/operations/settings', <SettingsRoutePage />)` preserves the standard Clothing Operations route shell.               |

---

## C — Accounting Settings Tab

| #   | Logic                                                                       | Explanation                                                                                                    |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 11  | Two date inputs: Clothing Cutover Date and General Merchandise Cutover Date | Both are Mantine `DateInput` fields. Cutover dates mark the start of accounting period for each business line. |
| 12  | Dates are loaded on mount via `GET /api/settings/accounting`                | Returned values populate both `DateInput` fields.                                                              |
| 13  | `hasChanges` is tracked via `useMemo`                                       | Compares current input values against the fetched originals; boolean result enables/disables the Save button.  |
| 14  | Save is disabled when `hasChanges` is false                                 | The Save button is grayed out until at least one date is modified.                                             |
| 15  | Save calls `PUT /api/settings/accounting`                                   | Request body: `{ clothingCutoverDate, generalMerchandiseCutoverDate }` formatted as ISO date strings.          |
| 16  | Success notification: green                                                 | `showNotification({ title: 'Saved', message: 'Accounting cutover dates updated.', color: 'green' })`.          |
| 17  | Failure notification: red                                                   | `showNotification({ title: 'Error', message: 'Failed to save accounting settings.', color: 'red' })`.          |

---

## D — Transactions Settings Tab

| #   | Logic                                                              | Explanation                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18  | Five read-only protection toggles are shown                        | Toggles (all default ON): Unit Price read-only, Line Total read-only, Invoice Date read-only, Packed Date read-only, Shipment Code read-only.                                                                                                                                                                                                                                     |
| 19  | All toggles default to `true` (locked/protected)                   | Settings are fetched via `GET /api/settings/transactions` and initialised from the response; missing keys default to `true`.                                                                                                                                                                                                                                                      |
| 20  | Unlocking any toggle requires **double SweetAlert2 confirmation**  | **First dialog**: `Swal.fire({ title: 'Disable [Field] Protection?', text: 'This will allow editing of ...', icon: 'warning', showCancelButton: true })`. If confirmed, **second dialog**: `Swal.fire({ title: 'Final Confirmation', text: 'Are you absolutely sure?', icon: 'warning', confirmButtonColor: '#d33' })`. Only after both confirmations is the toggle switched off. |
| 21  | Cancelling either dialog leaves the toggle unchanged               | If the operator clicks `Cancel` at either step, the toggle reverts to its previous value.                                                                                                                                                                                                                                                                                         |
| 22  | Save calls `PUT /api/settings/transactions`                        | Request body: `{ unitPriceReadOnly, lineTotalReadOnly, invoiceDateReadOnly, packedDateReadOnly, shipmentCodeReadOnly }`.                                                                                                                                                                                                                                                          |
| 23  | Success notification: green                                        | `showNotification({ title: 'Settings Saved', color: 'green' })`.                                                                                                                                                                                                                                                                                                                  |
| 24  | Failure notification: red                                          | `showNotification({ title: 'Save Failed', color: 'red' })`.                                                                                                                                                                                                                                                                                                                       |
| 25  | A `Revert` button resets toggles to the last fetched server values | `handleRevert` sets local state back to the fetched defaults without making an API call.                                                                                                                                                                                                                                                                                          |

---

## E — Invoice Settings Tab

| #   | Logic                                                                           | Explanation                                                                                                                             |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 26  | Format selector: PDF or PNG                                                     | A Mantine `Select` with options `[{ value: 'pdf', label: 'PDF' }, { value: 'png', label: 'PNG' }]`.                                     |
| 27  | PNG Quality selector is only active when format is PNG                          | When format is `pdf`, the quality select is disabled.                                                                                   |
| 28  | PNG quality options: 3×, 4×, 5×, 6×, 8×                                         | 3× = 2451 px, 4× = 3268 px, 5× = 4085 px, 6× = 4902 px, 8× = 6536 px. These translate to DPI multipliers for the PDF-to-PNG conversion. |
| 29  | An info banner informs operators the setting applies to future generations only | Mantine `Alert` with icon: `Changes apply to the next invoice generation.`                                                              |
| 30  | Settings fetched on mount via `GET /api/settings/invoice`                       | Populates format and pngQuality selects.                                                                                                |
| 31  | `hasChanges` comparison gates the Save button                                   | Boolean `useMemo` comparing current values to fetched originals.                                                                        |
| 32  | Save calls `POST /api/settings/invoice`                                         | Request body: `{ format, pngQuality }`.                                                                                                 |
| 33  | Success notification: green                                                     | `showNotification({ title: 'Invoice Settings Saved', color: 'green' })`.                                                                |
| 34  | Failure notification: red                                                       | `showNotification({ title: 'Save Failed', color: 'red' })`.                                                                             |

---

## F — Invoice Message Sub-Tab (within Settings → Message Tab)

| #   | Logic                                                                            | Explanation                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 35  | The `message` tab has three sub-tabs: Invoice, Message Templates, Post Templates | Sub-tab navigation is handled by a nested `Tabs` inside `InvoiceMessageTab`.                                                                                                                                                                                             |
| 36  | Invoice sub-tab has an `Enable Editing` toggle                                   | `editingEnabled` must be `true` before any field in the invoice sub-tab accepts input. All inputs are disabled when `editingEnabled` is `false`.                                                                                                                         |
| 37  | `messageTemplate` field requires `{drive_files}` placeholder                     | Mantine form validation rejects the field if `{drive_files}` is not present in the string. Error: `Message template must include {drive_files}`.                                                                                                                         |
| 38  | `messageTemplate` field also requires `{shopee_link}` placeholder                | Same validation logic. Error: `Message template must include {shopee_link}`.                                                                                                                                                                                             |
| 39  | `paymentChannelsUrl` field is required                                           | Mantine form validation rejects empty string. Error: `Payment channels URL is required`.                                                                                                                                                                                 |
| 40  | Invoice sub-tab data is fetched on mount via `GET /api/invoice-settings`         | Populates `messageTemplate` and `paymentChannelsUrl`.                                                                                                                                                                                                                    |
| 41  | Save calls `PUT /api/invoice-settings`                                           | Request body: `{ messageTemplate, paymentChannelsUrl }`.                                                                                                                                                                                                                 |
| 42  | Success notification: green                                                      | `showNotification({ title: 'Invoice Settings Saved', color: 'green' })`.                                                                                                                                                                                                 |
| 43  | Failure notification: red                                                        | `showNotification({ title: 'Save Failed', color: 'red' })`.                                                                                                                                                                                                              |
| 44  | `Reset to Default` requires **double SweetAlert2**                               | **First**: `Swal.fire({ title: 'Reset to Default?', icon: 'warning', showCancelButton: true })`. **Second**: `Swal.fire({ title: 'Confirm Reset', confirmButtonColor: '#d33' })`. Only after both confirmations is the form reset to `DEFAULT_INVOICE_MESSAGE_TEMPLATE`. |

---

## G — Current Scope Notes

| #   | Logic                                                                                          | Explanation                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 45  | The current Clothing Settings page is focused on configuration, not module marketplace actions | The live page renders the five settings tabs above; install, uninstall, update, enable, and disable module actions are not part of the current route workflow. |
