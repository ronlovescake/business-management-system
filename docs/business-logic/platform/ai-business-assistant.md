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
> - `src/lib/ai/tools/clothing-purchase-coverage.ts`
> - `src/lib/ai/tools/clothing-cash-response.ts`
> - `src/lib/ai/tools/customer-history-tool.ts`
> - `src/lib/ai/tools/customer-address-tool.ts`
> - `src/lib/ai/tools/customer-duplicate-audit-tool.ts`
> - `src/lib/ai/tools/clothing-due-invoices.ts`
> - `src/lib/ai/tools/database-read-only-tool.ts`
> - `src/lib/ai/tools/knowledge-base-tool.ts`
> - `src/lib/ai/monitors/index.ts`
> - `src/lib/ai/orchestrator.ts`
> - `src/components/ai-chat/AiChatWidget.tsx`
> - `src/components/ai-chat/AiChatHeader.tsx`
> - `src/lib/ai/deterministic-fallback.ts`
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
unofficial proxy. The application owner can restrict access to one account or
explicitly allow all authenticated SUPER_ADMIN accounts. Configure these server-only values in
`.env.local` or `.env.docker` (never paste the token into chat or a browser form):

```dotenv
COPILOT_GITHUB_TOKEN=<GitHub user token with Copilot access>
COPILOT_ALLOWED_USER_ID=<application user ID, email, or SUPER_ADMIN>
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

The provider checks the authenticated caller against the access selector configured
in `COPILOT_ALLOWED_USER_ID` before starting a non-synthetic request, for both
primary and fallback usage. The exact value `SUPER_ADMIN` allows every authenticated
account whose server-resolved role is `SUPER_ADMIN`; it does not match an account
ID or email. Other application user IDs match exactly; an email matches
case-insensitively against the server-resolved user email. Wildcards,
comma-separated lists, and other role selectors are not supported. Denial messages
do not expose the configured or current identity. Unattended jobs without an
authenticated user ID cannot use this
integration. Admin-only connection and investigation benchmarks use
synthetic data and do not require the user binding. Per-user GitHub OAuth for
shared usage is not implemented. All allowed accounts use the configured GitHub
token and its allowance; the operator must ensure this use complies with GitHub's
subscription terms. This role selector was explicitly approved by the requesting
application owner. Existing session authentication, tool RBAC, cloud-sharing gates,
and domain isolation remain mandatory. Background jobs, imports, financial rules,
and database schema are unchanged; all business domains share this provider gate.

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

## C — Floating Chatbot (`AiChatWidget`) & Direct Answers

### Direct Answers And Organized Records

### Clothing Cash And Purchase Posting Coverage

The requesting application owner approved a read-only posting-completeness audit
after a cash explanation omitted Paid products awaiting Transit Build-Up. Cash
means combined physical Cash, Bank and GCash/e-wallet recorded funds; physical-only
cash is supplementary. The supplied comparison amount is used without repeatedly
asking whether it is real or hypothetical, but is never claimed to be an
independently verified count. A variance alone is not proof of missing money.

`reconcileClothingCash()` now includes the signed cash effect of active, dated
Transit Build-Up and inventory reclassification sources, as the balance sheet
does. It reports cash components and journal cash totals grouped by source type,
including operational/generated sources rather than only a few recent manual
entries. Noncash reclassifications and card/payable/opening funding are not
invented cash movements. Missing posted-source availability makes the book-cash
result provisional instead of turning a failed read into a verified zero.

`auditClothingPurchaseCoverage()` scans active Products (including unassigned
shipment codes), active/deleted Transit Build-Up and product/journal histories,
standalone transit openings and linked supplier-credit issue/application metadata.
It uses `PRODUCT_TRANSIT_BUILD:<id>:GRAND_TOTAL`, PRODUCT source IDs and settlement
line keys. It does not infer posting coverage from description similarity. Each
source returns checked, partial or not_checked with scanned-row counts. Product
scans cap at 5,000; other journal/build history scans cap at 20,000 each, in pages
of 500. Category totals cover scanned records; at most 50 findings are returned,
with truncation disclosed. Source errors and caps prevent unverified posting
absence from becoming a missing-cash total.

Current-period Paid Cash/Bank/GCash purchases without a linked build or product
journal can become conditional unposted-outflow candidates. Pre-cutover purchases,
opening funding, unpaid purchases, card funding, supplier-credit flags/links,
deleted history, shipment-level/partial sources and possible same-amount manual
funding receive separate treatment or review, not a blanket missing-cash claim.
Amount/account conflicts and payable-funded purchases without a matching settlement
pair are surfaced. Candidate totals remain separate from unchanged recorded cash;
conditional balances explicitly assume the payment flags represent actual money
paid and that no alternate entry covers it. No entry is posted, reconstructed,
deleted, merged or marked paid by the tool. Existing supplier/logistics/opening
policy remains authoritative; missing shipment confirmation does not authorize a
build-up posting.

The result names areas not verified: bank/GCash statements, physical count, truth
of Paid flags, unlinked combined/manual postings with different amounts, deleted
product and shipment-transfer/reclassification completeness, operational logistics
bills versus journal postings, and full supplier-credit lifecycle amounts. Reads
are bounded and non-atomic in ordinary requests; concurrent edits require review.
The assistant must report these limits rather than claim it checked everything.
Product-table follow-ups rerun this approved tool instead of sampling recent rows.
The exact cash-balance suggestion and explicit Clothing cash-coverage commands
return `deterministic-clothing-cash-coverage` directly, with zero model tokens.
They retain the existing cloud-sharing, usage and Copilot ownership/role gates;
unsupported or ambiguous wording remains on the model path. Cash/product-journal
fallback prefetch is restricted to cash reconciliation, whose deterministic renderer
shows the same source coverage and conditional findings instead of unrelated dues.
Direct-report failures surface an explicit error rather than retrying another
provider with an unrelated financial summary.
Generic SQL guidance exposes payment/cost/date/source-key fields but does not widen
its table allowlist or financial write capability. GM/Trucking reconciliation and
household behavior are intentionally unchanged; only Clothing adds this diagnostic.

Deleted source history uses fixed parameterized SELECTs against the two reviewed
Clothing source tables, because the global soft-delete middleware intentionally
overwrites ordinary Prisma read filters with active-only filtering. That middleware
is not weakened. Historical transit openings before a later purchase cannot mask
the new purchase; only dated plausible covering sources trigger opening review.
These are diagnostic reads, not a financial repair or authorization to repost.

### Clothing Invoice Deadlines Versus Trusted Credit

The requesting application owner confirmed the Due Dates board's calculation:
unpaid Prepared invoices are due at the end of the third Manila calendar day
after the invoice date. `getOverdueInvoicesAndReceivables` now selects eligible
Prepared invoices and uses `DueDateService.calculateDueDate`, filtering overdue
or upcoming rows before its returned-row limit. It uses the board's positive
stored line balance rather than inventing a separate gross-minus-payments balance.
Invalid invoice dates, paid/nonpositive lines and non-Prepared statuses are excluded.
Scans page through at most 5,000 eligible rows; the tool discloses scan truncation,
matched count and additional display rows instead of falsely asserting none exist.

The exact chat suggestions "List customers with past due dates" and "List customers
with due dates coming" return a deterministic table of the matching Clothing
invoices, preserving authorization and Copilot ownership/role checks. The model
path uses the same tool and approved policy for other wording. Product display
codes, Manila deadlines and recorded unpaid amounts are kept intact.

Trusted-customer Clothing A/R, including legacy Pending Payment compatibility,
has no automatic deadline and is not included in overdue/upcoming lists or
automatic overdue alerts. Owner discretion governs follow-up. Common payment
within a week or one to two months is not an automatic term. New A/R transitions,
bulk updates and imports no longer generate two-month deadlines; existing legacy
date values and shipment history are not erased. The monitor reuses Prepared
invoice deadlines while keeping the legacy `clothing:overdue-receivable` key for
snapshot-safe alert lifecycle compatibility. Re-evaluated obsolete OPEN A/R alerts
can resolve on the next normal monitor run; no live monitor or repair is run as
part of this code change. General Merchandise and Trucking rules are unchanged.
No financial amounts, inventory, customer approvals or schema are changed.

The chat business selector now defaults to Clothing. Scope storage uses version 2:
legacy implicit `ALL` selections migrate to Clothing once, legacy explicit business
selections are preserved, and subsequent explicit choices (including All) persist
for the tab session. The scope is a query preference, not authorization; API/tool
domain checks remain mandatory. Existing conversation and zoom state are retained.

The requesting application owner approved local, sourced answers for clearly
covered Clothing policy questions and a complete table alongside customer order
counts. `isDirectKnowledgeQuestion()` deliberately recognizes only a small set of
self-contained questions, including the late-payment, cancellation-status, refund
process, and due-date examples. Other wording, mixed questions, live-record policy
decisions, and ambiguous follow-ups remain on the provider path. These local
answers reuse the authorized knowledge tool and deterministic policy renderer;
policy IDs, document references, and handbook links identify their sources.

Named Clothing questions matching "how many orders does NAME have/has" can use
`customer-order-answer.ts` to render customer identity, exact transaction-record
count and a Markdown table directly from live customer-tool output. Pronouns,
multiple history matches, conflicting directory IDs, missing customer IDs, and
inconsistent counts do not qualify. Name-substring search retains the existing
customer tool semantics; this is not a new identity-merging or distinct-order rule.
Product names come from linked product records; codes remain available when a
product name is missing. Rows remain ordered by transaction ID, not date.

Matching transaction details default to at most 100 rows (`orderLimit`, clamped
to 1–100), with total/returned counts and `hasMoreTransactions`. A 36-row history
is shown completely in the first answer. Larger histories explicitly say how many
rows were shown and link to customer records; they must never be labelled "all".
The generic SQL tool retains its separate 25-row cap. Empty or ambiguous customer
results retain the model path rather than inventing a zero count. No live result
is cached across requests. The existing customer query still loads matching
transaction/payment history before formatting; database scan optimization is not
claimed by this change.

Response instructions use tables for records, bullets for findings and numbered
lists for procedures or rankings. At the application owner's request, database
primary keys are internal by default: customer/product IDs, transaction/payment
row IDs and recurring-template IDs are not printed as identifying labels or a
Record ID column. Use names, dates, products, quantities, statuses, amounts and
UI-visible business references instead. Raw IDs may be supplied on explicit ID
or technical-debugging requests; tool payloads, audit evidence and authorization
retain their identifiers. Direct customer tables omit both the customer-ID label
and database order-ID column without dropping rows. This is a presentation-only
change, not a query, financial or identity-policy change. It reduces unnecessary
output but does not establish a measured latency improvement.
Product references use `Product Name (FULL-PRODUCT-CODE)`, for example
`Premium Shortsleeves Onesie (PSO-101226)`. Preserve the exact full code, including
date and variant suffixes, in summaries and tables. Product/order SQL lookups
should retrieve the name and code together. Missing codes must be retrieved
through authorized tools when possible or identified as not recorded, never
invented. UI-visible product codes are not database primary keys and remain
visible even when internal IDs are omitted.
Direct tables escape database text and use the
existing sanitized Markdown renderer. The pending widget UI is not modified.
Default domain selection remains Clothing when authorized; explicit sibling
domains do not receive Clothing fast-path answers. Authentication at the chat API,
tool authorization, cloud-sharing and usage gates remain unchanged. Copilot local
answers also enforce the configured user/role selector before any fallback.

Local successes use model labels `deterministic-knowledge` or
`deterministic-customer-orders`, zero model tokens, `usedFallback: false`, and
explicit execution-mode audit metadata. The provider field records the selected
provider, not evidence that a cloud request occurred. Copilot records SDK startup,
session setup and combined model/tool wait timings; tool traces report execution
duration and request-local cache hits. Identical successful tool calls may reuse
results within one Copilot request; errors are not cached, different arguments
remain distinct and all invocations still count against the 12-call cap.
Model/tool wait includes tool execution and must not be added to those durations.
Orchestration timing excludes settings lookup and final audit insertion; provider
timings exclude runtime cleanup. These measurements are not end-to-end browser
latency or a promised speedup. No financial rules, schema, jobs, imports or
production operations change; all domain permission boundaries remain intact.

Provider-failure audits now retain sanitized failure categories and validated
Copilot phase diagnostics even when fallback returns successfully. Failure phases
distinguish runtime startup, session setup, model response and active tool execution;
records contain elapsed milliseconds, tool-call counts and active registered tool
names, not raw errors, credentials, prompts, addresses or tool arguments. The
generation response includes a safe `fallbackReason`. Authentication/configuration,
quota/capacity, timeout and tool-call-limit failures have separate descriptions;
unknown errors remain generic rather than exposing provider response bodies.

`latencyMs` now includes failed primary/secondary attempts, runtime cleanup and
local fallback work, measured from generation start after settings and initial
gates. It no longer reports only a few milliseconds of local tool work after a
45-second provider wait. Final audit insertion, settings lookup and browser/network
rendering are outside that measurement. Deterministic failure recovery is labelled
`local-fallback` in audit metadata, separate from a successful zero-model fast path.
The 45-second per-provider timeout, SDK capability isolation, permission checks
and fallback selection policy are unchanged. A successful READY connection test
does not validate the full model/tool workflow; phase diagnostics are needed to
identify a stalled business request. This change improves failure handling and
observability; it does not prove that the external provider timeout is resolved.

Provider HTTP transport lives in `src/lib/ai/provider-http.ts`; provider
selection, credentials, pricing and generation remain in `providers.ts`.
This extraction preserves the existing DNS cache, IPv4 HTTPS agent, local
fetch delegation and abort handling without changing business rules.

Size-gate follow-up: the existing chat-header markup/controls now live in
`AiChatHeader.tsx`, with state retained in the widget. The deterministic fallback
renderer and record type moved unchanged to `deterministic-fallback.ts`. The
existing AI tests were divided into adjacent orchestration/monitoring and
investigative/customer suites without removing test cases. These mechanical
splits preserve runtime behavior and make the required guardrail pass without
exceptions; they are not new financial, permission or deadline rules.

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

| #   | Logic                                                       | Explanation                                                                                                                                                                                                                                                                                                              |
| --- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 11  | Floating Chatbot available across all authenticated screens | `AiChatWidget` is mounted in `AppLayout.tsx` (hidden on `/login`), offering multi-turn chat, business-unit scope filtering, quick-action prompts, and collapsible open-alert pills.                                                                                                                                      |
| 12  | Authorized direct answers and provider tools                | Supported standalone Clothing policy and unambiguous named customer order-count questions can return locally without a model call. Other questions use provider-selected tools. `prefetchDeterministicToolData()` runs in provider-failure handling, not before successful model requests.                               |
| 13  | Deterministic Markdown after provider failure               | Provider attempts use a 45-second timeout. After the applicable primary/fallback attempts fail, available deterministic tool evidence is rendered by `buildDeterministicFallbackMarkdown()`; if no evidence is available, the error is surfaced. There is no 8-second success-path shortcut or guaranteed response time. |

---

### Clothing Policy Lookup

`searchKnowledgeBaseAndSOPs` retrieves curated Clothing rules, the existing
employee handbook, and pre-approved message templates. It is registered only for
Clothing and rejects direct Trucking or General Merchandise calls, including
administrator calls. Those domains require their own approved policy sources;
Clothing due dates, cancellation rules, and templates are not shared by inference.

Supported standalone Clothing policy questions can return locally as described
above. Other questions use the model; deterministic retrieval is also used after
provider failure, with the user's question and authorized business-unit scope.
The model and deterministic fallback cite the
retrieved policies, templates, and handbook links instead of inventing policy.
The requesting application owner remains accountable for the canonical Clothing
workflow contract. This lookup does not change due-date calculations, cancellation
or refund approval services, financial writes, jobs, imports, or bulk actions.
Existing Clothing policy and domain differences remain unchanged. Provider-access
and cross-domain denial regressions cover the new enforcement boundaries.

## D — 24/7 Deterministic Monitoring & Alert Lifecycle

### Read-Only Clothing Duplicate Audit

The requesting application owner approved a deterministic customer-directory audit
for possible re-registration under different names. `auditPossibleCustomerDuplicates`
compares active Clothing customers and their active primary/business/alternate
addresses. It reuses the shared normalized-phone and specific-address matcher;
phone groups and an address-term index generate candidate pairs rather than asking
the model to construct an unrestricted directory investigation. Blank/short phones,
names alone and generic region text are not matching evidence. Phone matches
require at least seven normalized digits. Address pairs must share three distinctive
terms and meet the existing directional coverage rule in at least one direction.

Reads are paginated by customer ID, 500 per page, capped at 5,000 active customers.
At most 20,000 candidate pairs are compared; at most 50 matched pairs are displayed.
Counts describe the scanned/compared population only, and any scan/comparison cap
is prominently disclosed. A result below these limits still does not establish
identity or prove that no duplicates exist. Existing Banned status is reported
and prioritized for review, not inferred or changed; shared details do not prove
ban evasion. Pairs with multiple matching signals sort ahead within that priority.
Names, recorded statuses, normalized shared phones and matching addresses/terms
are formatted directly in a sanitized Markdown table; no database ID column is
shown. The full customer directory is not sent to a cloud model.

Recognized Clothing duplicate-audit chat questions execute the authorized tool
and return `deterministic-customer-duplicate-audit`, with zero model tokens and
`usedFallback: false`. Existing Copilot owner/role, cloud-sharing and usage gates
are retained. Named customer count questions and duplicate-payment questions are
not rerouted into this directory audit. Other business domains receive an explicit
unsupported-scope message rather than Clothing records. A failed audit returns a
specific failure and writes a safe error audit; it must never substitute unrelated
dues or receivables. Duplicate-audit topics are excluded from generic keyword
fallback prefetch. The timeout is unchanged; this route avoids model round trips
instead of extending them.

No customer is merged, banned, deleted, linked or edited. API/import/bulk customer
creation, the Add Customer advisory warning and financial rules are unchanged.
General Merchandise and Trucking directory-wide audits are not enabled. The only
shared consumer change is reuse of the same phone normalization in Add Customer.

### Possible Customer Matches From Addresses

The requesting application owner approved read-only delivery/waybill candidate
lookup after an address containing an inserted landmark was missed. The registered
`findCustomersByAddress` tool searches primary `address`, `businessAddress`, and
active additional customer information with `type: 'address'`. Customers and
additional information with `deletedAt` set are excluded. Clothing and General
Merchandise use their own directories and the caller's existing domain authorization;
Trucking is explicitly unsupported by this tool. Existing duplicate-customer,
dispatch approval, identity-linking and financial rules are unchanged.

Matching normalizes case, accents, punctuation, `Pk`/`Purok`, `Brgy`/`Barangay`,
and parenthetical notes. Generic region/administrative words are not sufficient
evidence. At least three distinctive query terms are required; a candidate address
must share at least three and cover at least 60% of the query terms. Candidates
are ranked by 80% query-term coverage and 20% the existing address-similarity
utility, using each customer's best matching address. Equal scores sort by
customer ID for stability, not identity confidence. Scores measure text similarity,
not probability; returned shared and missing terms explain the comparison.

The tool reads pages of 500 active customers, capped at 5,000 customers per call,
and returns at most five candidates with the matched address and address source.
It exposes scanned count, candidate count and a scan-limit warning. A limited
search or no returned candidate does not prove a customer is absent. No candidates
are cached across requests, and no records are written or linked. Names and
addresses of candidates are returned only through the authorized tool context;
the full directory and unnecessary contact details are not sent to the model.

The assistant must call this tool for waybill/address matching instead of passing
an address to the name-only history search or claiming address fields do not exist.
It presents possible matches and requests an independent recipient, phone or
landmark check before linking or dispatching. Tool schema guidance includes the
real primary/business/alternate address fields without widening the guarded SQL
allowlist. This lookup remains model-tool driven, not a guaranteed zero-model
fast path. Regression coverage includes the supplied Jewel address, extra landmark
and postal text, alternate addresses, ambiguous households, generic-only input,
domain denial/separation, later pages and capped-search disclosure.

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
