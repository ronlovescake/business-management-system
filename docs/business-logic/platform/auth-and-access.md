# Platform — Auth And Access

> **Source files:**
>
> - `src/lib/auth/auth.ts`
> - `src/lib/auth/session.ts`
> - `src/lib/auth/permissions.ts`
> - `src/lib/auth/password-reset.ts`
> - `src/app/api/auth/[...nextauth]/route.ts`
> - `src/app/api/auth/redirect/route.ts`
> - `src/app/api/auth/password/forgot/route.ts`
> - `src/app/api/auth/password/reset/route.ts`
> - `src/app/api/users/profile/photo/route.ts`
> - `src/modules/auth/login/**`
> - `src/modules/auth/password/**`
> - `src/modules/auth/profile/**`

---

## A — Login And Session Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 1 | Login uses the credentials provider with email and password | Authentication is handled through NextAuth credential login rather than a custom session engine. |
| 2 | Login rejects missing or invalid credentials with a generic message | The auth flow avoids exposing whether the email or the password was the problem. |
| 3 | Only active, non-deleted users may authenticate | The auth lookup requires a real user whose account is not soft-deleted and is marked active. |
| 4 | Password comparison is bcrypt-based | Stored password hashes are checked through `bcryptjs` rather than plaintext or reversible encryption. |
| 5 | Successful login updates `lastLoginAt` | The platform records the user's most recent successful sign-in time. |
| 6 | Session state uses JWT strategy with a 30-day max age | Session payload carries core user identity fields such as ID, role, email, and photo URL. |
| 7 | Session refresh updates identity presentation fields | JWT/session callbacks keep `photoUrl` and `name` aligned after profile changes. |
| 8 | Post-login redirection is permission-aware | `/api/auth/redirect` sends the user to `getFirstAccessibleModule()` and falls back to `/` when no module route is available. |

---

## B — Permission And Access Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 9 | `SUPER_ADMIN` and `ADMIN` are treated as universal-access roles | Admin-class users can access all active modules without requiring per-module `UserPermission` rows. |
| 10 | Non-admin access is module-permission based | Regular users depend on `UserPermission` records keyed by user and module. |
| 11 | `hasModuleAccess()` is the core permission check for route ownership | Module path access is decided through the shared permissions layer instead of by each page inventing its own rule. |
| 12 | `getFirstAccessibleModule()` defines the user's landing target | Admins use a fixed default landing route of `/clothing/operations/transactions`; regular users resolve to their first permitted module by module sort order. |
| 13 | `requireAuth()` and role wrappers are the platform guard primitives | Route handlers and server logic use `requireAuth()`, `requireRole()`, `requireAdmin()`, and `requireSuperAdmin()` for access enforcement. |
| 14 | `BYPASS_AUTH_FOR_TESTS=true` disables normal auth enforcement | This is an explicit test/development bypass and should not be treated as normal production behavior. |

---

## C — Password Reset Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 15 | Forgot-password does not reveal whether a user exists | The route returns a success-style response even when the email is not found to reduce user enumeration risk. |
| 16 | Reset requests are rate-limited by cooldown | The platform enforces a 2-minute cooldown between password-reset requests for the same user. |
| 17 | Reset tokens are random, hashed, and time-limited | The reset flow generates a 32-byte random token, stores only its SHA-256 hash, and expires it after 30 minutes. |
| 18 | Reset emails carry a raw token link to `/reset-password` | The email payload points the operator to the reset page with the token in the query string. |
| 19 | Reset completion requires a valid, unused, unexpired token | Invalid, consumed, or expired links are rejected with a dedicated reset-link error. |
| 20 | Completing a reset consumes the token and revokes sibling active reset tokens | A successful reset closes the current token and invalidates other outstanding reset tokens for the same user. |

---

## D — Profile Management Rules

| # | Logic | Explanation |
| --- | --- | --- |
| 21 | Profile reads are self-service for the authenticated user | The profile page fetches the current user's identity, role, login metadata, and profile fields. |
| 22 | Name changes and password changes share the profile-management surface | The operator updates core personal account information through the same profile workflow. |
| 23 | Password changes require current-password verification | The profile form does not allow silent password replacement without confirming the current password first. |
| 24 | New profile passwords must meet the minimum client-side rule set | The current workflow expects a minimum six-character password and matching confirmation. |
| 25 | Profile photo upload is self-service for the authenticated user | `POST /api/users/profile/photo` accepts multipart upload under the `photo` field, writes the file into `public/uploads/profiles`, updates `photoUrl`, and returns the refreshed user payload. |
| 26 | Profile photo upload is restricted by file type and size | The upload route accepts JPEG, PNG, and WebP only, and rejects files larger than 5 MB. |
| 27 | Profile photo removal clears the persisted avatar reference | `DELETE /api/users/profile/photo` sets `photoUrl` to `null`; the client then refreshes the session/profile so the active avatar updates immediately. |
| 28 | Successful profile updates trigger session refresh behavior | Session callbacks keep the active client session aligned with saved profile changes, including avatar updates. |

---

## E — Scope Note

| # | Logic | Explanation |
| --- | --- | --- |
| 29 | Shared access-control rules apply to platform-owned admin surfaces too | Backup / restore, settings, and other admin workflows build on these auth and permission rules even when their business logic is documented elsewhere. |