# Platform — Read-Only AI Business Assistant & 24/7 Deterministic Monitoring

> **Source files:**
>
> - `src/lib/ai/types.ts`
> - `src/lib/ai/store.ts`
> - `src/lib/ai/settings.ts`
> - `src/lib/ai/providers.ts`
> - `src/lib/ai/tools/index.ts`
> - `src/lib/ai/monitors/index.ts`
> - `src/lib/ai/orchestrator.ts`
> - `src/components/ai-chat/AiChatWidget.tsx`
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
| 5   | Runtime provider switching without code changes            | Operators can switch between local LAN **Ollama** (`ollama`), **Google Gemini** (`google`), and **OpenAI** (`openai`) from `/settings?tab=ai-assistant`.                                                                                          |
| 6   | Server-only API credentials with live `.env` reload        | Cloud API keys (`GOOGLE_GENERATIVE_AI_API_KEY` / `GEMINI_API_KEY`, `OPENAI_API_KEY`) and `OLLAMA_BASE_URL` stay server-side. `readLiveEnvValue()` reads `.env.local` and `.env.docker` on demand so key updates apply without restarting Next.js. |
| 7   | Explicit Cloud Data Sharing gate (`allowCloudDataSharing`) | Non-synthetic prompts cannot be sent to `google` or `openai` (either as primary or fallback provider) unless `allowCloudDataSharing` is explicitly enabled in settings.                                                                           |
| 8   | Daily token limit and monthly USD budget enforcement       | `runBusinessAiAssistant()` checks today's token total (`dailyTokenLimit`) and the current month's estimated cloud spend (`monthlyBudgetUsd`) against `AiAuditLog` aggregates before dispatching cloud requests.                                   |
| 9   | IPv4-first DNS caching and keep-alive agent for cloud APIs | `providerFetch()` resolves IPv4 (`A`) records via `dns.promises.resolve4()` with a 10-minute cache and a shared keep-alive `https.Agent` (`family: 4`), preventing 30s+ dual-stack IPv6/systemd-resolved timeouts on Linux hosts.                 |
| 10  | Automatic Gemini model normalization and congestion retry  | Retired Gemini model IDs (`gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-*`) are automatically normalized to `gemini-3.8-flash`, and temporary Free Tier `503`/`429` spikes are retried with backoff.                                        |

---

## C — Floating Chatbot (`AiChatWidget`) & Single-Round Pre-Execution

| #   | Logic                                                              | Explanation                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11  | Floating Chatbot available across all authenticated screens        | `AiChatWidget` is mounted in `AppLayout.tsx` (hidden on `/login`), offering multi-turn chat, business-unit scope filtering, quick-action prompts, and collapsible open-alert pills.                                                                                                                                                                |
| 12  | Deterministic tool pre-execution (`prefetchDeterministicToolData`) | Before calling the LLM, `orchestrator.ts` runs matching read-only PostgreSQL tools (`getUpcomingRecurringObligations`, `getOverdueInvoicesAndReceivables`, `getAccountingDiscrepancies`, `getSchedulesAndEmployeeFollowUps`) in ~10ms and injects the verified JSON snapshot directly into the prompt so the LLM completes in a single round-trip. |
| 13  | Zero-timeout deterministic Markdown fallback                       | If a cloud provider times out (>8s when prefetched PostgreSQL data is already available) or returns a `503`/`429` capacity error, `buildDeterministicFallbackMarkdown()` immediately formats and returns the verified PostgreSQL audit summary so the user never experiences a failed chat turn.                                                   |

---

## D — 24/7 Deterministic Monitoring & Alert Lifecycle

| #   | Logic                                                 | Explanation                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | Continuous background scanning via `backup-scheduler` | `scripts/run-backup-scheduler.js` calls `POST /api/internal/ai-monitor/run-due` with `x-internal-job-token: INTERNAL_JOB_TOKEN` on its 60-second loop when `AI_MONITOR_AUTO_ENABLED=true`.                                                     |
| 15  | Deterministic rules run even when AI is offline       | `runDeterministicBusinessMonitor()` scans Clothing, Trucking, and General Merchandise for overdue invoices/AR, payment-vs-status mismatches, negative inventory, and upcoming recurring payment obligations (within 3 days).                   |
| 16  | Deduplicated alert upserts and automatic resolution   | Alerts are upserted by `dedupeKey` in `ai_monitoring_alerts`. When a previously open anomaly is no longer present in live records, its status is automatically transitioned to `RESOLVED`.                                                     |
| 17  | Self-healing persistence and full backup coverage     | `src/lib/ai/store.ts` provides `$queryRaw`/`$executeRaw` fallbacks if a hot-reloaded dev server has a stale cached `PrismaClient`, and `AiAssistantSetting`, `AiMonitoringAlert`, and `AiAuditLog` are registered in `backupModelRegistry.ts`. |
