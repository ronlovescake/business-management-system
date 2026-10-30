# Platform — Read-Only AI Business Assistant & 24/7 Deterministic Monitoring

> **Source files:**
>
> - `src/lib/ai/types.ts`
> - `src/lib/ai/store.ts`
> - `src/lib/ai/settings.ts`
> - `src/lib/ai/providers.ts`
> - `src/lib/ai/copilot-provider.ts`
> - `src/lib/ai/provider-http.ts`
> - `src/lib/ai/tools/index.ts`
> - `src/lib/ai/tools/investigative-tools.ts`
> - `src/lib/ai/tools/investigative-access.ts`
> - `src/lib/ai/tools/cash-reconciliation-tool.ts`
> - `src/lib/ai/tools/clothing-cash-reconciliation.ts`
> - `src/lib/ai/tools/customer-history-tool.ts`
> - `src/lib/ai/tools/database-read-only-tool.ts`
> - `src/lib/ai/tools/knowledge-base-tool.ts`
> - `src/lib/ai/monitors/index.ts`
> - `src/lib/ai/orchestrator.ts`
> - `src/components/ai-chat/AiChatWidget.tsx`
> - `src/components/ai-chat/ChatMessageContent.tsx`
> - `src/components/layout/AppLayout.tsx`
> - `src/modules/settings/global/components/ai-assistant/AiAssistantTab.tsx`
> - `src/modules/settings/global/components/ai-assistant/AiProviderSettingsCard.tsx`
> - `src/modules/settings/global/components/ai-assistant/AiAssistantWorkspaceCard.tsx`
> - `src/app/api/settings/ai-assistant/route.ts`
> - `src/app/api/ai-assistant/alerts/route.ts`
> - `src/app/api/ai-assistant/chat/route.ts`
> - `src/app/api/internal/ai-monitor/run-due/route.ts`
> - `scripts/run-backup-scheduler.js`

---

## A — Strictly Read-Only Invariant & RBAC Domain Isolation Rules

| #   | Logic                                                      | Explanation                                                                                                                                                                                                     |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | AI tools are strictly read-only (`readOnly: true`)         | Every tool registered in `READ_ONLY_BUSINESS_TOOLS` performs `SELECT` / `findMany` queries only. No tool can create, update, or delete transactions, invoices, payments, ledger rows, or inventory records.     |
| 2   | Deterministic code calculates; AI explains and prioritizes | All aging, payment-allocation math, gross-minus-adjustment formulas, and stock checks run deterministically in TypeScript/PostgreSQL before any model is invoked.                                               |
| 3   | Business domains remain strictly isolated                  | `clothing`, `trucking`, and `general-merchandise` are queried separately and never merged into cross-domain totals.                                                                                             |
| 4   | Tool execution is gated by session RBAC                    | `resolveAllowedBusinessUnits()` and `assertBusinessUnitAccess()` verify the caller's role (`SUPER_ADMIN`, `ADMIN`, or module path grants via `getAccessibleModules()`) before any tool or alert query executes. |

---

## B — Plug-and-Play Provider Registry & Cloud Privacy Controls

