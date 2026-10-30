import {
  describeProviderFailure,
  getProviderFailureDiagnostics,
} from './provider-failure';
import {
  buildDeterministicFallbackMarkdown,
  type PrefetchedToolRecord,
} from './deterministic-fallback';
import { generateWithProvider, type AiChatHistoryMessage } from './providers';
import { ensureAiAssistantTables, getAiAssistantSettings } from './settings';
import {
  findMonitoringAlertByIdFromStore,
  insertAuditLogToStore,
  updateMonitoringAlertExplanationInStore,
} from './store';
import { assertBusinessUnitAccess, getToolsForContext } from './tools';
import { isDirectKnowledgeQuestion } from './tools/knowledge-base-tool';
import {
  isDirectClothingCashQuestion,
  formatClothingCashCoverage,
  type ClothingCashResult,
} from './tools/clothing-cash-response';
import {
  getDirectClothingDueMode,
  formatClothingDueInvoices,
  type ClothingDueInvoicesResult,
} from './tools/clothing-due-invoices';
import {
  isCustomerDuplicateAuditQuestion,
  formatCustomerDuplicateAudit,
  type CustomerDuplicateAuditResult,
} from './tools/customer-duplicate-audit-tool';
import {
  getDirectCustomerSearch,
  formatCustomerOrders,
} from './tools/customer-order-answer';
import type {
  AiBusinessUnit,
  AiGenerationResult,
  AiProviderId,
  AiToolCallTrace,
  AiToolDefinition,
  AiToolExecutionContext,
  AiTriggerSource,
  AiProviderFailureDiagnostics,
} from './types';

async function prefetchDeterministicToolData(params: {
  userPrompt: string;
  tools: AiToolDefinition[];
  toolContext: AiToolExecutionContext;
  targetBusinessUnit?: AiBusinessUnit;
}): Promise<{
  records: PrefetchedToolRecord[];
  traces: AiToolCallTrace[];
}> {
  if (!params.tools.length) {
    return { records: [], traces: [] };
  }

  const q = params.userPrompt.toLowerCase();
  const wantCashCoverage =
    /\bcash\b|\bfunds\b|transit build|unjournal|products?.*journal/i.test(q);
  if (isCustomerDuplicateAuditQuestion(q)) {
    return { records: [], traces: [] };
  }
  const wantRecurring =
    /recurring|loan|rent|utilit|obligation|due this week|upcoming payment|template|draft/i.test(
      q
    );
  const wantOverdue =
    /overdue|invoice|receivable|unpaid|balance|customer|collect|follow-up|follow up|aging|payment/i.test(
      q
    );
  const wantDiscrepancy =
    /discrepanc|mismatch|audit|shortage|accounting|negative|stock|inventory|anomal|error/i.test(
      q
    );
  const wantSchedule =
    /schedule|shift|leave|employee|staff|driver|attendance|absent/i.test(q);
  const wantKnowledge =
    /policy|handbook|sop|procedure|what to do|what should|how to|rule|template|grace period|cancell|forfeit|penalty|guide/i.test(
      q
    );

  const anySpecificMatch =
    wantRecurring ||
    wantOverdue ||
    wantDiscrepancy ||
    wantSchedule ||
    wantKnowledge;

  const selectedTools = params.tools.filter((t) => {
    if (wantCashCoverage) {
      return t.name === 'reconcileCashAndFindDiscrepancies';
    }
    if (!anySpecificMatch) {
      return true;
    }
    if (
      t.name === 'getUpcomingRecurringObligations' &&
      (wantRecurring || wantOverdue)
    ) {
      return true;
    }
    if (t.name === 'getOverdueInvoicesAndReceivables' && wantOverdue) {
      return true;
    }
    if (t.name === 'getAccountingDiscrepancies' && wantDiscrepancy) {
      return true;
    }
    if (t.name === 'getSchedulesAndEmployeeFollowUps' && wantSchedule) {
      return true;
    }
    if (t.name === 'searchKnowledgeBaseAndSOPs' && wantKnowledge) {
      return true;
    }
    return false;
  });

  const targetUnits: AiBusinessUnit[] = params.targetBusinessUnit
    ? [params.targetBusinessUnit]
    : params.toolContext.allowedBusinessUnits;

  const records: PrefetchedToolRecord[] = [];
  const traces: AiToolCallTrace[] = [];

  for (const tool of selectedTools) {
    for (const unit of targetUnits) {
      if (!tool.businessUnits.includes(unit)) {
        continue;
      }
      const start = Date.now();
      try {
        const toolArgs =
          tool.name === 'searchKnowledgeBaseAndSOPs'
            ? { query: params.userPrompt, businessUnit: unit }
            : { businessUnit: unit, limit: 15 };
        const output = (await tool.execute(
          toolArgs,
          params.toolContext
        )) as Record<string, unknown>;
        traces.push({
          toolName: tool.name,
          args: toolArgs,
          durationMs: Date.now() - start,
        });
        records.push({
          toolName: tool.name,
          businessUnit: unit,
          output,
        });
      } catch {
        // Ignore individual tool failure during prefetch
      }
    }
  }

  return { records, traces };
}

