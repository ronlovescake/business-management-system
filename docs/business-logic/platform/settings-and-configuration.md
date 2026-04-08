# Platform — Settings And Configuration

> **Source files:**
>
> - `src/app/settings/page.tsx`
> - `src/app/settings/_components/SettingsPageClient.tsx`
> - `src/app/api/settings/accounting/route.ts`
> - `src/app/api/settings/invoice/route.ts`
> - `src/app/api/settings/payment-cards/route.ts`
> - `src/app/api/settings/payment-cards/[id]/route.ts`
> - `src/app/api/settings/transactions/route.ts`

---

## A — Settings Entry Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | `/settings` is the platform-owned settings entry point | The page delegates to `SettingsPageClient` and acts as the shared home for cross-domain settings workflows. |
| 2 | Settings logic is split by concern rather than stored as one giant record | Accounting, invoice output, transactions behavior, and payment cards each use their own persistence pattern and API route. |

---

## B — Accounting Settings Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 3 | Accounting settings preserve cutover dates by domain | The current settings record stores clothing and general-merchandise cutover dates separately. |
| 4 | The accounting settings table is created defensively if missing | The route uses raw SQL table-creation safeguards instead of assuming migrations already exist. |
| 5 | GET returns the latest accounting settings record | The platform treats the newest saved record as the current settings source of truth. |

---

## C — Invoice Settings Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 6 | Invoice settings are file-backed JSON, not database-backed | The route persists invoice output settings to `settings/invoice-settings.json`. |
| 7 | The current invoice output format choices are `pdf` and `png` | Operators select from a constrained output-format set rather than arbitrary renderer names. |
| 8 | PNG quality is validated on a 1-to-10 scale | The settings API rejects out-of-range image-quality values. |
| 9 | Missing invoice settings fall back to defaults | Default behavior is `format='png'` and `pngQuality=8` when no saved file exists yet. |
| 10 | Invoice settings are currently single-server local-disk settings | Because persistence is file-based, this configuration is not inherently distributed across multiple app instances. |

---

## D — Payment Card Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 11 | Payment cards are stored as managed settings records | Operators can maintain a list of reusable payment-card details through the settings API. |
| 12 | Payment cards are listed in bank-and-label order | The GET route sorts cards to keep the management view stable and predictable. |
| 13 | Card creation requires normalized payment-card payload structure | Card writes go through payload normalization before persistence. |
| 14 | The core payment-card fields are bank, label, name-on-card, and optional last four digits | The settings flow is about reusable identifiers, not full sensitive card storage. |
| 15 | Card deletion is a hard remove by ID | The current route deletes the record directly rather than using soft delete semantics. |

---

## E — Transaction Settings Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 16 | Transaction settings are lazily initialized | When no settings record exists, GET creates a default one automatically. |
| 17 | `minSpareRows` defaults to `50` | The transactions settings record preserves a spare-row buffer for the transactions surface. |
| 18 | Several transaction fields can be made read-only by configuration | The current settings record manages read-only flags for unit price, line total, invoice date, packed date, and shipment code. |
| 19 | Read-only flags default to `true` in the generated settings record | The current baseline configuration is protective rather than permissive. |
| 20 | PUT only updates the provided transaction-setting fields | The API builds a partial update payload rather than forcing a full record replacement on every save. |

---

## F — Current Caveats

| # | Logic | Explanation |
| --- | --- | --- |
| 21 | Settings persistence is intentionally mixed today | Some settings are database-backed, some are file-backed, and that difference matters operationally for replication and backup expectations. |
| 22 | Defensive creation logic indicates settings storage is expected to survive partial schema rollout | The APIs are written to keep operator settings workflows alive even when some persistence infrastructure lags behind. |