| #   | Logic                                                      | Explanation                                                                                                                                                                                                                                       |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5   | Runtime provider switching without code changes            | Operators can switch between local LAN **Ollama** (`ollama`), **Google Gemini** (`google`), **OpenAI** (`openai`), and **GitHub Copilot** (`copilot`) from `/settings?tab=ai-assistant`.                                                          |
| 6   | Server-only API credentials with live `.env` reload        | Cloud API keys (`GOOGLE_GENERATIVE_AI_API_KEY` / `GEMINI_API_KEY`, `OPENAI_API_KEY`) and `OLLAMA_BASE_URL` stay server-side. `readLiveEnvValue()` reads `.env.local` and `.env.docker` on demand so key updates apply without restarting Next.js. |
| 7   | Explicit Cloud Data Sharing gate (`allowCloudDataSharing`) | Non-synthetic prompts cannot be sent to `google`, `openai`, or `copilot` (either as primary or fallback provider) unless `allowCloudDataSharing` is explicitly enabled in settings.                                                               |
| 8   | Daily token limit and monthly USD budget enforcement       | `runBusinessAiAssistant()` checks today's token total (`dailyTokenLimit`) and the current month's estimated cloud spend (`monthlyBudgetUsd`) against `AiAuditLog` aggregates before dispatching cloud requests.                                   |
| 9   | IPv4-first DNS caching and keep-alive agent for cloud APIs | `providerFetch()` resolves IPv4 (`A`) records via `dns.promises.resolve4()` with a 10-minute cache and a shared keep-alive `https.Agent` (`family: 4`), preventing 30s+ dual-stack IPv6/systemd-resolved timeouts on Linux hosts.                 |
| 10  | Automatic Gemini model normalization and congestion retry  | Retired Gemini model IDs (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-*`) are automatically normalized to `gemini-3.8-flash`, and temporary Free Tier `503`/`429` spikes are retried with backoff.                                        |

---

### GitHub Copilot Setup And Isolation

Copilot uses the official `@github/copilot-sdk`, not an OpenAI API key or an
unofficial proxy. This integration is for one subscription owner's personal use,
not shared subscription access. Configure these server-only values in
`.env.local` or `.env.docker` (never paste the token into chat or a browser form):

```dotenv
COPILOT_GITHUB_TOKEN=<GitHub user token with Copilot access>
COPILOT_ALLOWED_USER_ID=<the subscription owner's application user ID or email>
```

Use a supported fine-grained PAT (`github_pat_`) with the Copilot Requests user
permission, or a supported OAuth user token. Classic `ghp_` PATs are not
supported. The GitHub account must have an active Copilot entitlement; Max is
not required specifically. Consult the SDK's
[authentication documentation](https://github.com/github/copilot-sdk/blob/main/docs/auth/authenticate.md).

After deploying the new dependency through the normal development workflow,
choose **GitHub Copilot (Subscription)** in AI Assistant settings, use `auto`
or discover entitled model IDs, run Test Connection, enable Cloud Data Sharing,
and save. Existing provider selection is not changed automatically. Next.js
keeps the SDK external so its bundled platform runtime resolves from
`node_modules`; the existing Docker image copies production dependencies.
Node.js must be at least 20.19 (or 22.12 on Node 22).

The provider checks the authenticated caller against the single owner configured
in `COPILOT_ALLOWED_USER_ID` before starting a non-synthetic request, for both
primary and fallback usage. Application user IDs match exactly; an owner email
matches case-insensitively against the server-resolved user email. Wildcards,
comma-separated lists, and role-based grants are not supported. Denial messages
do not expose the configured or current identity. Unattended jobs without an
authenticated user ID cannot use this
personal integration. Admin-only connection and investigation benchmarks use
synthetic data and do not require the user binding. Per-user GitHub OAuth for
shared usage is not implemented.

Each request uses a fresh temporary runtime home and session, removed at cleanup.
The child process receives no database credentials or inherited application
environment. Only explicitly registered read-only business tools are available,
with the caller's original RBAC context and a 12-call cap. Built-in and MCP tools
are excluded; configuration discovery, file hooks, host Git operations, skills,
memory, session store, and session telemetry are disabled. All other permission
requests are denied. Timeout cleanup force-stops the owned runtime.

Copilot usage consumes the GitHub account's subscription allowance, including
usage from other Copilot clients. SDK token events feed the existing daily token
counter. `estimatedCostUsd` is **0 (not priced here)** for Copilot; it does not
mean unlimited or free usage, and the application's USD budget does not cap
Copilot credits or overages. Configure spending controls in GitHub billing.
Partial or failed requests may still consume GitHub allowance even when no
successful usage record is returned.

The requested provider addition preserves read-only and domain-isolation policy;
no financial formulas, domain services, database schema, import paths, or monitor
rules change. Policy owner: the requesting application owner. Enforcement remains
in the orchestrator and approved tool services, with account/runtime isolation in
the Copilot adapter. All domains use that same boundary without changing their
individual calculations.

## C — Floating Chatbot (`AiChatWidget`) & Single-Round Pre-Execution

Provider HTTP transport lives in `src/lib/ai/provider-http.ts`; provider
selection, credentials, pricing and generation remain in `providers.ts`.
This extraction preserves the existing DNS cache, IPv4 HTTPS agent, local
fetch delegation and abort handling without changing business rules.

Investigative tools are registered in `investigative-tools.ts`, with separate
modules for cash reconciliation, customer history, and guarded SQL queries.
Clothing cash calculations retain their own implementation in
`clothing-cash-reconciliation.ts`; Trucking and General Merchandise calculations
remain in `cash-reconciliation-tool.ts`. Domain access checks are shared in
`investigative-access.ts`. The registry order and public SQL-validator export are
unchanged. This is a file-size refactor, not a change to financial calculations,
domain differences, permissions, SQL restrictions, API/job/import paths, or data.
Message sanitization and copying now live in `ChatMessageContent.tsx`, preserving
the widget's existing Markdown allowlist, copy behavior, and controls.

| #   | Logic                                                              | Explanation                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | Floating Chatbot available across all authenticated screens        | `AiChatWidget` is mounted in `AppLayout.tsx` (hidden on `/login`), offering multi-turn chat, business-unit scope filtering, quick-action prompts, and collapsible open-alert pills.                                                                                                                                                                |
| 12  | Deterministic tool pre-execution (`prefetchDeterministicToolData`) | Before calling the LLM, `orchestrator.ts` runs matching read-only PostgreSQL tools (`getUpcomingRecurringObligations`, `getOverdueInvoicesAndReceivables`, `getAccountingDiscrepancies`, `getSchedulesAndEmployeeFollowUps`) in ~10ms and injects the verified JSON snapshot directly into the prompt so the LLM completes in a single round-trip. |
| 13  | Zero-timeout deterministic Markdown fallback                       | If a cloud provider times out (>8s when prefetched PostgreSQL data is already available) or returns a `503`/`429` capacity error, `buildDeterministicFallbackMarkdown()` immediately formats and returns the verified PostgreSQL audit summary so the user never experiences a failed chat turn.                                                   |

---

### Clothing Policy Lookup

`searchKnowledgeBaseAndSOPs` retrieves curated Clothing rules, the existing
employee handbook, and pre-approved message templates. It is registered only for
Clothing and rejects direct Trucking or General Merchandise calls, including
administrator calls. Those domains require their own approved policy sources;
Clothing due dates, cancellation rules, and templates are not shared by inference.

Policy questions trigger deterministic prefetch with the user's question and
authorized business-unit scope. The model and deterministic fallback cite the
retrieved policies, templates, and handbook links instead of inventing policy.
The requesting application owner remains accountable for the canonical Clothing
workflow contract. This lookup does not change due-date calculations, cancellation
or refund approval services, financial writes, jobs, imports, or bulk actions.
Existing Clothing policy and domain differences remain unchanged. Provider-access
and cross-domain denial regressions cover the new enforcement boundaries.

## D — 24/7 Deterministic Monitoring & Alert Lifecycle

| #   | Logic                                                      | Explanation                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | Continuous background scanning via `backup-scheduler`      | `scripts/run-backup-scheduler.js` calls `POST /api/internal/ai-monitor/run-due` with `x-internal-job-token: INTERNAL_JOB_TOKEN` on its 60-second loop when `AI_MONITOR_AUTO_ENABLED=true`.                                                                                                                                                                                          |
| 15  | Deterministic rules run even when AI is offline            | `runDeterministicBusinessMonitor()` scans Clothing, Trucking, and General Merchandise for overdue invoices/AR, payment-vs-status mismatches, negative inventory, and upcoming recurring payment obligations (within 3 days).                                                                                                                                                        |
| 16  | Deduplicated alert upserts and scoped automatic resolution | Alerts are upserted by `dedupeKey` in `ai_monitoring_alerts`. Only recognized OPEN clothing transaction alerts whose records were successfully re-evaluated and whose condition cleared are automatically resolved. Snapshot timestamps protect concurrently changed alerts. Missing/deleted records, unsupported evidence, acknowledged alerts and other categories are preserved. |
| 17  | Self-healing persistence and full backup coverage          | `src/lib/ai/store.ts` provides `$queryRaw`/`$executeRaw` fallbacks if a hot-reloaded dev server has a stale cached `PrismaClient`, and `AiAssistantSetting`, `AiMonitoringAlert`, and `AiAuditLog` are registered in `backupModelRegistry.ts`.                                                                                                                                      |

### Clothing Pricing And Scan Coverage

Clothing Unit Price is already net of the per-item Discount. Both the monitor
and accounting-discrepancy tool use `quantity * unitPrice - adjustment` for
open-order balances, including positive and negative stored Discounts. General
merchandise retains its separate discount formula. Evidence includes quantity,
Unit Price, Discount and status for clothing transaction alerts.

Cancelled, Voided and Forfeited clothing orders are not open receivables and do
not undergo the open-order balance formula check. A nonzero stored balance on a
terminal order remains a critical exception. This does not certify refund or
payment histories; cancellation/refund policy remains owned by the customer-money
services and the [clothing transaction contract](../clothing/operations-transactions.md).

Discovery remains bounded to the newest 300 clothing transactions, plus older
transactions referenced by recognized OPEN alerts. Older references are fetched
in batches and only actually returned records qualify for resolution. The AI
tool independently scans its latest 250 rows. Other domains and bounded inventory
or recurring scans still detect/upsert alerts, but absence from those windows no
longer automatically resolves existing alerts. Recurring due-date logic is unchanged.
Monitoring writes alert metadata only, never financial records.

Resolution concurrency guards preserve the database timestamp as exact epoch
text rather than converting it to a JavaScript Date. The runtime-created alert
table uses microsecond timestamps; a millisecond Date equality check can leave
cleared alerts OPEN indefinitely. Parameterized SQL compares the exact token and
the OPEN status before resolving, including when a cached Prisma client lacks
the alert model. A refreshed or acknowledged alert is preserved.

Historical Cancelled, Voided or Forfeited rows may still contain nonzero stored
balances. These alerts indicate reconciliation work, not collectible debt or
authorization to rewrite the transaction. Follow the dedicated cancellation and
customer-money policies before any owner-approved correction; this monitor does
not zero balances, delete payments or infer forfeiture/refund decisions.