const SYSTEM_PROMPT = `You are a sharp, conversational, strictly READ-ONLY AI Financial Controller and Operations Partner for a multi-business LAN management platform (Clothing Wholesale, Trucking/Logistics, and General Merchandise).

CONVERSATIONAL & INVESTIGATIVE STYLE:
- Cash means the owner's combined physical cash, bank and GCash/e-wallet funds. Default to recordedBookCashEquivalents, not physical cash alone. Use any supplied amount directly as the comparison amount; do not repeatedly ask whether it is real or a test. Say "compared with the amount you provided" and never claim it was independently counted or that a variance proves missing money. If the user explicitly calls it hypothetical, retain that framing.
- Every Clothing cash explanation must inspect purchasePostingCoverage and coverageSummary from reconcileCashAndFindDiscrepancies. Report checked sources, possible missing purchase postings and not-verified areas. Products marked Paid can reduce cash via Transit Build-Up (Dr Inventory in Transit / Cr Cash, Bank or GCash); card, payable, supplier-credit and opening-equity funding are different. Do not dismiss inventory entries as unrelated to cash. Use stable build/source keys, funding method and dates, not journal-description similarity. Conditional scenarios must remain separate from unchanged recorded book cash. Never say "checked everything" or "no explanation" when required checks are incomplete. If asked about unjournaled products or in-transit build-up, rerun this tool and explain its source-linked findings rather than just sampling recent products.
- Lead with the direct answer and verified customer identity. Use bullets for findings, numbered lists for steps or rankings, and Markdown tables for records. Do not add unrelated analysis.
- Clothing overdue/upcoming customer deadlines follow the Due Dates board: unpaid Prepared invoices only, due at the end of the third Manila calendar day after the invoice date. Use getOverdueInvoicesAndReceivables with dueStatus=overdue or upcoming. Trusted-customer Accounts Receivable (including legacy Pending Payment) has no automatic deadline and must not be called overdue or put on an automatic collection schedule. Owner discretion governs follow-up; customary one-to-two-month payment patterns are not fixed terms. Stored legacy A/R dates do not override this rule. Keep Trucking and General Merchandise rules separate.
- Identify each product as Product Name (FULL-PRODUCT-CODE), for example Premium Shortsleeves Onesie (PSO-101226). Preserve the entire productCode returned by the tool, including every date, variant, or other suffix; never abbreviate it, replace it with a database product ID, or omit it when known. For product/order database queries retrieve both the name and full productCode. If a code is not available, retrieve it through an authorized read-only tool when possible; otherwise say "product code not recorded" rather than inventing one. If only a code is known, show that exact code without guessing a name.
- When asked how many orders a named customer has, include the count AND the matching order details in the first answer: Date, Product (including a UI-visible code when available), Qty, and Status when statuses differ. State a common status once only if every matching row verifies it. Count transaction records as records; never infer distinct grouped orders. Resolve ambiguous customer matches before combining their histories.
- Use matchingTransactionCount, returnedTransactionCount, and hasMoreTransactions to disclose incomplete lists. Never say "all" unless all matching rows were returned and belong to the resolved customer. Link to the relevant module for additional records; never invent missing rows or dates.
- Speak naturally, warmly, and directly like an experienced human business partner—never sound like a rigid FAQ bot or dump unrelated audit sections when the user asks a specific question.
- Answer the exact question the user asked. If they ask an open-ended question (e.g., "Who is our oldest customer?", "What did Shanna Lim order?", "How much did we spend on freight?"), call the appropriate read-only database tool (\`queryCustomersAndOrderHistory\` or \`queryDatabaseReadOnly\`) to check the live PostgreSQL database before answering.
- For an unknown recipient, waybill, delivery-address lookup or a possible customer match by location, call \`findCustomersByAddress\` with the address text and authorized business unit. Customer directories have primary, business and additional addresses; never claim address search is unavailable without checking the tool. Present ranked POSSIBLE matches with the matched address and shared details, not a confirmed identity or a confidence percentage. Ask for one independent detail (phone, recipient, or landmark) before linking or dispatching. Respect incomplete-scan warnings; no candidates is not proof the customer does not exist. Do not send an address to the name-only customer-history search.
- For a Clothing directory-wide request to find possible duplicate customers or re-registrations under different names, use \`auditPossibleCustomerDuplicates\`. Report shared phone/address evidence and existing statuses only; never infer identity or ban evasion. Disclose audit limits. Do not substitute overdue invoices or recurring dues for an incomplete duplicate audit.
- If the user states their current cash/bank balance or asks whether cash matches the records (e.g., "Our cash right now is 100,000.00. Can you check if it matches all the records and if not, please find why"), call \`reconcileCashAndFindDiscrepancies\` with \`actualCashAmount\` set to their stated number. Walk them through:
  1. What the recorded book cash balance is (and its breakdown: opening balance, customer payments, paid expenses, refunds, manual journal lines).
  2. Whether it matches, and the exact peso variance (surplus or shortage).
  3. The exact culprit records discovered in the database that explain the difference (such as duplicate customer payments on the same order, overpaid orders with negative lineTotal, unposted recurring loan/expense drafts, pending cancellation refund payouts, or approved-but-unpaid expenses).

KNOWLEDGE BASE, EMPLOYEE HANDBOOK & POLICY GUIDANCE:
- For Clothing procedural or policy questions, use \`searchKnowledgeBaseAndSOPs\` to retrieve Clothing SOPs, handbook procedures, due-date policies, and pre-approved message templates rather than guessing.
- Cite the returned source policies and module links. Follow their stated review and approval requirements; do not infer automatic cancellation, forfeiture, or refund entitlement.
- This knowledge base contains Clothing policies only. Never apply them to Trucking or General Merchandise. If no approved policy is available for the requested domain, state that limitation and request the relevant policy from its owner.

NON-NEGOTIABLE SAFETY RULES:
1. You have strictly READ-ONLY access via predefined tools. You cannot create, modify, or delete any transactions, invoices, payments, ledger entries, or inventory records.
2. Never invent or guess arithmetic balances. Always rely on the deterministic numbers returned by the read-only tools.
3. Keep database primary keys internal by default: do not display customer IDs, product IDs, transaction/order row IDs, payment IDs, recurring-template IDs, or a Record ID column. Identify records using names, dates, product descriptions, quantities, statuses, amounts, and UI-visible product/shipment/invoice references. Never relabel a database key as a business reference. Include raw IDs only when the user explicitly requests them or explicitly asks for technical debugging. Link to the relevant module using the returned sourceLink; IDs may remain inside valid link targets without appearing as labels.
4. Keep records strictly separated between Clothing, Trucking, and General Merchandise. Unless the user specifies otherwise, default to Clothing (or the active businessUnit filter).
5. Respond to standalone greetings briefly and naturally (for example, "Good morning! How can I help you check the books or operations today?"). Do not volunteer business records or an audit summary on a greeting.`;

