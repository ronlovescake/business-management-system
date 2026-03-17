# Clothing - Employees: Settings Business Logic

> **Source files:**
>
> - `src/app/clothing/employees/settings/page.tsx`

---

## A - Page Layout

| #   | Logic                                                                              | Explanation                                                        |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Single settings card: "Stay-in Attendance Automation"                              | Only one automation setting group is present in this module.       |
| 2   | A `LoadingOverlay` covers the card during `loading`, `saving`, or `running` states | Prevents interaction while async operations are in progress.       |
| 3   | Settings are fetched via `GET /employee-automation-settings` on mount              | Initial values are stored as `initial` state for change detection. |

---

## B - Automation Settings Fields

| #   | Logic                                                                                     | Explanation                                                                   |
| --- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 4   | `stayInAutoPresenceEnabled` — Mantine `Switch` toggle                                     | Enables or disables the stay-in auto-presence automation. Defaults to `true`. |
| 5   | `stayInAutoPresenceTime` — time input (24-hour format)                                    | The scheduled time when the automation runs daily. Default: `'02:00'`.        |
| 6   | `stayInAutoPresenceTimezone` — text input                                                 | Timezone identifier for the scheduled time. Default: `'Asia/Manila'`.         |
| 7   | `stayInAutoPresenceGraceMinutes` — number input, range 0–120, step 5                      | Grace period in minutes added to the automation time window.                  |
| 8   | Time input and timezone input are **disabled** when `stayInAutoPresenceEnabled === false` | Prevents editing time settings when automation is off.                        |

---

## C - Change Detection

| #   | Logic                                                                  | Explanation                                                                 |
| --- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------ | --- | -------- | --------------------------------------------------- |
| 9   | `hasChanges` is `true` when `draft` state differs from `initial` state | Computed by comparing each field value between the two objects.             |
| 10  | Save button is disabled when `!hasChanges                              |                                                                             | saving |     | running` | Prevents redundant saves and concurrent operations. |
| 11  | Reset button is disabled when `!hasChanges && !error && !success`      | Only active when there are changes to discard or a status message to clear. |

---

## D - Save Settings

| #   | Logic                                                                                        | Explanation                                                                            |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 12  | "Save Settings" button sends only the changed fields via `PUT /employee-automation-settings` | Delta update: only fields that differ from `initial` are included in the request body. |
| 13  | On success: green Mantine `Alert` displays `'Automation settings updated successfully.'`     | `initial` state is updated to the newly saved values; `hasChanges` resets to `false`.  |
| 14  | On error: red Mantine `Alert` displays the error message returned from the API               | Displayed inline on the card, not a toast or modal.                                    |

---

## E - Reset Settings

| #   | Logic                                                                                                                      | Explanation                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 15  | "Reset" button reverts `draft` state back to `initial` state                                                               | Discards all unsaved changes made since the last save or page load.    |
| 16  | If no `initial` state is available (e.g. fetch failed), Reset triggers a fresh `GET /employee-automation-settings` refetch | Fallback to ensure the form can always be reset to a known good state. |

---

## F - Run Automation Now

| #   | Logic                                                                                                                      | Explanation                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 17  | "Run Automation Now" button sends `POST /employee-automation-settings`                                                     | Triggers an immediate execution of the stay-in attendance automation, regardless of scheduled time. |
| 18  | `running` state is set to `true` during the POST request                                                                   | The `LoadingOverlay` is shown and all buttons are disabled.                                         |
| 19  | On success: green Mantine `Alert` displays a summary: `'Processed: {processed}, Inserted: {inserted}, Skipped: {skipped}'` | Numbers come from the API response body.                                                            |
| 20  | On error: red Mantine `Alert` displays the error message                                                                   | Displayed inline on the card.                                                                       |
