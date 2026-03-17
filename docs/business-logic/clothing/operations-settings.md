# Clothing — Settings Business Logic

> **Source files:**
>
> - `src/modules/clothing/operations/settings/components/SettingsPage.tsx`
> - `src/modules/clothing/operations/settings/components/tabs/AccountingSettingsTab.tsx`
> - `src/modules/clothing/operations/settings/components/tabs/TransactionsSettingsTab.tsx`
> - `src/modules/clothing/operations/settings/components/tabs/InvoiceSettingsTab.tsx`
> - `src/modules/clothing/operations/settings/components/tabs/InvoiceMessageTab.tsx`
> - `src/modules/clothing/operations/settings/components/tabs/MessageTemplatesBoard.tsx`
> - `src/modules/clothing/operations/settings/components/tabs/PostTemplatesTab.tsx`
> - `src/modules/clothing/operations/settings/hooks/useModuleOperations.ts`
> - `src/app/api/settings/accounting/route.ts`
> - `src/app/api/settings/transactions/route.ts`
> - `src/app/api/settings/invoice/route.ts`
> - `src/app/api/invoice-settings/route.ts`

---

## A — Page Layout & Quick Actions

| #   | Logic                                                                     | Explanation                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The URL parameter `?tab=` controls the initially active tab               | On mount, `useSearchParams()` reads the `tab` value and sets the active `Tabs` panel. If absent, the default is `change-log`.                                                               |
| 2   | Five quick-action buttons are shown at the top                            | Buttons: **Change Log**, **Invoice Settings**, **Templates**, **Transactions**, **Accounting**. Each calls `setActiveTab` with the corresponding tab key, jumping directly to that section. |
| 3   | A global search `TextInput` filters display results within the active tab | The search value is passed as a prop to each tab component.                                                                                                                                 |
| 4   | Date range inputs (startDate / endDate) further filter results            | Two Mantine `DateInput` fields allow scoping the change log by date.                                                                                                                        |
| 5   | Date range validation: `endDate` must not be before `startDate`           | If `endDate < startDate`, an inline error "End date cannot be before start date" is shown next to the end date field.                                                                       |
| 6   | Five tabs: change-log, invoice, message, transactions, accounting         | Each tab maps to a dedicated component handling its own state and API calls.                                                                                                                |

---

## B — Accounting Settings Tab

| #   | Logic                                                                       | Explanation                                                                                                    |
| --- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 7   | Two date inputs: Clothing Cutover Date and General Merchandise Cutover Date | Both are Mantine `DateInput` fields. Cutover dates mark the start of accounting period for each business line. |
| 8   | Dates are loaded on mount via `GET /api/settings/accounting`                | Returned values populate both `DateInput` fields.                                                              |
| 9   | `hasChanges` is tracked via `useMemo`                                       | Compares current input values against the fetched originals; boolean result enables/disables the Save button.  |
| 10  | Save is disabled when `hasChanges` is false                                 | The Save button is grayed out until at least one date is modified.                                             |
| 11  | Save calls `PUT /api/settings/accounting`                                   | Request body: `{ clothingCutoverDate, generalMerchandiseCutoverDate }` formatted as ISO date strings.          |
| 12  | Success notification: green                                                 | `showNotification({ title: 'Saved', message: 'Accounting cutover dates updated.', color: 'green' })`.          |
| 13  | Failure notification: red                                                   | `showNotification({ title: 'Error', message: 'Failed to save accounting settings.', color: 'red' })`.          |

---

## C — Transactions Settings Tab

| #   | Logic                                                              | Explanation                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | Five read-only protection toggles are shown                        | Toggles (all default ON): Unit Price read-only, Line Total read-only, Invoice Date read-only, Packed Date read-only, Shipment Code read-only.                                                                                                                                                                                                                                     |
| 15  | All toggles default to `true` (locked/protected)                   | Settings are fetched via `GET /api/settings/transactions` and initialised from the response; missing keys default to `true`.                                                                                                                                                                                                                                                      |
| 16  | Unlocking any toggle requires **double SweetAlert2 confirmation**  | **First dialog**: `Swal.fire({ title: 'Disable [Field] Protection?', text: 'This will allow editing of ...', icon: 'warning', showCancelButton: true })`. If confirmed, **second dialog**: `Swal.fire({ title: 'Final Confirmation', text: 'Are you absolutely sure?', icon: 'warning', confirmButtonColor: '#d33' })`. Only after both confirmations is the toggle switched off. |
| 17  | Cancelling either dialog leaves the toggle unchanged               | If the operator clicks "Cancel" at either step, the toggle reverts to its previous value.                                                                                                                                                                                                                                                                                         |
| 18  | Save calls `PUT /api/settings/transactions`                        | Request body: `{ unitPriceReadOnly, lineTotalReadOnly, invoiceDateReadOnly, packedDateReadOnly, shipmentCodeReadOnly }`.                                                                                                                                                                                                                                                          |
| 19  | Success notification: green                                        | `showNotification({ title: 'Settings Saved', color: 'green' })`.                                                                                                                                                                                                                                                                                                                  |
| 20  | Failure notification: red                                          | `showNotification({ title: 'Save Failed', color: 'red' })`.                                                                                                                                                                                                                                                                                                                       |
| 21  | A "Revert" button resets toggles to the last fetched server values | `handleRevert` sets local state back to the fetched defaults without making an API call.                                                                                                                                                                                                                                                                                          |