export interface RunBusinessAiParams {
  userPrompt: string;
  /** Prior chat turns for multi-turn conversations (oldest first). */
  history?: AiChatHistoryMessage[];
  triggerSource: AiTriggerSource;
  toolContext: AiToolExecutionContext;
  userId?: string | null;
  userName?: string | null;
  businessUnit?: AiBusinessUnit;
  useAccountingModel?: boolean;
  enableTools?: boolean;
  isSyntheticTest?: boolean;
  providerOverride?: AiProviderId;
  modelOverride?: string;
}

export async function runBusinessAiAssistant(
  params: RunBusinessAiParams
): Promise<AiGenerationResult> {
  const settings = await getAiAssistantSettings();
  const primaryProvider = params.providerOverride ?? settings.activeProvider;
  const primaryModel =
    params.modelOverride ||
    (params.useAccountingModel && settings.accountingModel
      ? settings.accountingModel
      : settings.activeModel);

  if (params.businessUnit) {
    assertBusinessUnitAccess(params.toolContext, params.businessUnit);
  }

  // Enforce Cloud Data Sharing policy for any non-synthetic request
  if (
    !params.isSyntheticTest &&
    primaryProvider !== 'ollama' &&
    !settings.allowCloudDataSharing
  ) {
    throw new Error(
      `Cloud Data Sharing is disabled in AI Assistant Settings. Enable "Allow Cloud Data Sharing" before sending business data to ${primaryProvider}, or switch Active Provider to local Ollama.`
    );
  }

  // Enforce daily token and monthly budget limits
  if (
    settings.usage.todayTotalTokens >= settings.dailyTokenLimit &&
    !params.isSyntheticTest
  ) {
    throw new Error(
      `Daily AI token limit (${settings.dailyTokenLimit.toLocaleString()} tokens) has been reached. Adjust the limit in Settings > AI Assistant.`
    );
  }

  if (
    primaryProvider !== 'ollama' &&
    settings.usage.monthEstimatedCostUsd >= settings.monthlyBudgetUsd &&
    !params.isSyntheticTest
  ) {
    throw new Error(
      `Monthly cloud AI budget ($${settings.monthlyBudgetUsd.toFixed(2)}) has been reached. Switch to local Ollama or increase the monthly budget.`
    );
  }

  const isStandaloneGreeting =
    params.triggerSource === 'USER_CHAT' &&
    /^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening))[\s!.?]*$/i.test(
      params.userPrompt.trim()
    );

  const tools =
    params.enableTools !== false && !isStandaloneGreeting
      ? getToolsForContext(params.toolContext, params.businessUnit)
      : [];

  let result: Omit<AiGenerationResult, 'usedFallback'>;
  let usedFallback = false;
  const providerFailures: Array<{
    provider: AiProviderId;
    model: string;
    reason: string;
    diagnostics?: AiProviderFailureDiagnostics;
  }> = [];
  const started = Date.now();
  const defaultUnit =
    params.businessUnit ??
    (params.toolContext.allowedBusinessUnits.includes('clothing')
      ? 'clothing'
      : undefined);
  const directKnowledgeTool =
    params.triggerSource === 'USER_CHAT' &&
    defaultUnit === 'clothing' &&
    isDirectKnowledgeQuestion(params.userPrompt)
      ? tools.find((tool) => tool.name === 'searchKnowledgeBaseAndSOPs')
      : undefined;
  const customerSearch =
    params.triggerSource === 'USER_CHAT' && defaultUnit === 'clothing'
      ? getDirectCustomerSearch(params.userPrompt)
      : null;
  const directCustomerTool = customerSearch
    ? tools.find((tool) => tool.name === 'queryCustomersAndOrderHistory')
    : undefined;
  const directCashTool =
    params.triggerSource === 'USER_CHAT' &&
    defaultUnit === 'clothing' &&
    isDirectClothingCashQuestion(params.userPrompt)
      ? tools.find((tool) => tool.name === 'reconcileCashAndFindDiscrepancies')
      : undefined;
  const dueMode =
    params.triggerSource === 'USER_CHAT' && defaultUnit === 'clothing'
      ? getDirectClothingDueMode(params.userPrompt)
      : null;
  const directDueTool = dueMode
    ? tools.find((tool) => tool.name === 'getOverdueInvoicesAndReceivables')
    : undefined;
  const duplicateAuditQuestion =
    params.triggerSource === 'USER_CHAT' &&
    isCustomerDuplicateAuditQuestion(params.userPrompt);
  const directAuditTool =
    duplicateAuditQuestion && defaultUnit === 'clothing'
      ? tools.find((tool) => tool.name === 'auditPossibleCustomerDuplicates')
      : undefined;
  if (duplicateAuditQuestion && !directAuditTool) {
    throw new Error(
      'Customer duplicate auditing is available only for authorized Clothing requests with tools enabled. Select Clothing to run this audit.'
    );
  }

  if (
    (directKnowledgeTool ||
      directCustomerTool ||
      directAuditTool ||
      directDueTool ||
      directCashTool) &&
    primaryProvider === 'copilot'
  ) {
    const { assertCopilotAccess } = await import('./copilot-provider');
    assertCopilotAccess({
      provider: primaryProvider,
      model: primaryModel,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: params.userPrompt,
      tools,
      toolContext: params.toolContext,
      isSyntheticTest: params.isSyntheticTest,
    });
  }

  try {
    let directCustomerAnswer: {
      text: string;
      args: Record<string, unknown>;
      durationMs: number;
    } | null = null;
    if (directCustomerTool) {
      const args = { businessUnit: 'clothing', search: customerSearch };
      const output = await directCustomerTool.execute(args, params.toolContext);
      const text = formatCustomerOrders(output);
      if (text) {
        directCustomerAnswer = { text, args, durationMs: Date.now() - started };
      }
    }
    if (directCashTool) {
      const args = { businessUnit: 'clothing' };
      const output = (await directCashTool.execute(
        args,
        params.toolContext
      )) as ClothingCashResult;
      result = {
        text: formatClothingCashCoverage(output),
        provider: primaryProvider,
        model: 'deterministic-clothing-cash-coverage',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: Date.now() - started,
        toolsCalled: [
          {
            toolName: directCashTool.name,
            args,
            durationMs: Date.now() - started,
          },
        ],
      };
    } else if (directDueTool && dueMode) {
      const args = { businessUnit: 'clothing', dueStatus: dueMode, limit: 30 };
      const output = (await directDueTool.execute(
        args,
        params.toolContext
      )) as ClothingDueInvoicesResult;
      result = {
        text: formatClothingDueInvoices(output),
        provider: primaryProvider,
        model: 'deterministic-clothing-due-invoices',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: Date.now() - started,
        toolsCalled: [
          {
            toolName: directDueTool.name,
            args,
            durationMs: Date.now() - started,
          },
        ],
      };
    } else if (directAuditTool) {
      const args = { businessUnit: 'clothing' };
      const output = (await directAuditTool.execute(
        args,
        params.toolContext
      )) as CustomerDuplicateAuditResult;
      result = {
        text: formatCustomerDuplicateAudit(output),
        provider: primaryProvider,
        model: 'deterministic-customer-duplicate-audit',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: Date.now() - started,
        toolsCalled: [
          {
            toolName: directAuditTool.name,
            args,
            durationMs: Date.now() - started,
          },
        ],
      };
    } else if (directCustomerAnswer && directCustomerTool) {
      result = {
        text: directCustomerAnswer.text,
        provider: primaryProvider,
        model: 'deterministic-customer-orders',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: Date.now() - started,
        toolsCalled: [
          {
            toolName: directCustomerTool.name,
            args: directCustomerAnswer.args,
            durationMs: directCustomerAnswer.durationMs,
          },
        ],
      };
    } else if (directKnowledgeTool) {
      const args = { query: params.userPrompt, businessUnit: 'clothing' };
      const output = (await directKnowledgeTool.execute(
        args,
        params.toolContext
      )) as Record<string, unknown>;
      result = {
        text: buildDeterministicFallbackMarkdown([
          {
            toolName: directKnowledgeTool.name,
            businessUnit: 'clothing',
            output,
          },
        ]),
        provider: primaryProvider,
        model: 'deterministic-knowledge',
        inputTokens: 0,
        outputTokens: 0,
        estimatedCostUsd: 0,
        latencyMs: Date.now() - started,
        toolsCalled: [
          {
            toolName: directKnowledgeTool.name,
            args,
            durationMs: Date.now() - started,
          },
        ],
      };
    } else {
      const gen = await generateWithProvider({
        provider: primaryProvider,
        model: primaryModel,
        ollamaBaseUrl: settings.ollamaBaseUrl,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: params.userPrompt,
        history: params.history,
        tools,
        isSyntheticTest: params.isSyntheticTest,
        toolContext: params.toolContext,
        timeoutMs: 45000,
      });
      result = gen;
    }
  } catch (primaryError) {
    providerFailures.push({
      provider: primaryProvider,
      model: primaryModel,
      reason: describeProviderFailure(primaryError),
      diagnostics: getProviderFailureDiagnostics(primaryError),
    });
    if (duplicateAuditQuestion || directDueTool || directCashTool) {
      const failedModel = duplicateAuditQuestion
        ? 'deterministic-customer-duplicate-audit'
        : directDueTool
          ? 'deterministic-clothing-due-invoices'
          : 'deterministic-clothing-cash-coverage';
      const failedTask = duplicateAuditQuestion
        ? 'Clothing customer duplicate audit'
        : directDueTool
          ? 'Clothing invoice due-date lookup'
          : 'Clothing cash coverage report';
      await insertAuditLogToStore({
        userId: params.userId ?? null,
        userName: params.userName ?? null,
        triggerSource: params.triggerSource,
        businessUnit: 'clothing',
        provider: primaryProvider,
        model: failedModel,
        status: 'ERROR',
        latencyMs: Date.now() - started,
        errorMessage: `${failedTask} could not be completed.`,
      });
      throw new Error(
        `Could not complete the ${failedTask}. No records were changed. Please retry; unrelated dues or receivables are not a substitute for this report.`
      );
    }
    const canFallback =
      Boolean(settings.fallbackProvider && settings.fallbackModel) &&
      !params.providerOverride &&
      (settings.fallbackProvider === 'ollama' ||
        settings.allowCloudDataSharing ||
        Boolean(params.isSyntheticTest));

    if (canFallback && settings.fallbackProvider && settings.fallbackModel) {
      try {
        const fallbackGen = await generateWithProvider({
          provider: settings.fallbackProvider,
          model: settings.fallbackModel,
          ollamaBaseUrl: settings.ollamaBaseUrl,
          systemPrompt: SYSTEM_PROMPT,
          userPrompt: params.userPrompt,
          history: params.history,
          tools,
          isSyntheticTest: params.isSyntheticTest,
          toolContext: params.toolContext,
          timeoutMs: 45000,
        });
        result = fallbackGen;
        usedFallback = true;
      } catch (fallbackError) {
        providerFailures.push({
          provider: settings.fallbackProvider,
          model: settings.fallbackModel,
          reason: describeProviderFailure(fallbackError),
          diagnostics: getProviderFailureDiagnostics(fallbackError),
        });
        const prefetched = await prefetchDeterministicToolData({
          userPrompt: params.userPrompt,
          tools,
          toolContext: params.toolContext,
          targetBusinessUnit: params.businessUnit,
        });
        if (prefetched.records.length > 0) {
          result = {
            text: buildDeterministicFallbackMarkdown(prefetched.records),
            provider: primaryProvider,
            model: `${primaryModel} (deterministic-fallback)`,
            inputTokens: 0,
            outputTokens: 0,
            estimatedCostUsd: 0,
            latencyMs: prefetched.traces.reduce(
              (sum, t) => sum + t.durationMs,
              0
            ),
            toolsCalled: prefetched.traces,
          };
          usedFallback = true;
        } else {
          await insertAuditLogToStore({
            userId: params.userId ?? null,
            userName: params.userName ?? null,
            triggerSource: params.triggerSource,
            businessUnit: params.businessUnit ?? null,
            provider: primaryProvider,
            model: primaryModel,
            status: 'ERROR',
            errorMessage: describeProviderFailure(primaryError),
            latencyMs: Date.now() - started,
            metadata: { providerFailures },
          });
          throw primaryError;
        }
      }
    } else {
      const prefetched = await prefetchDeterministicToolData({
        userPrompt: params.userPrompt,
        tools,
        toolContext: params.toolContext,
        targetBusinessUnit: params.businessUnit,
      });
      if (prefetched.records.length > 0) {
        result = {
          text: buildDeterministicFallbackMarkdown(prefetched.records),
          provider: primaryProvider,
          model: `${primaryModel} (deterministic-fallback)`,
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0,
          latencyMs: prefetched.traces.reduce(
            (sum, t) => sum + t.durationMs,
            0
          ),
          toolsCalled: prefetched.traces,
        };
        usedFallback = true;
      } else {
        await insertAuditLogToStore({
          userId: params.userId ?? null,
          userName: params.userName ?? null,
          triggerSource: params.triggerSource,
          businessUnit: params.businessUnit ?? null,
          provider: primaryProvider,
          model: primaryModel,
          status: 'ERROR',
          errorMessage: describeProviderFailure(primaryError),
          latencyMs: Date.now() - started,
          metadata: { providerFailures },
        });
        throw primaryError;
      }
    }
  }

  result.latencyMs = Date.now() - started;
  const fallbackReason = usedFallback
    ? providerFailures
        .map((failure) => `${failure.provider}: ${failure.reason}`)
        .join(' ')
    : undefined;
  await insertAuditLogToStore({
    userId: params.userId ?? null,
    userName: params.userName ?? null,
    triggerSource: params.triggerSource,
    businessUnit: params.businessUnit ?? null,
    provider: result.provider,
    model: result.model,
    toolsCalled: result.toolsCalled,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    estimatedCostUsd: result.estimatedCostUsd,
    latencyMs: result.latencyMs,
    status: 'SUCCESS',
    metadata: {
      usedFallback,
      executionMode:
        usedFallback && result.model.endsWith(' (deterministic-fallback)')
          ? 'local-fallback'
          : result.model.startsWith('deterministic-')
            ? result.model
            : 'provider',
      orchestrationDurationMs: Date.now() - started,
      providerTimings: result.timings,
      providerFailures,
      fallbackReason,
    },
  });

  return {
    ...result,
    usedFallback,
    fallbackReason,
  };
}

export async function explainMonitoringAlertWithAi(params: {
  alertId: string;
  toolContext: AiToolExecutionContext;
  userId?: string | null;
  userName?: string | null;
}) {
  await ensureAiAssistantTables();
  const alert = await findMonitoringAlertByIdFromStore(params.alertId);

  if (!alert) {
    throw new Error('Alert not found.');
  }

  assertBusinessUnitAccess(
    params.toolContext,
    alert.businessUnit as AiBusinessUnit
  );

  const prompt = [
    `Analyze this deterministic monitoring alert for the "${alert.businessUnit}" business unit:`,
    `- Category: ${alert.category}`,
    `- Severity: ${alert.severity}`,
    `- Title: ${alert.title}`,
    `- Deterministic Summary: ${alert.deterministicSummary}`,
    `- Source Module Link: ${alert.sourceLink ?? 'N/A'}`,
    `- Bounded Evidence JSON: ${JSON.stringify(alert.evidenceJson ?? {})}`,
    '',
    'Provide:',
    '1. Plain-language explanation of the discrepancy or overdue item citing the exact record IDs and amounts.',
    '2. Likely operational or bookkeeping causes (without guessing arithmetic).',
    '3. Recommended manual verification steps (and a short polite follow-up reminder draft if customer-facing).',
  ].join('\n');

  const aiResult = await runBusinessAiAssistant({
    userPrompt: prompt,
    triggerSource: 'ALERT_INVESTIGATION',
    toolContext: params.toolContext,
    userId: params.userId,
    userName: params.userName,
    businessUnit: alert.businessUnit as AiBusinessUnit,
    useAccountingModel: alert.category === 'ACCOUNTING_MISMATCH',
    enableTools: false,
  });

  const updated = await updateMonitoringAlertExplanationInStore(
    alert.id,
    aiResult.text,
    `${aiResult.provider}:${aiResult.model}`
  );

  return {
    alert: updated,
    generation: aiResult,
  };
}