---

## D — Invoice Settings Tab

| #   | Logic                                                                           | Explanation                                                                                                                             |
| --- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 22  | Format selector: PDF or PNG                                                     | A Mantine `Select` with options `[{ value: 'pdf', label: 'PDF' }, { value: 'png', label: 'PNG' }]`.                                     |
| 23  | PNG Quality selector is only active when format is PNG                          | When format is `pdf`, the quality select is disabled.                                                                                   |
| 24  | PNG quality options: 3×, 4×, 5×, 6×, 8×                                         | 3× = 2451 px, 4× = 3268 px, 5× = 4085 px, 6× = 4902 px, 8× = 6536 px. These translate to DPI multipliers for the PDF-to-PNG conversion. |
| 25  | An info banner informs operators the setting applies to future generations only | Mantine `Alert` with icon: "Changes apply to the next invoice generation."                                                              |
| 26  | Settings fetched on mount via `GET /api/settings/invoice`                       | Populates format and pngQuality selects.                                                                                                |
| 27  | `hasChanges` comparison gates the Save button                                   | Boolean `useMemo` comparing current values to fetched originals.                                                                        |
| 28  | Save calls `POST /api/settings/invoice`                                         | Request body: `{ format, pngQuality }`.                                                                                                 |
| 29  | Success notification: green                                                     | `showNotification({ title: 'Invoice Settings Saved', color: 'green' })`.                                                                |
| 30  | Failure notification: red                                                       | `showNotification({ title: 'Save Failed', color: 'red' })`.                                                                             |

---

## E — Invoice Message Sub-Tab (within Settings → Message Tab)

| #   | Logic                                                                            | Explanation                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 31  | The "message" tab has three sub-tabs: Invoice, Message Templates, Post Templates | Sub-tab navigation is handled by a nested `Tabs` inside `InvoiceMessageTab`.                                                                                                                                                                                             |
| 32  | Invoice sub-tab has an "Enable Editing" toggle                                   | `editingEnabled` must be `true` before any field in the invoice sub-tab accepts input. All inputs are disabled when `editingEnabled` is `false`.                                                                                                                         |
| 33  | `messageTemplate` field requires `{drive_files}` placeholder                     | Mantine form validation rejects the field if `{drive_files}` is not present in the string. Error: "Message template must include {drive_files}".                                                                                                                         |
| 34  | `messageTemplate` field also requires `{shopee_link}` placeholder                | Same validation logic. Error: "Message template must include {shopee_link}".                                                                                                                                                                                             |
| 35  | `paymentChannelsUrl` field is required                                           | Mantine form validation rejects empty string. Error: "Payment channels URL is required".                                                                                                                                                                                 |
| 36  | Invoice sub-tab data is fetched on mount via `GET /api/invoice-settings`         | Populates `messageTemplate` and `paymentChannelsUrl`.                                                                                                                                                                                                                    |
| 37  | Save calls `PUT /api/invoice-settings`                                           | Request body: `{ messageTemplate, paymentChannelsUrl }`.                                                                                                                                                                                                                 |
| 38  | Success notification: green                                                      | `showNotification({ title: 'Invoice Settings Saved', color: 'green' })`.                                                                                                                                                                                                 |
| 39  | Failure notification: red                                                        | `showNotification({ title: 'Save Failed', color: 'red' })`.                                                                                                                                                                                                              |
| 40  | "Reset to Default" requires **double SweetAlert2**                               | **First**: `Swal.fire({ title: 'Reset to Default?', icon: 'warning', showCancelButton: true })`. **Second**: `Swal.fire({ title: 'Confirm Reset', confirmButtonColor: '#d33' })`. Only after both confirmations is the form reset to `DEFAULT_INVOICE_MESSAGE_TEMPLATE`. |

---

## F — Module Operations (Install / Uninstall / Update / Enable / Disable)

| #   | Logic                                                             | Explanation                                                                                                                                                    |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 41  | Install calls `POST /api/modules/install` with `{ moduleId }`     | On success: `showNotification({ title: 'Module Installed', color: 'green' })`. On failure: `showNotification({ title: 'Installation Failed', color: 'red' })`. |
| 42  | Uninstall calls `POST /api/modules/uninstall` with `{ moduleId }` | On success: `showNotification({ title: 'Module Uninstalled', color: 'green' })`. On failure: `showNotification({ title: 'Uninstall Failed', color: 'red' })`.  |
| 43  | Update calls `POST /api/modules/update` with `{ moduleId }`       | On success: `showNotification({ title: 'Module Updated', color: 'green' })`. On failure: `showNotification({ title: 'Update Failed', color: 'red' })`.         |
| 44  | Enable and Disable use mock `setTimeout` (FUTURE: real endpoints) | Both show `showNotification({ title: 'Module Enabled/Disabled', color: 'green' })` on mock success, red on failure.                                            |
| 45  | Each operation sets a loading state for the button                | `setOperatingModule(moduleId)` prevents double-clicks during the API call; cleared in `finally`.                                                               |