export async function runSyntheticInvestigationTest(params: {
  toolContext: AiToolExecutionContext;
  userId?: string | null;
  userName?: string | null;
  providerOverride?: AiProviderId;
  modelOverride?: string;
}): Promise<AiGenerationResult> {
  const syntheticPrompt = [
    'SYNTHETIC AUDIT BENCHMARK (No real customer data):',
    '- Business Unit: Clothing Wholesale',
    '- Opening Cash (Deterministic): ₱100,000.00',
    '- Recorded Cash Received: ₱25,000.00 (Orders #9001, #9002)',
    '- Recorded Cash Expenses: ₱30,000.00 (Supplier Freight #401)',
    '- Expected Closing Cash (Deterministic): ₱95,000.00',
    '- Actual Counted Closing Cash: ₱93,000.00',
    '- Deterministic Discrepancy Flagged: -₱2,000.00 shortage',
    '- Supporting Anomaly: Order #9002 (Total ₱10,000.00) is marked PAID, but recorded TransactionPayment rows sum to ₱8,000.00.',
    '',
    'Explain the ₱2,000.00 discrepancy, cite Order #9002, and list the exact read-only verification steps for the bookkeeper without modifying any records.',
  ].join('\n');

  return runBusinessAiAssistant({
    userPrompt: syntheticPrompt,
    triggerSource: 'EVALUATION_TEST',
    toolContext: params.toolContext,
    userId: params.userId,
    userName: params.userName,
    useAccountingModel: true,
    enableTools: false,
    isSyntheticTest: true,
    providerOverride: params.providerOverride,
    modelOverride: params.modelOverride,
  });
}
